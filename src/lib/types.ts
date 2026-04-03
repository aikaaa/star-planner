export interface CharacterPlan {
  id: string;
  name: string;
  currentStar: number;
  targetStar: number;
  currentShards: number;
  startDate: string; // ISO date string
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

export function getCompletionDate(plan: CharacterPlan): Date {
  const days = getDaysNeeded(plan);
  const start = new Date(plan.startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return end;
}

// Get which character is being farmed on a specific date
export function getCharactersOnDate(plans: CharacterPlan[], date: Date): CharacterPlan[] {
  return plans.filter((plan) => {
    const start = new Date(plan.startDate);
    const end = getCompletionDate(plan);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d >= start && d <= end;
  });
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
