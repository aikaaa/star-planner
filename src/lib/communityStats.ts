import { supabase, getDeviceId } from "./supabase";

export interface CommunityCharacter {
  name: string;
  count: number;
  topTargetStar?: number; // 最多人跑的目标星级
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
 * 查询近 7 天跑片热门角色 Top10（按不同设备数降序）。
 * 同时统计每个角色最多人跑的目标星级。
 */
export async function fetchCommunityTop10(): Promise<CommunityCharacter[] | null> {
  if (!supabase) return null;

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data, error } = await supabase
    .from("character_farm_reports")
    .select("character_name, device_id, target_star")
    .gte("reported_at", since.toISOString());

  if (error || !data) return null;

  // 按角色统计不同设备数，并统计各目标星级出现次数
  const deviceSets = new Map<string, Set<string>>();
  const starCounts = new Map<string, Map<number, number>>();

  for (const row of data) {
    const name = row.character_name;

    if (!deviceSets.has(name)) deviceSets.set(name, new Set());
    deviceSets.get(name)!.add(row.device_id);

    if (row.target_star != null) {
      if (!starCounts.has(name)) starCounts.set(name, new Map());
      const m = starCounts.get(name)!;
      m.set(row.target_star, (m.get(row.target_star) ?? 0) + 1);
    }
  }

  return Array.from(deviceSets.entries())
    .map(([name, devices]) => {
      // 取出现次数最多的目标星级
      const starMap = starCounts.get(name);
      let topTargetStar: number | undefined;
      if (starMap) {
        let maxCount = 0;
        for (const [star, cnt] of starMap) {
          if (cnt > maxCount) { maxCount = cnt; topTargetStar = star; }
        }
      }
      return { name, count: devices.size, topTargetStar };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
