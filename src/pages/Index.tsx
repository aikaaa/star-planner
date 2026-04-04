import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Users, Sparkles } from "lucide-react";
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
  const [editingPlan, setEditingPlan] = useState<CharacterPlan | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  const handleSavePlans = (newPlans: CharacterPlan[]) => {
    setPlans(newPlans);
    reportFarmingCharacters(newPlans.map((p) => ({ name: p.name, targetStar: getEffectiveTargetStar(p) })));
  };

  // 单角色编辑：把修改后的角色合并回 plans
  const handleSaveEditingPlan = (updated: CharacterPlan[]) => {
    if (updated.length === 0) return;
    const updatedPlan = updated[0];
    const newPlans = plans.map((p) => (p.id === updatedPlan.id ? updatedPlan : p));
    setPlans(newPlans);
    reportFarmingCharacters(newPlans.map((p) => ({ name: p.name, targetStar: getEffectiveTargetStar(p) })));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary px-4 py-6 sm:py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="h-6 w-6 text-star" />
          <h1 className="text-xl sm:text-2xl font-bold text-primary-foreground">铃兰跑片助手</h1>
        </div>
        <p className="text-primary-foreground/70 text-xs sm:text-sm">管理你的角色碎片养成进度</p>
      </header>

      {/* Action buttons */}
      <div className="max-w-lg mx-auto px-4 -mt-4 flex gap-3">
        <Button
          className="flex-1 gradient-card border border-border text-foreground hover:text-foreground active:text-foreground hover:glow-primary h-12"
          variant="outline"
          onClick={() => setShowSetPlan(true)}
        >
          <Settings className="mr-2 h-4 w-4 text-primary" />
          设置跑片
        </Button>
        <Button
          className="flex-1 gradient-card border border-border text-foreground hover:text-foreground active:text-foreground hover:glow-accent h-12"
          variant="outline"
          onClick={() => setShowCommunity(true)}
        >
          <Users className="mr-2 h-4 w-4 text-star" />
          大家在跑谁
        </Button>
      </div>

      {/* Calendar */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {plans.length === 0 ? (
          <div className="gradient-card rounded-xl border border-border p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-muted-foreground text-sm mb-4">暂未设置跑片计划</p>
            <Button className="gradient-primary text-primary-foreground glow-primary" onClick={() => setShowSetPlan(true)}>
              开始设置
            </Button>
          </div>
        ) : (
          <div className="gradient-card rounded-xl border border-border p-4">
            <FarmingCalendar plans={plans} onEditPlan={(plan) => setEditingPlan(plan)} />
          </div>
        )}
      </div>

      <SetPlanDialog open={showSetPlan} onOpenChange={setShowSetPlan} existingPlans={plans} onSave={handleSavePlans} />
      <SetPlanDialog
        open={editingPlan !== null}
        onOpenChange={(o) => { if (!o) setEditingPlan(null); }}
        existingPlans={editingPlan ? [editingPlan] : []}
        onSave={handleSaveEditingPlan}
        singleEdit
      />
      <CommunityDialog open={showCommunity} onOpenChange={setShowCommunity} />
    </div>
  );
}
