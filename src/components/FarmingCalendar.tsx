import { useMemo, useState, useEffect } from "react";
import { CharacterPlan, formatCharName, getCharactersOnDate, getCompletionDate, getDaysNeeded, getEffectiveTargetStar, getPartialProgress, parseLocalDate, CHAR_ICON_OPTIONS } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAvatarUrl } from "@/lib/roleAvatars";
import { CARD_SPACING } from "@/lib/cardSpacing";
import { fetchRemoteRoles } from "@/lib/roles";

interface FarmingCalendarProps {
  plans: CharacterPlan[];
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

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
 * 角色头像组件：优先显示游戏头像图片，加载失败或无图片时降级为 emoji。
 * size: CSS 尺寸字符串，如 "20px"
 */
function CharAvatar({
  plan,
  index,
  size = "20px",
  className = "",
}: {
  plan: CharacterPlan;
  index: number;
  size?: string;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
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
          onError={() => setImgFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  return (
    <div
      title={plan.name}
      className={`rounded-full flex items-center justify-center font-medium relative ${className}`}
      style={{
        ...baseStyle,
        fontSize: fontSizeStr,
        background: "var(--avatar-circle-bg)",
        color: "hsl(var(--muted-foreground))",
      }}
    >
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
        <circle cx="50%" cy="50%" r="49%" stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" strokeWidth="1" fill="none" />
      </svg>
      {plan.name.charAt(0)}
    </div>
  );
}

export default function FarmingCalendar({ plans }: FarmingCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [, setRolesLoaded] = useState(false);

  // 远程角色列表加载完成后强制重渲染，确保头像 URL 使用最新数据
  useEffect(() => {
    fetchRemoteRoles().then(() => setRolesLoaded(true));
  }, []);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
          {year}年{month + 1}月
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
              <CharAvatar plan={plan} index={plans.findIndex(p => p.name === name)} size="24px" />
              <span>{formatCharName(name)}</span>
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
        {WEEKDAYS.map((d) => (
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
          const isToday = date.getTime() === today.getTime();
          const hasChars = characters.length > 0;

          return (
            <div
              key={day}
              className={`relative flex flex-col items-center justify-center p-2 text-xs transition-all`}
              style={{ backgroundColor: "hsl(var(--primary) / 0.08)", minHeight: "3.5rem", borderRadius: "8px" }}
            >
              {isToday && (
                <span className="absolute inset-0 pointer-events-none z-10" style={{ boxShadow: "inset 0 0 0 2px hsl(var(--primary))", borderRadius: "8px" }} />
              )}
              <span className={`text-xs sm:text-xs leading-none ${isToday ? "font-bold text-primary" : "text-foreground"}`}>
                {day}
              </span>
              {hasChars && (() => {
                const shown = characters.slice(0, 3);
                const count = shown.length;
                // 方案A：每个头像占格子宽度的 1/count，最大 22px
                // 用 CSS 变量控制容器，每个头像撑满自己的槽
                const slotSize = `min(22px, calc((min(100vw, 600px) - 48px) / ${7 * count}))`;
                const overlap = count === 3 ? "-4px" : count === 2 ? "-2px" : "0px";
                return (
                  <div className="flex mt-0.5 justify-center items-center">
                    {shown.map((c, ci) => {
                      const idx = plans.findIndex((p) => p.id === c.id);
                      return (
                        <div key={c.id} style={{ width: slotSize, height: slotSize, flexShrink: 0, fontSize: slotSize, marginLeft: ci > 0 ? overlap : 0, zIndex: ci, position: "relative" }}>
                          <CharAvatar plan={c} index={idx} size="100%" />
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
              const firstIdx = plans.findIndex((p) => p.id === first.id);
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
                const { reachableStar, remainingShards } = getPartialProgress(activeToday.currentStar, activeToday.currentShards + (activeToday.bonusShards ?? 0), daysElapsed);
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
                      <CharAvatar plan={first} index={firstIdx} size="32px" />
                      <span className="font-semibold text-foreground text-sm">{formatCharName(name)}</span>
                    </div>
                    {todayInfo && (
                      <div className="text-xs text-muted-foreground">
                        今日可达{" "}
                        {todayInfo.isExcess ? (
                          <>
                            <span className="text-star font-bold">5★ 满星</span>
                            <span className="text-destructive font-bold"> 超 {todayInfo.remainingShards} 片</span>
                          </>
                        ) : todayInfo.reachableStar >= 5 ? (
                          <span className="text-star font-bold">5★ 满星</span>
                        ) : (
                          <span className="text-star font-bold">{todayInfo.reachableStar}★ 余 {todayInfo.remainingShards} 片</span>
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
                    const { remainingShards, reachableStar } = p.farmingMode === "free"
                      ? getPartialProgress(p.currentStar, p.currentShards + (p.bonusShards ?? 0), days)
                      : { remainingShards: 0, reachableStar: targetStar };
                    const isExcess = reachableStar >= 5 && remainingShards > 0;
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
                          {p.currentStar}★ → {targetStar}★
                          {p.farmingMode === "free" && remainingShards > 0 && (
                            isExcess
                              ? <span className="text-destructive"> 超 {remainingShards} 片</span>
                              : ` 余 ${remainingShards} 片`
                          )}
                          {" · "}预计 {days} 天
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
