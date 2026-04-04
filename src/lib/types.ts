export type FarmingMode = "star" | "free";

/** 将 "YYYY-MM-DD" 解析为本地时间 Date，避免 UTC 时区偏移导致日期差一天 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface CharacterPlan {
  id: string;
  name: string;
  farmingMode: FarmingMode; // "star"=按星跑片 "free"=自由跑片
  currentStar: number;
  targetStar: number;
  currentShards: number;
  startDate: string; // ISO date string
  endDate?: string;  // 自由跑片时由用户设置
}

export interface FarmingPlan {
  characters: CharacterPlan[];
}

// Shards needed for each star upgrade
export const SHARD_COSTS: Record<string, number> = {
  "1-2": 20,
  "2-3": 50,
  "3-4": 100,
  "4-5": 120,
};

export function getTotalShardsNeeded(currentStar: number, targetStar: number): number {
  let total = 0;
  for (let s = currentStar; s < targetStar; s++) {
    total += SHARD_COSTS[`${s}-${s + 1}`] || 0;
  }
  return total;
}

export function getDaysNeeded(plan: CharacterPlan): number {
  if (plan.farmingMode === "free" && plan.endDate) {
    const start = parseLocalDate(plan.startDate);
    const end = parseLocalDate(plan.endDate);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  }
  const totalNeeded = getTotalShardsNeeded(plan.currentStar, plan.targetStar);
  const remaining = Math.max(0, totalNeeded - plan.currentShards);
  return Math.ceil(remaining / 3); // 3 shards per day
}

// Given available days and current shards, calculate the highest reachable star
export function getTargetStarFromDays(currentStar: number, currentShards: number, days: number): number {
  const totalShards = days * 3 + currentShards;
  let accumulated = 0;
  let reachable = currentStar;
  for (let s = currentStar; s < 5; s++) {
    accumulated += SHARD_COSTS[`${s}-${s + 1}`] || 0;
    if (totalShards >= accumulated) {
      reachable = s + 1;
    } else {
      break;
    }
  }
  return Math.max(currentStar + 1, reachable);
}

// 自由跑片：计算可达星级及剩余碎片（用于展示不完整进度）
export function getPartialProgress(
  currentStar: number,
  currentShards: number,
  days: number
): { reachableStar: number; remainingShards: number } {
  let shards = currentShards + days * 3;
  let star = currentStar;
  while (star < 5) {
    const cost = SHARD_COSTS[`${star}-${star + 1}`] || 0;
    if (shards >= cost) {
      shards -= cost;
      star++;
    } else {
      break;
    }
  }
  return { reachableStar: star, remainingShards: shards };
}

// 自由跑片目标展示字符串，例如 "3★ 余30片" 或 "5★ 满星"
export function getFreeTargetLabel(
  currentStar: number,
  currentShards: number,
  days: number
): string {
  const { reachableStar, remainingShards } = getPartialProgress(currentStar, currentShards, days);
  if (reachableStar >= 5) return "5★ 满星 🎉";
  return `${reachableStar}★ 余 ${remainingShards} 片`;
}

export function getCompletionDate(plan: CharacterPlan): Date {
  if (plan.farmingMode === "free" && plan.endDate) {
    return parseLocalDate(plan.endDate);
  }
  const days = getDaysNeeded(plan);
  const start = parseLocalDate(plan.startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return end;
}

// Get which character is being farmed on a specific date
export function getCharactersOnDate(plans: CharacterPlan[], date: Date): CharacterPlan[] {
  return plans.filter((plan) => {
    const start = parseLocalDate(plan.startDate);
    const end = getCompletionDate(plan);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d >= start && d <= end;
  });
}

// 计算角色的「有效目标星级」用于上报和展示
// 按星跑片直接取 targetStar，自由跑片取可达的整数星级
export function getEffectiveTargetStar(plan: CharacterPlan): number {
  if (plan.farmingMode === "free") {
    const days = getDaysNeeded(plan);
    return getPartialProgress(plan.currentStar, plan.currentShards, days).reachableStar;
  }
  return plan.targetStar;
}

// Mock community data - Top 10
export const COMMUNITY_TOP_CHARACTERS = [
  { name: "艾尔海森", count: 1247, avatar: "🧙" },
  { name: "纳西妲", count: 1089, avatar: "🌿" },
  { name: "雷电将军", count: 956, avatar: "⚡" },
  { name: "胡桃", count: 823, avatar: "🔥" },
  { name: "甘雨", count: 712, avatar: "❄️" },
  { name: "钟离", count: 689, avatar: "🪨" },
  { name: "夜兰", count: 634, avatar: "💧" },
  { name: "万叶", count: 578, avatar: "🍃" },
  { name: "妮露", count: 521, avatar: "💃" },
  { name: "八重神子", count: 487, avatar: "🦊" },
];
