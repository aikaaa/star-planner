import { supabase, getDeviceId } from "./supabase";

export interface CommunityCharacter {
  name: string;
  count: number;
}

/**
 * 上报当前用户正在跑的角色（每次保存计划时调用）。
 * 先删除该设备的旧记录，再批量插入新记录，保证数据准确。
 */
export async function reportFarmingCharacters(characterNames: string[]): Promise<void> {
  if (!supabase) return;
  const deviceId = getDeviceId();

  // 删除该设备的旧记录
  await supabase.from("character_farm_reports").delete().eq("device_id", deviceId);

  if (characterNames.length === 0) return;

  await supabase.from("character_farm_reports").insert(
    characterNames.map((name) => ({
      device_id: deviceId,
      character_name: name,
    }))
  );
}

/**
 * 查询近 7 天跑片热门角色 Top10（按不同设备数降序）。
 * 若 Supabase 未配置则返回 null，由调用方降级到本地数据。
 */
export async function fetchCommunityTop10(): Promise<CommunityCharacter[] | null> {
  if (!supabase) return null;

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data, error } = await supabase
    .from("character_farm_reports")
    .select("character_name, device_id")
    .gte("reported_at", since.toISOString());

  if (error || !data) return null;

  // 按角色统计不同设备数
  const counts = new Map<string, Set<string>>();
  for (const row of data) {
    if (!counts.has(row.character_name)) counts.set(row.character_name, new Set());
    counts.get(row.character_name)!.add(row.device_id);
  }

  return Array.from(counts.entries())
    .map(([name, devices]) => ({ name, count: devices.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
