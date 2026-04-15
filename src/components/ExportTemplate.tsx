/**
 * ExportTemplate — 导出图片用的离屏渲染模板（固定浅色主题）
 * 用 html2canvas 截图，不影响页面可见区域。
 */

import { forwardRef, useState } from "react";
import {
  CharacterPlan,
  formatCharName,
  getCharactersOnDate,
  getCompletionDate,
  getDaysNeeded,
  getEffectiveTargetStar,
  getPartialProgress,
  parseLocalDate,
} from "@/lib/types";
import { getAvatarUrl } from "@/lib/roleAvatars";

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

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// ── 头像子组件（跨域 img + fallback 首字） ────────────────────────
function TemplateAvatar({ plan, size }: { plan: CharacterPlan; size: number }) {
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
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, minWidth: size,
      borderRadius: "50%", background: C.avatarBg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.42), color: C.muted,
      fontWeight: 500, flexShrink: 0,
    }}>
      {plan.name.charAt(0)}
    </div>
  );
}

// ── 小头像（日历格用，不维护 failed state，直接 img） ──────────────
function CalAvatar({ plan, size }: { plan: CharacterPlan; size: number }) {
  const avatarUrl = getAvatarUrl(plan.name);
  if (avatarUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        overflow: "hidden", background: C.avatarBg, flexShrink: 0,
      }}>
        <img
          src={avatarUrl}
          crossOrigin="anonymous"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: C.avatarBg, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: Math.round(size * 0.5), color: C.muted, flexShrink: 0,
    }}>
      {plan.name.charAt(0)}
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────
export interface ExportTemplateProps {
  plans: CharacterPlan[];
  qrDataUrl: string | null;
}

const ExportTemplate = forwardRef<HTMLDivElement, ExportTemplateProps>(
  ({ plans, qrDataUrl }, ref) => {
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

    // 日历：从最早的开始月份起
    const calYear  = minDate.getFullYear();
    const calMonth = minDate.getMonth();
    const daysInMonth   = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();

    const today = new Date(); today.setHours(0, 0, 0, 0);

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
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.2, letterSpacing: 0.5 }}>
              我的跑片计划
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
              铃兰之剑：为这和平的世界
            </div>
          </div>
          {/* 右：日期区间，方括号金色，日期白色，不折行 */}
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.3,
            flexShrink: 0,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}>
            <span style={{ color: "#BDAB7F" }}>[</span>
            <span style={{ color: "#fff" }}> {minDate.getFullYear()}/{fmtShort(minDate)} - {maxDate.getFullYear()}/{fmtShort(maxDate)} </span>
            <span style={{ color: "#BDAB7F" }}>]</span>
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
              {calYear}年{calMonth + 1}月
            </div>

            {/* 星期 header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
              {WEEKDAYS.map(d => (
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
                const isToday = date.getTime() === today.getTime();
                const chars   = getCharactersOnDate(plans, date);
                const shown   = chars.slice(0, 3);
                const count   = shown.length;
                const overlap = count === 3 ? -3 : count === 2 ? -2 : 0;

                return (
                  <div
                    key={day}
                    style={{
                      position: "relative",
                      background: C.calCell,
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
                    <span style={{
                      fontSize: 11,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? C.primary : C.fg,
                      lineHeight: 1,
                    }}>
                      {isToday ? "今" : day}
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
                            <CalAvatar plan={c} size={14} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 计划卡片 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...groups.entries()].map(([name, group]) => {
              const first = group[0];

              // 头部右侧星级摘要（提前计算，避免 IIFE 内 JSX 渲染不稳）
              const headerStar = (() => {
                if (group.length === 1) {
                  const p    = group[0];
                  const days = getDaysNeeded(p);
                  if (p.farmingMode === "free") {
                    const { reachableStar, remainingShards } = getPartialProgress(
                      p.currentStar, p.currentShards + (p.bonusShards ?? 0), days
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
                    padding: "10px 12px 2px",
                  }}
                >
                  {/* 卡片头：头像 + 角色名（左）｜ 星级摘要（右） */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 8,
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    {/* 左：头像 + 名字（用 height 锚定，避免 html2canvas 对齐偏差） */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 28 }}>
                      <TemplateAvatar plan={first} size={28} />
                      <span style={{ fontWeight: 600, fontSize: 13, lineHeight: "1", alignSelf: "center" }}>
                        {formatCharName(name)}
                      </span>
                    </div>
                    {/* 右：星级摘要，全部绿色 */}
                    <span style={{ fontSize: 12, color: C.primary, fontWeight: 600, flexShrink: 0 }}>
                      {headerStar.from}★ → {headerStar.to}★
                      {headerStar.shards > 0 && (
                        headerStar.excess
                          ? <span style={{ color: C.destructive }}> 超{headerStar.shards}片</span>
                          : <span> 余{headerStar.shards}片</span>
                      )}
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
                          paddingTop: 8,
                          paddingBottom: 8,
                          borderTop: pi > 0 ? `1px solid ${C.border}` : undefined,
                          fontSize: 12,
                          color: C.muted,
                        }}
                      >
                        <div>预计 {days} 天</div>
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
            {/* 第一行：平台 + 工具名胶囊 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: C.muted }}>TapTap 游戏工具</span>
              {/* 胶囊标签 */}
              <button style={{
                background: C.primary,
                border: "none",
                borderRadius: 4,
                padding: "3px 8px",
                fontSize: 11,
                color: "#fff",
                fontWeight: 600,
                letterSpacing: 0.2,
                cursor: "default",
                fontFamily: "'Noto Serif SC', 'Noto Serif', serif",
              }}>
                ◆ 铃兰跑片助手
              </button>
            </div>
            {/* 第二行：提示语 */}
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ color: C.primary, fontSize: 8 }}>◆</span>
              <span>保存图片，可直接导入计划</span>
            </div>
          </div>

          {/* 右：二维码 */}
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR"
              style={{ width: 72, height: 72, borderRadius: 8, flexShrink: 0 }}
            />
          )}
        </div>
      </div>
    );
  }
);

ExportTemplate.displayName = "ExportTemplate";
export default ExportTemplate;
