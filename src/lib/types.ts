export type FarmingMode = "star" | "free";

/** 展示用：SP前缀和中文之间加空格，如 "SP阿列克谢" → "SP 阿列克谢" */
export function formatCharName(name: string): string {
  return name.replace(/^SP(?=[\u4e00-\u9fff])/, "SP ");
}

/** 将 "YYYY-MM-DD" 解析为东八区时间，避免 UTC 偏移导致日期差一天 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00+08:00");
}

/** 将 Date 对象转为 "YYYY-MM-DD" 字符串（取本地日期，避免 toISOString 转成 UTC 差一天） */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface CharacterPlan {
  id: string;
  name: string;
  farmingMode: FarmingMode; // "star"=按星跑片 "free"=自由跑片
  currentStar: number;
  targetStar: number;
  currentShards: number;
  bonusShards?: number;      // 追忆/万能碎片可补充量（可选，默认0）
  startDate: string;         // ISO date string
  endDate?: string;          // 自由跑片时由用户设置
  icon?: string;             // 用户自选的 emoji 图标
  doubleDropStart?: string;  // 双倍掉落开始日期（已裁剪至跑片周期内）
  doubleDropEnd?: string;    // 双倍掉落结束日期（已裁剪至跑片周期内）
}

export interface FarmingPlan {
  characters: CharacterPlan[];
}

export interface CharIconOption {
  emoji: string;
  label: string;
}

export const CHAR_ICON_OPTIONS: CharIconOption[] = [
  // 小动物
  { emoji: "🐱", label: "猫咪" },
  { emoji: "🐶", label: "小狗" },
  { emoji: "🐰", label: "兔子" },
  { emoji: "🐻", label: "熊熊" },
  { emoji: "🐼", label: "熊猫" },
  { emoji: "🐸", label: "青蛙" },
  { emoji: "🐧", label: "企鹅" },
  { emoji: "🐦", label: "小鸟" },
  { emoji: "🦊", label: "狐狸" },
  { emoji: "🐺", label: "狼" },
  { emoji: "🦁", label: "狮子" },
  { emoji: "🐯", label: "老虎" },
  { emoji: "🐨", label: "考拉" },
  { emoji: "🐮", label: "奶牛" },
  { emoji: "🐷", label: "猪猪" },
  { emoji: "🐙", label: "章鱼" },
  { emoji: "🦋", label: "蝴蝶" },
  { emoji: "🐢", label: "乌龟" },
  { emoji: "🦄", label: "独角兽" },
  { emoji: "🐉", label: "龙" },
  // 水果食物
  { emoji: "🍏", label: "青苹果" },
  { emoji: "🍅", label: "番茄" },
  { emoji: "🫐", label: "蓝莓" },
  { emoji: "🍇", label: "葡萄" },
  { emoji: "🍊", label: "橘子" },
  { emoji: "🍓", label: "草莓" },
  { emoji: "🍑", label: "桃子" },
  { emoji: "🍒", label: "樱桃" },
  // 自然天气
  { emoji: "🌸", label: "樱花" },
  { emoji: "🌻", label: "向日葵" },
  { emoji: "🍀", label: "四叶草" },
  { emoji: "🌈", label: "彩虹" },
  { emoji: "⭐", label: "星星" },
  { emoji: "🌙", label: "月亮" },
  { emoji: "🔥", label: "火焰" },
  { emoji: "❄️", label: "雪花" },
  { emoji: "⚡", label: "闪电" },
  { emoji: "🌊", label: "海浪" },
  // 其他
  { emoji: "💎", label: "钻石" },
  { emoji: "🏆", label: "奖杯" },
  { emoji: "🎯", label: "靶心" },
  { emoji: "🎵", label: "音符" },
  { emoji: "🎮", label: "游戏" },
  { emoji: "🗡️", label: "剑" },
  { emoji: "🛡️", label: "盾" },
  { emoji: "👑", label: "王冠" },
];

