import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Flame, Upload, Download, Copy, Sun, Moon, ArrowRight, ScanEye } from "lucide-react";
import { useTheme } from "@/lib/theme";
import FarmingCalendar from "@/components/FarmingCalendar";
import SetPlanDialog from "@/components/SetPlanDialog";
import CommunityDialog from "@/components/CommunityDialog";
import ExportImportPanel, { ExportImportHandle } from "@/components/ExportImportPanel";
import { CharacterPlan, COMMUNITY_TOP_CHARACTERS, getCompletionDate, getEffectiveTargetStar, parseLocalDate } from "@/lib/types";
import { fetchCommunityTop10, reportFarmingCharacters, type CommunityCharacter } from "@/lib/communityStats";
import { fetchRemoteRoles } from "@/lib/roles";
import { encodeSoc } from "@/lib/socExport";
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
  const { theme, toggleTheme } = useTheme();
  const [rolesReady, setRolesReady] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportImportRef = useRef<ExportImportHandle>(null);
  const [previewChars, setPreviewChars] = useState<CommunityCharacter[]>([]);

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
        toast.success("复制成功");
      } else {
        toast.error("复制失败，请手动复制");
      }
    } catch (e) {
      console.error("[copy]", e);
      toast.error("复制失败，请重试");
    } finally {
      setIsCopying(false);
    }
  };

  useEffect(() => {
    fetchRemoteRoles().then(() => setRolesReady(true)).catch(() => setRolesReady(true));
  }, []);

  // 无计划时拉取社区 Top3 作为示例预览数据
  useEffect(() => {
    if (plans.length > 0) return;
    fetchCommunityTop10().then(result => {
      if (result && result.data.length > 0) setPreviewChars(result.data.slice(0, 3));
    }).catch(() => {});
  }, [plans.length]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  const handleSavePlans = (newPlans: CharacterPlan[]) => {
    setPlans(newPlans);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today); in7Days.setDate(today.getDate() + 7);
    reportFarmingCharacters(
      newPlans
        .filter((p) => {
          const start = parseLocalDate(p.startDate);
          const end = getCompletionDate(p);
          return start <= in7Days && end >= today;
        })
        .map((p) => ({ name: p.name, targetStar: getEffectiveTargetStar(p) }))
    );
  };

  // 示例计划：社区 Top3（或 fallback 静态数据），从今天开始
  const previewPlans = useMemo<CharacterPlan[]>(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const chars = previewChars.length > 0
      ? previewChars
      : COMMUNITY_TOP_CHARACTERS.slice(0, 3).map(c => ({ name: c.name, topTargetStar: 5 as number }));
    return chars.map((c, i) => ({
      id: `preview-${i}`,
      name: c.name,
      farmingMode: "star" as const,
      currentStar: Math.max(0, (c.topTargetStar ?? 5) - 2) as 0 | 1 | 2 | 3 | 4 | 5,
      targetStar: (c.topTargetStar ?? 5) as 1 | 2 | 3 | 4 | 5,
      currentShards: 0,
      startDate: todayStr,
    }));
  }, [previewChars]);

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
      <header className="gradient-primary px-4 py-6 sm:py-8 text-center relative">
        <button
          onClick={toggleTheme}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground transition-colors"
          aria-label="切换主题"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="flex items-center justify-center gap-2 mb-1">
          <h1 className="text-xl sm:text-2xl font-bold text-primary-foreground">铃兰跑片助手</h1>
        </div>
        <p className="text-primary-foreground/70 text-xs sm:text-sm">管理你的角色碎片养成进度</p>
      </header>

      {/* Action buttons */}
      <div className="mx-auto px-4 -mt-4 flex gap-3 relative z-10" style={{ maxWidth: "600px" }}>
        <Button
          className="flex-1 gradient-card border border-border text-foreground hover:text-foreground active:text-foreground hover:glow-primary h-12 font-semibold"
          style={{ borderRadius: "4px" }}
          variant="ghost"
          onClick={() => setShowSetPlan(true)}
        >
          <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
          设置跑片
        </Button>
        <Button
          className="flex-1 gradient-card border border-border text-foreground hover:text-foreground active:text-foreground hover:glow-primary h-12 font-semibold"
          style={{ borderRadius: "4px" }}
          variant="ghost"
          onClick={() => setShowCommunity(true)}
        >
          <Flame className="mr-2 h-4 w-4" style={{ color: "#f97316" }} />
          大家在跑谁
        </Button>
      </div>

      {/* Calendar + Export/Import */}
      <div className="mx-auto px-4" style={{ maxWidth: "600px", paddingTop: "12px", paddingBottom: "32px" }}>
        {plans.length === 0 ? (
          /* 未配置：示例预览卡片 */
          <div className="gradient-card border border-border" style={{ paddingTop: "8px", paddingLeft: "12px", paddingRight: "12px", paddingBottom: "12px", borderRadius: "4px" }}>
            {/* 示例标签（不受遮罩影响） */}
            <div className="flex items-center justify-between mb-1">
              <div style={{ background: "hsl(var(--primary) / 0.08)", borderRadius: 2, padding: "1px 12px", textAlign: "left", width: "100%" }}>
                <span className="text-foreground inline-flex items-center gap-1" style={{ fontSize: 12 }}>
                  <ScanEye style={{ width: 12, height: 12, flexShrink: 0 }} />
                  示例预览 · 基于当前社区热门角色
                </span>
              </div>
            </div>
            {/* 预览日历（半透明） */}
            <div style={{ opacity: 0.55, pointerEvents: "none", userSelect: "none" }}>
              <FarmingCalendar plans={previewPlans} />
            </div>
            {/* 底部按钮（不受遮罩影响） */}
            <div className="flex gap-2" style={{ justifyContent: "space-between", marginTop: 16 }}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                style={{ borderRadius: 4 }}
                onClick={() => exportImportRef.current?.openImport()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                导入计划
              </Button>
              <Button
                size="sm"
                className="gradient-primary text-primary-foreground text-xs h-8 glow-primary hover:opacity-90"
                style={{ borderRadius: 4 }}
                onClick={() => setShowSetPlan(true)}
              >
                开始设置
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          /* 已配置：日历卡片 + 卡片下方右对齐的操作按钮 */
          <div className="gradient-card border border-border" style={{ paddingTop: "8px", paddingLeft: "12px", paddingRight: "12px", paddingBottom: "12px", borderRadius: "4px" }}>
            <FarmingCalendar plans={plans} />
            <div className="flex gap-2" style={{ justifyContent: "space-between", marginTop: 16 }}>
              {/* 左：导入计划 */}
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                style={{ borderRadius: 4 }}
                onClick={() => exportImportRef.current?.openImport()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                导入计划
              </Button>
              {/* 右：复制计划码 + 导出/分享 */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  style={{ borderRadius: 4 }}
                  disabled={isCopying}
                  onClick={handleCopyCode}
                >
                  {isCopying
                    ? <div className="mr-1.5 h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  复制计划码
                </Button>
                <Button
                  size="sm"
                  className="gradient-primary text-primary-foreground text-xs h-8"
                  style={{ borderRadius: 4 }}
                  disabled={isExporting}
                  onClick={() => exportImportRef.current?.startExport()}
                >
                  {isExporting
                    ? <div className="mr-1.5 h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <Download className="mr-1.5 h-3.5 w-3.5" />}
                  {isExporting ? "生成中…" : "导出/分享"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 弹窗 + 离屏模板（无可见 UI） */}
        <ExportImportPanel ref={exportImportRef} plans={plans} onImport={handleSavePlans} onExportingChange={setIsExporting} />
      </div>

      <SetPlanDialog open={showSetPlan} onOpenChange={setShowSetPlan} existingPlans={plans} onSave={handleSavePlans} />
      <CommunityDialog open={showCommunity} onOpenChange={setShowCommunity} />
    </div>
  );
}
