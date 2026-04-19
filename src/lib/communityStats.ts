import { supabase, getDeviceId } from "./supabase";

export interface CommunityCharacter {
  name: string;
  count: number;
  topTargetStar?: number; // 最多人跑的目标星级
  topTargetPct?: number;  // 跑该目标星级的人占比（%）
}

export interface CharacterReport {
  name: string;
  targetStar: number;
}

export interface CommunityResult {
  data: CommunityCharacter[];
  updatedAt: Date | null; // 服务端缓存的最后刷新时间
}

/**
 * 上报当前用户正在跑的角色（每次保存计划时调用）。
 * 先删除该设备的旧记录，再批量插入新记录，保证数据准确。
 * 仅在生产环境上报，开发/测试环境不上报。
 */
export async function reportFarmingCharacters(characters: CharacterReport[]): Promise<void> {
  if (!supabase) return;
  // 开发环境不上报到数据库
  if (import.meta.env.DEV) return;
  const deviceId = getDeviceId();

  await supabase.from("character_farm_reports").delete().eq("device_id", deviceId);

  if (characters.length === 0) return;

  await supabase.from("character_farm_reports").insert(
    characters.map(({ name, targetStar }) => ({
      device_id: deviceId,
      character_name: name,
      target_star: targetStar,
    }))
  );
}

let _cache: { result: CommunityResult; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 小时内不重复请求（服务端也是每小时刷新）

/**
 * 从服务端预计算缓存表读取 Top10，速度极快。
 * 服务端由 pg_cron 每小时刷新一次，客户端缓存 1 小时。
 * 降级：若缓存表不存在则回退到实时 RPC。
 */
export async function fetchCommunityTop10(): Promise<CommunityResult | null> {
  if (!supabase) return null;
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache.result;

  // 优先读预计算缓存表
  const { data: cacheRow, error: cacheErr } = await supabase
    .from("community_cache")
    .select("data, updated_at")
    .eq("id", 1)
    .single();

  if (!cacheErr && cacheRow?.data) {
    const rows = cacheRow.data as { character_name: string; user_count: number; top_target_star: number | null; top_target_pct: number | null }[];
    const result: CommunityResult = {
      data: rows.map((row) => ({
        name: row.character_name,
        count: row.user_count,
        topTargetStar: row.top_target_star ?? undefined,
        topTargetPct: row.top_target_pct ?? undefined,
      })),
      updatedAt: cacheRow.updated_at ? new Date(cacheRow.updated_at) : null,
    };
    _cache = { result, ts: Date.now() };
    return result;
  }

  // 降级：实时 RPC
  const { data, error } = await supabase.rpc("get_community_top10");
  if (error || !data) return null;

  const result: CommunityResult = {
    data: data.map((row: { character_name: string; user_count: number; top_target_star: number | null; top_target_pct: number | null }) => ({
      name: row.character_name,
      count: row.user_count,
      topTargetStar: row.top_target_star ?? undefined,
      topTargetPct: row.top_target_pct ?? undefined,
    })),
    updatedAt: null,
  };
  _cache = { result, ts: Date.now() };
  return result;
}
