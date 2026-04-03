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

// Mock community data
export const COMMUNITY_TOP_CHARACTERS = [
  { name: "艾尔海森", count: 1247, avatar: "🧙" },
  { name: "纳西妲", count: 1089, avatar: "🌿" },
  { name: "雷电将军", count: 956, avatar: "⚡" },
];
