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

/**
 * 上报当前用户正在跑的角色（每次保存计划时调用）。
 * 先删除该设备的旧记录，再批量插入新记录，保证数据准确。
 */
export async function reportFarmingCharacters(characters: CharacterReport[]): Promise<void> {
  if (!supabase) return;
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

/**
 * 查询近 7 天跑片热门角色 Top10。
 * 通过服务端 RPC 函数聚合，只返回 10 行，性能不随数据量增长而下降。
 */
export async function fetchCommunityTop10(): Promise<CommunityCharacter[] | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_community_top10");

  if (error || !data) return null;

  return data.map((row: { character_name: string; user_count: number; top_target_star: number | null; top_target_pct: number | null }) => ({
    name: row.character_name,
    count: row.user_count,
    topTargetStar: row.top_target_star ?? undefined,
    topTargetPct: row.top_target_pct ?? undefined,
  }));
}
