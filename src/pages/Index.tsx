import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Flame, Sparkles, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import FarmingCalendar from "@/components/FarmingCalendar";
import SetPlanDialog from "@/components/SetPlanDialog";
import CommunityDialog from "@/components/CommunityDialog";
import { CharacterPlan, getEffectiveTargetStar } from "@/lib/types";
import { reportFarmingCharacters } from "@/lib/communityStats";

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  const handleSavePlans = (newPlans: CharacterPlan[]) => {
    setPlans(newPlans);
    reportFarmingCharacters(newPlans.map((p) => ({ name: p.name, targetStar: getEffectiveTargetStar(p) })));
  };

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

      {/* Calendar */}
      <div className="mx-auto px-4" style={{ maxWidth: "600px", paddingTop: "12px", paddingBottom: "32px" }}>
        {plans.length === 0 ? (
          <div className="gradient-card rounded-xl border border-border p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-muted-foreground text-sm mb-4">暂未设置跑片计划</p>
            <Button className="gradient-primary text-primary-foreground glow-primary" onClick={() => setShowSetPlan(true)}>
              开始设置
            </Button>
          </div>
        ) : (
          <div className="gradient-card border-fade-bottom pb-4" style={{ paddingTop: "8px", paddingLeft: "12px", paddingRight: "12px", borderRadius: "4px" }}>
            <FarmingCalendar plans={plans} />
          </div>
        )}
      </div>

      <SetPlanDialog open={showSetPlan} onOpenChange={setShowSetPlan} existingPlans={plans} onSave={handleSavePlans} />
      <CommunityDialog open={showCommunity} onOpenChange={setShowCommunity} />
    </div>
  );
}
