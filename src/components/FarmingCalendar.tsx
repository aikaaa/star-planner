import { useMemo, useState, useEffect, useCallback } from "react";
import { CharacterPlan, formatCharName, getCharactersOnDate, getCompletionDate, getDaysNeeded, getEffectiveTargetStar, getPartialProgress, getTotalShardsNeeded, parseLocalDate, CHAR_ICON_OPTIONS, isDoubleDropDate, countDoubleDropDaysInRange, getActualShardsForDays } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAvatarUrl, getEnName } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";
import { CARD_SPACING } from "@/lib/cardSpacing";

interface FarmingCalendarProps {
  plans: CharacterPlan[];
  viewMonth?: Date;
  onViewMonthChange?: (d: Date) => void;
}

const WEEKDAYS    = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AVATAR_BG      = ["#B0D6CA", "#B0CED6", "#B0BFD6", "#D6B0B1", "#DBD19D", "#D3B0D6"];
const AVATAR_BG_DARK = ["#6C877E", "#528693", "#647693", "#896161", "#7E7962", "#7B647D"];

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

// ── 卡片间距配置（单位 px）──────────────────────────────────
// 修改这里即可调整卡片内所有行的上下间距
const CARD_ROW_SPACING = 8;   // 每行计划的上下 padding（px）
const CARD_HEADER_PB = 8;     // 头部到分割线的 padding-bottom（px）
// ─────────────────────────────────────────────────────────────

/** 取角色的图标 emoji，未设置时按 index 取默认值 */
function getCharIcon(plan: CharacterPlan, index: number): string {
  return plan.icon ?? CHAR_ICON_OPTIONS[index % CHAR_ICON_OPTIONS.length].emoji;
}

/**
 * 角色头像组件：优先显示游戏头像图片，加载失败或无图片时降级为彩色圆。
 * size: CSS 尺寸字符串，如 "20px"
 * onFallback: 当头像实际渲染为彩色圆时回调（用于父组件更新颜色索引）
 */