// Shards needed for each star upgrade
export const SHARD_COSTS: Record<string, number> = {
  "1-2": 20,
  "2-3": 60,
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

/**
 * 计算跑片计划在前 days 天内实际产出的碎片总量（含双倍加成）。
 * 按三阶段：双倍前3/天 → 双倍期6/天 → 双倍后3/天
 */
export function getActualShardsForDays(plan: CharacterPlan, days: number): number {
  if (days <= 0) return 0;
  if (!plan.doubleDropStart || !plan.doubleDropEnd) return days * 3;

  const farmStart = parseLocalDate(plan.startDate); farmStart.setHours(0, 0, 0, 0);
  const ddStart = parseLocalDate(plan.doubleDropStart); ddStart.setHours(0, 0, 0, 0);
  const ddEnd = parseLocalDate(plan.doubleDropEnd); ddEnd.setHours(0, 0, 0, 0);

  const preDays = Math.max(0, Math.round((ddStart.getTime() - farmStart.getTime()) / 86400000));
  const ddDays = Math.max(0, Math.round((ddEnd.getTime() - ddStart.getTime()) / 86400000) + 1);

  if (days <= preDays) return days * 3;
  if (days <= preDays + ddDays) return preDays * 3 + (days - preDays) * 6;
  return preDays * 3 + ddDays * 6 + (days - preDays - ddDays) * 3;
}

export function getDaysNeeded(plan: CharacterPlan): number {
  if (plan.farmingMode === "free" && plan.endDate) {
    const start = parseLocalDate(plan.startDate);
    const end = parseLocalDate(plan.endDate);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1); // +1 包含结束当天
  }
  const totalNeeded = getTotalShardsNeeded(plan.currentStar, plan.targetStar);
  const remaining = Math.max(0, totalNeeded - plan.currentShards - (plan.bonusShards ?? 0));

  // 按星跑片 + 双倍掉落：分阶段模拟
  if (plan.doubleDropStart && plan.doubleDropEnd && remaining > 0) {
    const farmStart = parseLocalDate(plan.startDate);
    farmStart.setHours(0, 0, 0, 0);
    const ddStart = parseLocalDate(plan.doubleDropStart);
    ddStart.setHours(0, 0, 0, 0);
    const ddEnd = parseLocalDate(plan.doubleDropEnd);
    ddEnd.setHours(0, 0, 0, 0);

    // 双倍开始前的天数
    const preDays = Math.max(0, Math.round((ddStart.getTime() - farmStart.getTime()) / 86400000));
    // 双倍持续天数
    const ddDays = Math.max(0, Math.round((ddEnd.getTime() - ddStart.getTime()) / 86400000) + 1);

    let rem = remaining;

    // 阶段1：双倍前，每天3片
    const preShards = preDays * 3;
    if (preShards >= rem) return Math.ceil(rem / 3);
    rem -= preShards;

    // 阶段2：双倍期间，每天6片
    const doubleShards = ddDays * 6;
    if (doubleShards >= rem) return preDays + Math.ceil(rem / 6);
    rem -= doubleShards;

    // 阶段3：双倍后，每天3片
    return preDays + ddDays + Math.ceil(rem / 3);
  }

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

/** 判断某天是否在该计划的双倍掉落期内 */
export function isDoubleDropDate(plan: CharacterPlan, date: Date): boolean {
  if (!plan.doubleDropStart || !plan.doubleDropEnd) return false;
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const ddStart = parseLocalDate(plan.doubleDropStart); ddStart.setHours(0, 0, 0, 0);
  const ddEnd = parseLocalDate(plan.doubleDropEnd); ddEnd.setHours(0, 0, 0, 0);
  return d >= ddStart && d <= ddEnd;
}

/** 统计某计划在给定范围内的双倍天数 */
export function countDoubleDropDaysInRange(plan: CharacterPlan, rangeStart: Date, rangeEnd: Date): number {
  if (!plan.doubleDropStart || !plan.doubleDropEnd) return 0;
  const ddS = parseLocalDate(plan.doubleDropStart); ddS.setHours(0, 0, 0, 0);
  const ddE = parseLocalDate(plan.doubleDropEnd); ddE.setHours(0, 0, 0, 0);
  const rs = new Date(rangeStart); rs.setHours(0, 0, 0, 0);
  const re = new Date(rangeEnd); re.setHours(0, 0, 0, 0);
  const cs = new Date(Math.max(rs.getTime(), ddS.getTime()));
  const ce = new Date(Math.min(re.getTime(), ddE.getTime()));
  if (cs > ce) return 0;
  return Math.round((ce.getTime() - cs.getTime()) / 86400000) + 1;
}

// 自由跑片：计算可达星级及剩余碎片（用于展示不完整进度）
// bonusDays：双倍掉落天数，每天额外+3片
export function getPartialProgress(
  currentStar: number,
  currentShards: number,
  days: number,
  bonusDays: number = 0
): { reachableStar: number; remainingShards: number } {
  let shards = currentShards + days * 3 + bonusDays * 3;
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
  end.setDate(end.getDate() + days - 1);
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
    return getPartialProgress(plan.currentStar, plan.currentShards + (plan.bonusShards ?? 0), days).reachableStar;
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
