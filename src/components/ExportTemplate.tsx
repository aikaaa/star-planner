/**
 * ExportTemplate — 导出图片用的离屏渲染模板（固定浅色主题）
 * 用 html2canvas 截图，不影响页面可见区域。
 */

import { forwardRef, useState, useMemo } from "react";
import {
  CharacterPlan,
  formatCharName,
  getCharactersOnDate,
  getCompletionDate,
  getDaysNeeded,
  getEffectiveTargetStar,
  getPartialProgress,
  isDoubleDropDate,
  parseLocalDate,
} from "@/lib/types";
import { getAvatarUrl } from "@/lib/roleAvatars";
import { getEnName } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";

// ── 浅色主题硬编码色值 ────────────────────────────────────────────
const C = {
  bg:          "#f2f8f6",
  fg:          "#26403c",
  card:        "#ffffff",
  border:      "#cdd9d6",
  muted:       "#4e7069",
  primary:     "#316b62",
  primaryFg:   "#ffffff",
  star:        "#bc8a27",
  avatarBg:    "#c8dbd8",
  destructive: "#e84b4b",
  calCell:     "rgba(49, 107, 98, 0.08)",
  gradStart:   "#316b62",
  gradEnd:     "#2a6355",
};

const WEEKDAYS    = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── 占位头像背景色（按角色索引区分）────────────────────────────────
const FALLBACK_BG = [
  "#B0D6CA",
  "#B0CED6",
  "#B0BFD6",
  "#D6B0B1",
  "#DBD19D",
  "#D3B0D6",
];

// ── 通用占位图标（无头像时显示）────────────────────────────────────
function AvatarPlaceholder({ size, index }: { size: number; index: number }) {
  const bg = FALLBACK_BG[index % FALLBACK_BG.length];
  const iconSize = Math.round(size * 0.55);
  const offset = Math.round((size - iconSize) / 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, position: "relative", flexShrink: 0, overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: offset, left: offset }}>
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="rgba(255,255,255,0.55)" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8H4z"/>
        </svg>
      </div>
    </div>
  );
}

// ── 头像子组件（跨域 img + fallback 占位图标） ──────────────────────
function TemplateAvatar({ plan, size, index, onFallback }: { plan: CharacterPlan; size: number; index: number; onFallback?: (name: string) => void }) {
  const [failed, setFailed] = useState(false);
  const avatarUrl = getAvatarUrl(plan.name);

  if (avatarUrl && !failed) {
    return (
      <div style={{
        width: size, height: size, minWidth: size,
        borderRadius: "50%", overflow: "hidden",
        background: C.avatarBg, flexShrink: 0,
      }}>
        <img
          src={avatarUrl}
          alt={plan.name}
          crossOrigin="anonymous"
          onError={() => { setFailed(true); onFallback?.(plan.name); }}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  return <AvatarPlaceholder size={size} index={index} />;
}

// ── 小头像（日历格用） ──────────────
function CalAvatar({ plan, size, index, onFallback }: { plan: CharacterPlan; size: number; index: number; onFallback?: (name: string) => void }) {
  const [failed, setFailed] = useState(false);
  const avatarUrl = getAvatarUrl(plan.name);

  if (avatarUrl && !failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        overflow: "hidden", background: C.avatarBg, flexShrink: 0,
      }}>
        <img
          src={avatarUrl}
          crossOrigin="anonymous"
          onError={() => { setFailed(true); onFallback?.(plan.name); }}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }
  return <AvatarPlaceholder size={size} index={index} />;
}

// ── 主组件 ────────────────────────────────────────────────────────
export interface ExportTemplateProps {
  plans: CharacterPlan[];
  qrDataUrl: string | null;
  viewMonth?: Date;
}