function CharAvatar({
  plan,
  index,
  size = "20px",
  className = "",
  onFallback,
}: {
  plan: CharacterPlan;
  index: number;
  size?: string;
  className?: string;
  onFallback?: (name: string) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const isDark = useIsDark();
  const avatarUrl = getAvatarUrl(plan.name);

  const sizeNum = parseFloat(size);
  const unit = size.replace(String(sizeNum), "");
  const fontSizeStr = isNaN(sizeNum) ? "0.48em" : `${sizeNum * 0.48}${unit}`;

  const baseStyle = { width: size, height: size, minWidth: size, flexShrink: 0 };

  if (avatarUrl && !imgFailed) {
    return (
      <div
        title={plan.name}
        className={`rounded-full overflow-hidden ${className}`}
        style={{ ...baseStyle, background: "var(--avatar-circle-bg)" }}
      >
        <img
          src={avatarUrl}
          alt={plan.name}
          onError={() => { setImgFailed(true); onFallback?.(plan.name); }}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  return (
    <div
      title={plan.name}
      className={`rounded-full overflow-hidden ${className}`}
      style={{
        ...baseStyle,
        background: (isDark ? AVATAR_BG_DARK : AVATAR_BG)[index % AVATAR_BG.length],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="2 2 20 20"
        fill="rgba(255,255,255,0.6)"
        style={{ width: "58%", height: "58%", display: "block" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8H4z" />
      </svg>
    </div>
  );
}

export default function FarmingCalendar({ plans, viewMonth: controlledViewMonth, onViewMonthChange }: FarmingCalendarProps) {
  const { t, lang } = useI18n();
  const isDark = useIsDark();
  const rosterStarColor = "hsl(var(--star))";
  const getCharName = (zh: string) => lang === "en" ? getEnName(zh) : formatCharName(zh);
  const [internalViewMonth, setInternalViewMonth] = useState(() => new Date());

  const viewMonth = controlledViewMonth ?? internalViewMonth;
  const setViewMonth = (d: Date) => {
    setInternalViewMonth(d);
    onViewMonthChange?.(d);
  };

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDateSet = useMemo(() => new Set(
    plans.map(p => { const d = parseLocalDate(p.startDate); d.setHours(0, 0, 0, 0); return d.getTime(); })
  ), [plans]);

  // 追踪实际加载失败的头像（有 URL 但图片 404/加载失败）
  // 失败的角色和无 URL 的角色一起进入"彩色圆"分组
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(() => new Set());
  const handleAvatarFallback = useCallback((name: string) => {
    setFailedAvatars(prev => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }, []);

  // 颜色索引分配：
  //   - 实际渲染彩色圆的角色（无 URL 或图片加载失败）按计划出场顺序依次取色 0, 1, 2...
  //   - 有真实头像的角色排在后面（索引不会被使用）
  const charColorIndex = useMemo(() => {
    const fallbackChars: string[] = [];
    const avatarChars: string[] = [];
    const seen = new Set<string>();
    plans.forEach(p => {
      if (seen.has(p.name)) return;
      seen.add(p.name);
      if (!getAvatarUrl(p.name) || failedAvatars.has(p.name)) fallbackChars.push(p.name);
      else avatarChars.push(p.name);
    });
    const map = new Map<string, number>();
    fallbackChars.forEach((name, i) => map.set(name, i));
    avatarChars.forEach((name, i) => map.set(name, fallbackChars.length + i));
    return map;
  }, [plans, failedAvatars]);

  const calendarDays = useMemo(() => {
    const days: { day: number; characters: CharacterPlan[] }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({ day: d, characters: getCharactersOnDate(plans, date) });
    }
    return days;
  }, [plans, year, month, daysInMonth]);

  return (
    <div className="w-full">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-1">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="text-muted-foreground hover:text-foreground rounded-[4px]">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-sm font-semibold text-foreground">
          {lang === "en" ? `${new Date(year, month).toLocaleString("en", { month: "long" })} ${year}` : `${year}${t.calendar.year}${month + 1}${t.calendar.month}`}
        </h2>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="text-muted-foreground hover:text-foreground rounded-[4px]">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Legend */}
      {plans.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {Array.from(
            plans.reduce((map, p) => {
              if (!map.has(p.name)) map.set(p.name, { plan: p, segments: [] });
              map.get(p.name)!.segments.push(p);
              return map;
            }, new Map<string, { plan: CharacterPlan; segments: CharacterPlan[] }>())
          ).map(([name, { plan, segments }], i) => (
            <div key={name} className="flex items-center gap-1 text-xs text-muted-foreground">
              <CharAvatar plan={plan} index={charColorIndex.get(name) ?? 0} size="24px" onFallback={handleAvatarFallback} />
              <span>{getCharName(name)}</span>
              {segments.length === 1
                ? <span>{segments[0].currentStar}→{getEffectiveTargetStar(segments[0])}</span>
                : <span>{segments.map(s => `${s.currentStar}→${getEffectiveTargetStar(s)}`).join(", ")}</span>
              }
            </div>
          ))}
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {(lang === "en" ? WEEKDAYS_EN : WEEKDAYS).map((d) => (
          <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {calendarDays.map(({ day, characters }) => {
          const date = new Date(year, month, day);
          date.setHours(0, 0, 0, 0);
          const isToday     = date.getTime() === today.getTime();
          const isStartDate = startDateSet.has(date.getTime());
          const hasChars = characters.length > 0;
          const hasDoubleDrop = characters.some(c => isDoubleDropDate(c, date));

          return (
            <div
              key={day}
              className="relative flex flex-col items-center justify-center p-2 text-xs"
              style={{
                backgroundColor: hasDoubleDrop
                  ? "hsl(var(--star) / 0.13)"
                  : "hsl(var(--primary) / 0.08)",
                minHeight: "3.5rem",
                borderRadius: "8px",
              }}
            >
              {isToday && (
                <span className="absolute inset-0 pointer-events-none z-10" style={{ boxShadow: "inset 0 0 0 2px hsl(var(--primary))", borderRadius: "8px" }} />
              )}
              {isStartDate && (
                <svg width={8} height={8} viewBox="0 0 12 12" fill="none" style={{ position: "absolute", top: 6, right: 6, zIndex: 10, pointerEvents: "none" }}>
                  <path d="M6 0C6 0 6.85334 2.69555 8.07889 3.92111C9.30445 5.14666 12 6 12 6C12 6 9.30445 6.85334 8.07889 8.07889C6.85334 9.30445 6 12 6 12C6 12 5.14666 9.30445 3.92111 8.07889C2.69555 6.85334 0 6 0 6C0 6 3.34379 4.69221 3.92111 3.92111C4.49842 3.15 6 0 6 0Z" fill={rosterStarColor}/>
                </svg>
              )}
              <span className={`text-xs sm:text-xs leading-none ${isToday ? "font-bold text-primary" : "text-foreground"}`}>
                {isToday && lang === "cn" ? t.calendar.today : day}
              </span>
              {hasChars && (() => {
                const shown = characters.slice(0, 6);
                const count = shown.length;
                // 维持总宽度约 58px：3人@22px，-4px重叠 → 22+18+18=58px
                // 公式：size = 4 + 54/count，总宽 = size + (count-1)*(size-4) = size*count - (count-1)*4 ≈ 58px
                const avatarSize = Math.round(4 + 54 / count); // N=3→22, N=4→18, N=5→15, N=6→13
                const maxPx = Math.min(22, avatarSize);
                const slotSize = `min(${maxPx}px, calc((min(100vw, 600px) - 48px) / ${7 * count}))`;
                // 固定 -4px 重叠，保持总宽一致
                const overlap = count > 1 ? "-4px" : "0px";
                // 人多时徽章更小
                const badgeFontSize = avatarSize <= 15 ? "5px" : "6px";
                const badgePad = avatarSize <= 15 ? "1px 1.5px" : "1px 2.5px";
                return (
                  <div className="flex mt-0.5 justify-center items-center">
                    {shown.map((c, ci) => {
                      const isDouble = isDoubleDropDate(c, date);
                      return (
                        <div key={c.id} style={{ width: slotSize, height: slotSize, flexShrink: 0, fontSize: slotSize, marginLeft: ci > 0 ? overlap : 0, zIndex: ci, position: "relative" }}>
                          <CharAvatar plan={c} index={charColorIndex.get(c.name) ?? 0} size="100%" onFallback={handleAvatarFallback} />
                          {isDouble && (
                            <span style={{
                              position: "absolute",
                              bottom: "-4px",
                              left: "50%",
                              transform: "translateX(-50%)",
                              background: "hsl(var(--star))",
                              color: "var(--double-badge-text)",
                              fontSize: badgeFontSize,
                              fontWeight: 700,
                              lineHeight: 1,
                              padding: badgePad,
                              borderRadius: "3px",
                              border: "1px solid hsl(var(--card))",
                              pointerEvents: "none",
                              zIndex: 10,
                              whiteSpace: "nowrap",
                            }}>×2</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex items-center flex-wrap mt-2 mb-1" style={{ gap: 8 }}>
        <div className="flex items-center gap-1">
          <svg width={8} height={8} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <path d="M6 0C6 0 6.85334 2.69555 8.07889 3.92111C9.30445 5.14666 12 6 12 6C12 6 9.30445 6.85334 8.07889 8.07889C6.85334 9.30445 6 12 6 12C6 12 5.14666 9.30445 3.92111 8.07889C2.69555 6.85334 0 6 0 6C0 6 3.34379 4.69221 3.92111 3.92111C4.49842 3.15 6 0 6 0Z" fill={rosterStarColor}/>
          </svg>
          <span className="text-xs text-muted-foreground">{t.calendar.rosterChangeDay}</span>
        </div>
        {plans.some(p => p.doubleDropStart && p.doubleDropEnd) && (
          <div className="flex items-center gap-1">
            <span style={{
              background: "hsl(var(--star))",
              color: "var(--double-badge-text)",
              fontSize: "8px",
              fontWeight: 700,
              lineHeight: 1,
              padding: "2px 3px",
              borderRadius: "3px",
              flexShrink: 0,
            }}>×2</span>
            <span className="text-xs text-muted-foreground">{t.calendar.doubleDropDay}</span>
          </div>
        )}
      </div>

      {/* Summary cards — 按开始时间排序，同名角色合并 */}
      {plans.length > 0 && (() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // 按开始时间 → 结束时间排序
        const sorted = [...plans].sort((a, b) => {
          const startDiff = parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime();
          if (startDiff !== 0) return startDiff;
          return getCompletionDate(a).getTime() - getCompletionDate(b).getTime();
        });

        // 按角色名分组（保持首次出现顺序）
        const groups = new Map<string, CharacterPlan[]>();
        for (const p of sorted) {
          if (!groups.has(p.name)) groups.set(p.name, []);
          groups.get(p.name)!.push(p);
        }

        return (
          <div className="mt-2 space-y-2">
            {[...groups.entries()].map(([name, group], gi) => {
              // 用第一条计划的头像
              const first = group[0];
              const firstIdx = charColorIndex.get(name) ?? 0;
              // 找今天正在进行的段（今天在 startDate ~ endDate 之间）
              const activeToday = group.find((p) => {
                const s = parseLocalDate(p.startDate); s.setHours(0, 0, 0, 0);
                const e = getCompletionDate(p); e.setHours(0, 0, 0, 0);
                return todayStart >= s && todayStart <= e;
              });
              const todayInfo = (() => {
                if (!activeToday) return null;
                const s = parseLocalDate(activeToday.startDate); s.setHours(0, 0, 0, 0);
                const daysElapsed = Math.max(0, Math.round((todayStart.getTime() - s.getTime()) / 86400000)) + 1;
                const ddBonus = countDoubleDropDaysInRange(activeToday, s, todayStart);
                const { reachableStar, remainingShards } = getPartialProgress(activeToday.currentStar, activeToday.currentShards + (activeToday.bonusShards ?? 0), daysElapsed, ddBonus);
                const isExcess = reachableStar >= 5 && remainingShards > 0;
                return { reachableStar, remainingShards, isExcess };
              })();

              return (
                <div
                  key={name}
                  className="rounded-lg p-3 bg-card shadow-sm"
                  style={{ paddingTop: 10, paddingBottom: 8, border: "1px solid hsl(var(--border) / 0.7)" }}
                >
                  <div className="flex items-center justify-between" style={{paddingBottom: CARD_HEADER_PB, borderBottom: "1px solid hsl(var(--border) / 0.5)"}}>
                    <div className="flex items-center gap-2">
                      <CharAvatar plan={first} index={firstIdx} size="32px" onFallback={handleAvatarFallback} />
                      <span className="font-semibold text-foreground text-sm">{getCharName(name)}</span>
                    </div>
                    {todayInfo && (
                      <div className="text-xs text-muted-foreground">
                        {t.calendar.todayReachable}{" "}
                        {todayInfo.isExcess ? (
                          lang === "en" ? (
                            <span className="text-star font-bold">5★ <span className="text-destructive">{todayInfo.remainingShards} {t.calendar.excess}</span></span>
                          ) : (
                            <>
                              <span className="text-star font-bold">5★ {t.calendar.fullStar.replace("★ ", "")}</span>
                              <span className="text-destructive font-bold"> {t.calendar.excess} {todayInfo.remainingShards} {t.calendar.shards}</span>
                            </>
                          )
                        ) : todayInfo.reachableStar >= 5 ? (
                          <span className="text-star font-bold">5★ {t.calendar.fullStar.replace("★ ", "")}</span>
                        ) : (
                          <span className="text-star font-bold">{todayInfo.reachableStar}★ {lang === "en" ? `${todayInfo.remainingShards} ${t.calendar.remaining}` : `${t.calendar.remaining} ${todayInfo.remainingShards} ${t.calendar.shards}`}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {group.map((p) => {
                    const days = getDaysNeeded(p);
                    const endDate = getCompletionDate(p);
                    const targetStar = getEffectiveTargetStar(p);
                    const startD = parseLocalDate(p.startDate);
                    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
                    const freeDdBonus = p.farmingMode === "free"
                      ? countDoubleDropDaysInRange(p, parseLocalDate(p.startDate), endDate)
                      : 0;
                    const { remainingShards, reachableStar } = p.farmingMode === "free"
                      ? getPartialProgress(p.currentStar, p.currentShards + (p.bonusShards ?? 0), days, freeDdBonus)
                      : { remainingShards: 0, reachableStar: targetStar };
                    const isExcess = reachableStar >= 5 && remainingShards > 0;
                    // 按星模式：用实际产出碎片（含双倍）计算超出量
                    const starModeExcess = p.farmingMode === "star"
                      ? Math.max(0, p.currentShards + (p.bonusShards ?? 0) + getActualShardsForDays(p, days) - getTotalShardsNeeded(p.currentStar, p.targetStar))
                      : 0;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between"
                        style={{
                          paddingTop: CARD_ROW_SPACING,
                          paddingBottom: CARD_ROW_SPACING,
                          borderTop: group.indexOf(p) > 0 ? "1px solid hsl(var(--border) / 0.5)" : undefined,
                        }}
                      >
                        <div className="text-xs text-muted-foreground">
                          {p.currentStar}★{lang === "en" ? "→" : " → "}{targetStar}★
                          {p.farmingMode === "star" && starModeExcess > 0 && (
                            p.targetStar >= 5
                              ? <span className="text-destructive"> {lang === "en" ? `${starModeExcess} ${t.calendar.excess}` : `${t.calendar.excess} ${starModeExcess} ${t.calendar.shards}`}</span>
                              : ` ${lang === "en" ? `${starModeExcess} ${t.calendar.remaining}` : `${t.calendar.remaining} ${starModeExcess} ${t.calendar.shards}`}`
                          )}
                          {p.farmingMode === "free" && remainingShards > 0 && (
                            isExcess
                              ? <span className="text-destructive"> {lang === "en" ? `${remainingShards} ${t.calendar.excess}` : `${t.calendar.excess} ${remainingShards} ${t.calendar.shards}`}</span>
                              : ` ${lang === "en" ? `${remainingShards} ${t.calendar.remaining}` : `${t.calendar.remaining} ${remainingShards} ${t.calendar.shards}`}`
                          )}
                          {" · "}{lang === "en" ? `${t.calendar.estimated} ${days}${t.calendar.days}` : `${t.calendar.estimated} ${days} ${t.calendar.days}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmt(startD)} - {fmt(endDate)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
