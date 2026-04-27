import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Flame, Upload, Download, Copy, Sun, Moon, ArrowRight, Sparkles, RotateCcw, ImageDown, X, CircleHelp } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import FarmingCalendar from "@/components/FarmingCalendar";
import SetPlanDialog from "@/components/SetPlanDialog";
import CommunityDialog from "@/components/CommunityDialog";
import ExportImportPanel, { ExportImportHandle } from "@/components/ExportImportPanel";
import { CharacterPlan, COMMUNITY_TOP_CHARACTERS, getCompletionDate, getEffectiveTargetStar } from "@/lib/types";
import { fetchCommunityTop10, reportFarmingCharacters, type CommunityCharacter } from "@/lib/communityStats";
import { fetchRemoteRoles } from "@/lib/roles";
import { encodeSoc } from "@/lib/socExport";
import { generateUUID } from "@/lib/supabase";
import { toast } from "@/components/ui/sonner";

const STORAGE_KEY = "shard-farming-plans";

function loadPlans(): CharacterPlan[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export default function Index() {
  const [plans, setPlans] = useState<CharacterPlan[]>(loadPlans);
  const [showSetPlan, setShowSetPlan] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { t, lang, toggleLang } = useI18n();
  const [rolesReady, setRolesReady] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportImportRef = useRef<ExportImportHandle>(null);
  const [previewChars, setPreviewChars] = useState<CommunityCharacter[]>([]);
  const [calViewMonth, setCalViewMonth] = useState(() => new Date());
  const [showFeedback, setShowFeedback] = useState(false);

  const handleCopyCode = async () => {
    if (isCopying) return;
    setIsCopying(true);
    try {
      const code = encodeSoc(plans);
      let copied = false;
      // 优先用 Clipboard API
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(code);
          copied = true;
        } catch { /* 降级 */ }
      }
      // 降级：execCommand
      if (!copied) {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand("copy");
        document.body.removeChild(ta);
      }
      if (copied) {
        toast.success(t.toast.copySuccess);
      } else {
        toast.error(t.toast.copyFail);
      }
    } catch (e) {
      console.error("[copy]", e);
      toast.error(t.toast.copyFail2);
    } finally {
      setIsCopying(false);
    }
  };

  useEffect(() => {
    fetchRemoteRoles().then(() => setRolesReady(true)).catch(() => setRolesReady(true));
  }, []);

  // 无计划时拉取社区 Top3，供一键试配使用（随服务器切换）
  useEffect(() => {
    if (plans.length > 0) return;
    const server = lang === "en" ? "gl" : "cn";
    fetchCommunityTop10(server).then(result => {
      if (result && result.data.length > 0) setPreviewChars(result.data.slice(0, 3));
      else setPreviewChars([]);
    }).catch(() => {});
  }, [plans.length, lang]);

  // 一键试配：加载热门计划，不上报排行
  const handleQuickTry = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const chars = previewChars.length > 0
      ? previewChars
      : COMMUNITY_TOP_CHARACTERS.slice(0, 3).map(c => ({ name: c.name, topTargetStar: 5 as number }));
    const trialPlans: CharacterPlan[] = chars.map((c, i) => ({
      id: generateUUID(),
      name: c.name,
      farmingMode: "star" as const,
      currentStar: Math.max(0, (c.topTargetStar ?? 5) - 2) as 0 | 1 | 2 | 3 | 4 | 5,
      targetStar: (c.topTargetStar ?? 5) as 1 | 2 | 3 | 4 | 5,
      currentShards: 0,
      startDate: todayStr,
    }));
    // 直接 setPlans，不调用 handleSavePlans，避免上报排行
    setPlans(trialPlans);
    toast.success(t.toast.trialLoaded);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  const handleSavePlans = (newPlans: CharacterPlan[]) => {
    setPlans(newPlans);
    reportFarmingCharacters(
      newPlans.map((p) => ({
        name: p.name,
        targetStar: getEffectiveTargetStar(p),
        startDate: p.startDate,
        endDate: getCompletionDate(p).toISOString().slice(0, 10),
      })),
      lang === "en" ? "gl" : "cn"
    );
  };


  if (!rolesReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary pt-[27px] pb-[27px] sm:py-[35px] text-center relative">
        <div className="mx-auto px-4 grid items-center mb-1" style={{ maxWidth: "600px", gridTemplateColumns: "1fr auto 1fr" }}>
          <div className="flex items-center justify-start" style={{ position: "relative" }}>
            <button
              onClick={() => setShowServerMenu(v => !v)}
              onBlur={() => setTimeout(() => setShowServerMenu(false), 150)}
              className="px-2 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground transition-colors text-xs font-bold leading-none flex items-center gap-1"
              style={{ height: 32 }}
              aria-label="切换服务器/语言"
            >
              <span>{lang === "cn" ? "CN" : "GL"}</span>
              <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
            </button>
            {showServerMenu && (
              <div
                className="absolute top-9 left-0 rounded-lg border border-border bg-popover shadow-lg overflow-hidden z-50"
                style={{ minWidth: 130 }}
              >
                <button
                  onClick={() => { if (lang !== "cn") toggleLang(); setShowServerMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                  style={{ color: lang === "cn" ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}
                >
                  <span>CN</span>
                  <span className="text-xs opacity-60 ml-3">国服</span>
                </button>
                <div className="border-t border-border" />
                <button
                  onClick={() => { if (lang !== "en") toggleLang(); setShowServerMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                  style={{ color: lang === "en" ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}
                >
                  <span>GL</span>
                  <span className="text-xs opacity-60 ml-3">Waifu</span>
                </button>
              </div>
            )}
          </div>
          <h1 className={`${lang === "en" ? "text-base sm:text-2xl" : "text-xl sm:text-2xl"} font-bold text-primary-foreground whitespace-nowrap`} style={{ display: "flex", alignItems: "center" }}>
            <span className="text-lg sm:text-base" style={{ opacity: 0.4, fontWeight: 400, lineHeight: 1, marginRight: 7}}>✦</span>
            <span style={lang === "cn" ? { letterSpacing: "0.1em" } : undefined}>{t.app.title}</span>
            <span className="text-lg sm:text-base" style={{ opacity: 0.4, fontWeight: 400, lineHeight: 1, marginLeft: 5 }}>✧</span>
          </h1>
          <div className="flex items-center justify-end">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground transition-colors"
              aria-label="切换主题"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <p className="text-primary-foreground/70 text-xs sm:text-sm" style={{ marginTop: -2 }}>{t.app.subtitle}</p>
      </header>

      {/* Action buttons */}
      <div className="mx-auto px-4 flex gap-3 relative z-10 -mt-[19px] sm:-mt-[21px]" style={{ maxWidth: "600px" }}>
        <Button
          className="flex-1 gradient-card border border-border text-foreground hover:text-foreground active:text-foreground hover:glow-primary h-12 font-semibold"
          style={{ borderRadius: "4px" }}
          variant="ghost"
          onClick={() => setShowSetPlan(true)}
        >
          <Settings className="mr-2 h-4 w-4" />
          {t.actions.setPlan}
        </Button>
        <Button
          className="flex-1 gradient-card border border-border text-foreground hover:text-foreground active:text-foreground hover:glow-primary h-12 font-semibold"
          style={{ borderRadius: "4px" }}
          variant="ghost"
          onClick={() => setShowCommunity(true)}
        >
          <Flame className="mr-2 h-4 w-4" style={{ color: "#f97316" }} />
          {t.actions.community}
        </Button>
      </div>

      {/* Calendar + Export/Import */}
      <div className="mx-auto px-4 sm:pb-8" style={{ maxWidth: "600px", paddingTop: "12px" }}>
        {plans.length === 0 ? (
          /* 未配置：空状态卡片 */
          <div className="gradient-card border border-border text-center" style={{ borderRadius: "4px", padding: "48px 32px 120px" }}>
            <div className="text-4xl mb-3">📋</div>
            <p className="text-muted-foreground text-sm">{t.empty.noPlan}</p>
            <div className="flex justify-center" style={{ gap: 12, marginTop: 32 }}>
              <Button
                variant="outline"
                className="text-sm h-10 px-5"
                style={{ borderRadius: 4, background: "hsl(var(--card))" }}
                onClick={() => exportImportRef.current?.openImport()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t.actions.importPlan}
              </Button>
              <div style={{ position: "relative" }}>
                <Button
                  className="gradient-primary text-primary-foreground text-sm h-10 px-5 glow-primary"
                  style={{ borderRadius: 4 }}
                  onClick={handleQuickTry}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t.actions.trialPlan}
                </Button>
                <span style={{
                  position: "absolute", top: -6, right: -4,
                  background: "#e84b4b", color: "#fff",
                  fontSize: 10, fontWeight: 700, lineHeight: 1,
                  padding: "2px 4px", borderRadius: 3,
                  pointerEvents: "none",
                }}>{t.actions.newBadge}</span>
              </div>
            </div>
          </div>
        ) : (
          /* 已配置：日历卡片 + 卡片下方右对齐的操作按钮 */
          <div className="gradient-card border border-border" style={{ paddingTop: "8px", paddingLeft: "12px", paddingRight: "12px", paddingBottom: "16px", borderRadius: "4px" }}>
            <FarmingCalendar plans={plans} viewMonth={calViewMonth} onViewMonthChange={setCalViewMonth} />
            <div className="flex flex-col gap-2" style={{ marginTop: 12 }}>
              {/* 第一行：截图保存 */}
              <Button
                size="sm"
                className="w-full gradient-primary text-primary-foreground text-xs h-8"
                style={{ borderRadius: 4 }}
                disabled={isExporting}
                onClick={() => exportImportRef.current?.startExport()}
              >
                {isExporting
                  ? <div className="mr-1.5 h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  : <ImageDown className="mr-1.5 h-3.5 w-3.5" />}
                {isExporting ? t.actions.generating : t.actions.screenshot}
              </Button>
              {/* 第二行：复制计划码 */}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8"
                style={{ borderRadius: 4 }}
                disabled={isCopying}
                onClick={handleCopyCode}
              >
                {isCopying
                  ? <div className="mr-1.5 h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                {t.actions.copyCode}
              </Button>
              {/* 第三行：重置 + 导入计划 */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8"
                  style={{ borderRadius: 4 }}
                  onClick={() => { setPlans([]); setTimeout(() => toast.success(t.toast.resetDone), 50); }}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  {t.actions.reset}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8"
                  style={{ borderRadius: 4 }}
                  onClick={() => exportImportRef.current?.openImport()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {t.actions.importPlan}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 弹窗 + 离屏模板（无可见 UI） */}
        <ExportImportPanel ref={exportImportRef} plans={plans} onImport={handleSavePlans} onExportingChange={setIsExporting} viewMonth={calViewMonth} />

      </div>

      <div className="sm:fixed sm:z-30 sm:right-4 sm:bottom-6 flex justify-end sm:p-0 sm:m-0 mx-auto px-4" style={{ maxWidth: "600px", marginTop: 24, marginBottom: 32 }}>
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowFeedback(true)}
        >
          <span>{t.feedback.title}</span>
          <CircleHelp className="h-4 w-4 shrink-0" />
        </button>
      </div>

      <SetPlanDialog open={showSetPlan} onOpenChange={setShowSetPlan} existingPlans={plans} onSave={handleSavePlans} />
      <CommunityDialog open={showCommunity} onOpenChange={setShowCommunity} />

      {/* 问题反馈弹窗 */}
      {showFeedback && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowFeedback(false); }}
        >
          <div
            className="bg-card text-card-foreground w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-2xl"
            style={{ border: "1px solid hsl(var(--border))" }}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3"
              style={{ borderBottom: "1px solid hsl(var(--border) / 0.6)" }}>
              <span className="font-semibold text-sm">{t.feedback.title}</span>
              <button
                onClick={() => setShowFeedback(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4" style={{ paddingTop: 12, paddingBottom: 16 }}>
              <p className="text-muted-foreground" style={{ fontSize: 14, marginBottom: 8 }}>{t.feedback.desc}</p>
              <div className="grid grid-cols-2 gap-3">
                {/* 邮箱反馈 */}
                <div className="flex flex-col items-center rounded-xl"
                  style={{ background: "hsl(var(--background))", padding: "12px 12px 16px", borderRadius: 4, gap: 2 }}>
                  <span className="text-2xl">✉️</span>
                  <span className="font-medium text-foreground text-center" style={{ fontSize: 14 }}>{t.feedback.sendEmail}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-3 w-full mt-auto"
                    style={{ borderRadius: 4, marginTop: 4 }}
                    onClick={async () => {
                      const email = "707953365@qq.com";
                      let copied = false;
                      if (navigator.clipboard?.writeText) {
                        try { await navigator.clipboard.writeText(email); copied = true; } catch { /* fallback */ }
                      }
                      if (!copied) {
                        const ta = document.createElement("textarea");
                        ta.value = email;
                        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
                        document.body.appendChild(ta); ta.focus(); ta.select();
                        copied = document.execCommand("copy");
                        document.body.removeChild(ta);
                      }
                      copied ? toast.success(t.toast.copySuccess) : toast.error(t.toast.copyFail);
                    }}
                  >
                    {t.feedback.copyEmail}
                  </Button>
                </div>

                {/* 私信作者 */}
                <div className="flex flex-col items-center rounded-xl"
                  style={{ background: "hsl(var(--background))", padding: "12px 12px 16px", borderRadius: 4, gap: 2 }}>
                  <span className="text-2xl">💬</span>
                  <span className="font-medium text-foreground text-center" style={{ fontSize: 14 }}>{t.feedback.dmAuthor}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-3 w-full mt-auto"
                    style={{ borderRadius: 4, marginTop: 4 }}
                    onClick={() => window.open("https://www.taptap.cn/user/735086541", "_blank")}
                  >
                    {t.feedback.aika}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