const ExportTemplate = forwardRef<HTMLDivElement, ExportTemplateProps>(
  ({ plans, qrDataUrl, viewMonth }, ref) => {
    const { lang, t } = useI18n();
    const weekdays = lang === "en" ? WEEKDAYS_EN : WEEKDAYS;
    const charDisplayName = (zh: string) => lang === "en" ? getEnName(zh) : formatCharName(zh);
    const [failedAvatars, setFailedAvatars] = useState<Set<string>>(() => new Set());
    const handleAvatarFallback = (name: string) => {
      setFailedAvatars(prev => { const next = new Set(prev); next.add(name); return next; });
    };
    if (plans.length === 0) return null;

    // 日期范围
    const allDates = plans.flatMap(p => [
      parseLocalDate(p.startDate).getTime(),
      getCompletionDate(p).getTime(),
    ]);
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    const fmtShort = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const title = `我的跑片计划 · ${fmtShort(minDate)} - ${fmtShort(maxDate)}`;

    // 日历：使用用户当前浏览的月份（若未传则默认最早开始月）
    const calBase  = viewMonth ?? minDate;
    const calYear  = calBase.getFullYear();
    const calMonth = calBase.getMonth();
    const daysInMonth   = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();

    const today = new Date(); today.setHours(0, 0, 0, 0);

    // 阵容变动日集合（时间戳）
    const startDateSet = new Set(
      plans.map(p => { const d = parseLocalDate(p.startDate); d.setHours(0, 0, 0, 0); return d.getTime(); })
    );

    // 颜色索引：无头像或已加载失败的角色优先分配，与网页逻辑一致
    const charColorIndex = useMemo(() => {
      const fallbackChars: string[] = [];
      const withAvatarChars: string[] = [];
      const seen = new Set<string>();
      plans.forEach(p => {
        if (seen.has(p.name)) return;
        seen.add(p.name);
        if (!getAvatarUrl(p.name) || failedAvatars.has(p.name)) fallbackChars.push(p.name);
        else withAvatarChars.push(p.name);
      });
      const map = new Map<string, number>();
      fallbackChars.forEach((name, i) => map.set(name, i));
      withAvatarChars.forEach((name, i) => map.set(name, fallbackChars.length + i));
      return map;
    }, [plans, failedAvatars]);

    // 按开始时间排序，再按角色名分组
    const sorted = [...plans].sort((a, b) => {
      const sd = parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime();
      if (sd !== 0) return sd;
      return getCompletionDate(a).getTime() - getCompletionDate(b).getTime();
    });
    const groups = new Map<string, CharacterPlan[]>();
    for (const p of sorted) {
      if (!groups.has(p.name)) groups.set(p.name, []);
      groups.get(p.name)!.push(p);
    }

    return (
      <div
        ref={ref}
        style={{
          position: "fixed",
          left: -9999,
          top: 0,
          width: 430,
          background: C.bg,
          fontFamily: "'Noto Serif SC', 'Noto Serif', serif",
          color: C.fg,
          fontSize: 14,
          lineHeight: 1.5,
          overflow: "visible",
          zIndex: -1,
        }}
      >
        {/* ── 标题头部 ───────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${C.gradStart}, ${C.gradEnd})`,
          padding: "20px 20px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          {/* 左：标题 + 副标题 */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.2, letterSpacing: 0.5 }}>
              {t.exportTemplate.planTitle}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 8 }}>
              {t.exportTemplate.gameName}
            </div>
          </div>
          {/* 右：装饰 SVG + 日期区间 */}
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            {/* 日期区间 */}
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 0.3,
              lineHeight: 1,
              whiteSpace: "nowrap",
              marginBottom: 4,
            }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>✧ </span>
              <span style={{ color: "#fff" }}>{minDate.getFullYear()}/{fmtShort(minDate)} - {maxDate.getFullYear()}/{fmtShort(maxDate)}</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}> ✦</span>
            </div>
          </div>
        </div>

        {/* ── 内容区（白色圆角卡片上移覆盖绿色头部） ─── */}
        <div style={{
          margin: "0 10px",
          marginTop: -20,
          borderRadius: "4px 4px 0 0",
          background: C.bg,
          padding: "14px 10px 4px",
          position: "relative",
        }}>

          {/* 日历 */}
          <div style={{
            background: C.card,
            borderRadius: 4,
            padding: "8px 10px 10px",
            marginBottom: 10,
          }}>
            {/* 月份标题 */}
            <div style={{
              textAlign: "center", fontSize: 13, fontWeight: 600,
              color: C.fg, marginBottom: 6,
            }}>
              {lang === "en"
              ? `${new Date(calYear, calMonth).toLocaleString("en", { month: "long" })} ${calYear}`
              : `${calYear}年${calMonth + 1}月`}
            </div>

            {/* 星期 header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
              {weekdays.map(d => (
                <div key={d} style={{
                  textAlign: "center", fontSize: 11,
                  color: C.muted, padding: "1px 0", fontWeight: 500,
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* 日期格子 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day  = idx + 1;
                const date = new Date(calYear, calMonth, day);
                date.setHours(0, 0, 0, 0);
                const isToday     = date.getTime() === today.getTime();
                const isStartDate = startDateSet.has(date.getTime());
                const chars   = getCharactersOnDate(plans, date);
                const hasDoubleDrop = chars.some(c => isDoubleDropDate(c, date));
                const shown   = chars.slice(0, 6);
                const count   = shown.length;
                const avatarSize = Math.round(4 + 54 / Math.max(count, 1));
                const avPx = Math.min(14, avatarSize);
                const overlap = count > 1 ? -3 : 0;

                return (
                  <div
                    key={day}
                    style={{
                      position: "relative",
                      background: hasDoubleDrop ? `${C.star}22` : C.calCell,
                      borderRadius: 6,
                      minHeight: 42,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "3px 2px",
                      border: isToday ? `2px solid ${C.primary}` : "2px solid transparent",
                      boxSizing: "border-box",
                    }}
                  >
                    {isStartDate && (
                      <span style={{
                        position: "absolute", top: -1, right: 4,
                        fontSize: 8, lineHeight: 1, color: C.star,
                        display: "block",
                      }}>✦</span>
                    )}
                    <span style={{
                      fontSize: 11,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? C.primary : C.fg,
                      lineHeight: 1,
                    }}>
                      {isToday && lang === "cn" ? t.exportTemplate.todayLabel : day}
                    </span>
                    {count > 0 && (
                      <div style={{ display: "flex", marginTop: 5, justifyContent: "center", alignItems: "center" }}>
                        {shown.map((c, ci) => (
                          <div
                            key={c.id}
                            style={{
                              marginLeft: ci > 0 ? overlap : 0,
                              position: "relative",
                              zIndex: ci,
                              flexShrink: 0,
                            }}
                          >
                            <CalAvatar plan={c} size={avPx} index={charColorIndex.get(c.name) ?? 0} onFallback={handleAvatarFallback} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 图例说明 */}
            <div style={{ marginTop: 8, fontSize: 10, color: "#888", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 10, lineHeight: 1, color: C.star }}>✦</span>
                {t.exportTemplate.rosterChangeDay}
              </span>
              {plans.some(p => p.doubleDropStart && p.doubleDropEnd) && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 14, lineHeight: 1, color: C.star }}>▪</span>
                  {t.exportTemplate.doubleDropDay}
                </span>
              )}
            </div>
          </div>

          {/* 计划卡片 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...groups.entries()].map(([name, group], gi) => {
              const first = group[0];

              // 头部右侧星级摘要（提前计算，避免 IIFE 内 JSX 渲染不稳）
              const headerStar = (() => {
                if (group.length === 1) {
                  const p    = group[0];
                  if (p.farmingMode === "free") {
                    const s = parseLocalDate(p.startDate); s.setHours(0, 0, 0, 0);
                    const daysElapsed = Math.max(0, Math.round((today.getTime() - s.getTime()) / 86400000)) + 1;
                    const { reachableStar, remainingShards } = getPartialProgress(
                      p.currentStar, p.currentShards + (p.bonusShards ?? 0), daysElapsed
                    );
                    return {
                      from: p.currentStar,
                      to:   reachableStar,
                      shards: remainingShards,
                      excess: reachableStar >= 5 && remainingShards > 0,
                    };
                  }
                  return { from: p.currentStar, to: getEffectiveTargetStar(p), shards: 0, excess: false };
                }
                return {
                  from:  group[0].currentStar,
                  to:    getEffectiveTargetStar(group[group.length - 1]),
                  shards: 0,
                  excess: false,
                };
              })();

              return (
                <div
                  key={name}
                  style={{
                    background: C.card,
                    borderRadius: 4,
                    padding: "10px 12px 8px",
                  }}
                >
                  {/* 卡片头：头像 + 角色名（左）｜ 星级摘要（右）
                      float + lineHeight 方案，html2canvas 兼容性最好 */}
                  <div style={{
                    overflow: "hidden",
                    lineHeight: "28px",
                    paddingBottom: 8,
                    borderBottom: `1px solid ${C.border}80`,
                  }}>
                    {/* 右：先声明 float:right，让文字在 28px 行高里自然居中 */}
                    <span style={{ float: "right", fontSize: 12, color: "#B29756", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {headerStar.from}★ → {headerStar.to}★
                      {headerStar.shards > 0 && (
                        lang === "en" ? (
                          headerStar.excess
                            ? <span style={{ color: C.destructive }}> {headerStar.shards} Excess</span>
                            : <span> {headerStar.shards} Left</span>
                        ) : (
                          headerStar.excess
                            ? <span style={{ color: C.destructive }}> 超{headerStar.shards}片</span>
                            : <span> 余{headerStar.shards}片</span>
                        )
                      )}
                    </span>
                    {/* 左：头像 + 名字 */}
                    <span style={{ display: "inline-block", verticalAlign: "middle", fontSize: 0 }}>
                      <span style={{ display: "inline-block", verticalAlign: "middle" }}>
                        <TemplateAvatar plan={first} size={28} index={charColorIndex.get(name) ?? 0} onFallback={handleAvatarFallback} />
                      </span>
                      <span style={{ display: "inline-block", verticalAlign: "middle", fontSize: 13, fontWeight: 600, lineHeight: 1, marginLeft: 8 }}>
                        {charDisplayName(name)}
                      </span>
                    </span>
                  </div>

                  {/* 计划行：左「预计X天」｜ 右「M/D - M/D」 */}
                  {group.map((p, pi) => {
                    const days   = getDaysNeeded(p);
                    const endDate = getCompletionDate(p);
                    const startD  = parseLocalDate(p.startDate);
                    const fmt     = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

                    return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: 4,
                          paddingBottom: 4,
                          borderTop: undefined,
                          fontSize: 12,
                          color: C.muted,
                        }}
                      >
                        <div>{lang === "en" ? `ETA ${days}d` : `预计 ${days} 天`}</div>
                        <div>{fmt(startD)} – {fmt(endDate)}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 底部：来源标注 + 二维码 ─────────────────────────────── */}
        <div style={{
          padding: "8px 20px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}>
          {/* 左：平台标注 + 工具名胶囊 + 提示语 */}
          <div>
            {/* 第一行：平台 · 工具名 */}
            <div style={{ fontSize: 12, lineHeight: 1 }}>
              <span style={{ color: C.muted }}>{t.exportTemplate.footerPlatform}</span>
              <span style={{ color: C.border, margin: "0 5px" }}>·</span>
              <span style={{ color: C.primary, fontWeight: 700 }}>{t.exportTemplate.footerTool}</span>
            </div>
            {/* 第二行：提示语 */}
            <div style={{ fontSize: 10, color: "#4E736E", marginTop: 8 }}>
              {t.exportTemplate.footerHint}
            </div>
          </div>

          {/* 右：二维码（直角，不裁切，确保 jsQR 可识别） */}
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR"
              style={{ width: 72, height: 72, display: "block", flexShrink: 0 }}
            />
          )}
        </div>
      </div>
    );
  }
);

ExportTemplate.displayName = "ExportTemplate";
export default ExportTemplate;
