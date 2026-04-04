import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Star } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CharacterPlan, getDaysNeeded, getCompletionDate, getTotalShardsNeeded, getTargetStarFromDays } from "@/lib/types";
import { ROLE_LIST } from "@/lib/roleList";

interface SetPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPlans: CharacterPlan[];
  onSave: (plans: CharacterPlan[]) => void;
}

const emptyCharacter = (): CharacterPlan => ({
  id: crypto.randomUUID(),
  name: "",
  currentStar: 1,
  targetStar: 2,
  currentShards: 0,
  startDate: new Date().toISOString().split("T")[0],
});

export default function SetPlanDialog({ open, onOpenChange, existingPlans, onSave }: SetPlanDialogProps) {
  const [characters, setCharacters] = useState<CharacterPlan[]>(
    existingPlans.length > 0 ? [...existingPlans] : [emptyCharacter()]
  );

  const updateCharacter = (index: number, updates: Partial<CharacterPlan>) => {
    setCharacters((prev) => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const addCharacter = () => {
    if (characters.length < 10) {
      setCharacters((prev) => [...prev, emptyCharacter()]);
    }
  };

  const removeCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
  };

  const [validationError, setValidationError] = useState<string | null>(null);

  const validateOverlap = (plans: CharacterPlan[]): string | null => {
    if (plans.length <= 3) return null;
    // Check every day across all plans for >3 concurrent characters
    const events: { date: number; delta: number }[] = [];
    for (const p of plans) {
      const start = new Date(p.startDate);
      start.setHours(0, 0, 0, 0);
      const end = getCompletionDate(p);
      end.setHours(0, 0, 0, 0);
      events.push({ date: start.getTime(), delta: 1 });
      // end date is inclusive, so the day after end we subtract
      events.push({ date: end.getTime() + 86400000, delta: -1 });
    }
    events.sort((a, b) => a.date - b.date || a.delta - b.delta);
    let concurrent = 0;
    for (const e of events) {
      concurrent += e.delta;
      if (concurrent > 3) {
        const d = new Date(e.date);
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} 当天同时跑片角色超过3人，请调整日期`;
      }
    }
    return null;
  };

  const handleSave = () => {
    const valid = characters.filter((c) => c.name.trim() !== "");
    const error = validateOverlap(valid);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    onSave(valid);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-gradient text-xl">设置跑片计划</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {characters.map((char, index) => (
            <div key={char.id} className="gradient-card rounded-lg p-4 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">角色 {index + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeCharacter(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">角色名称</Label>
                <Select
                  value={char.name}
                  onValueChange={(v) => updateCharacter(index, { name: v })}
                >
                  <SelectTrigger className="mt-1 bg-secondary border-border">
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ROLE_LIST.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs">当前星级</Label>
                  <Select
                    value={String(char.currentStar)}
                    onValueChange={(v) => {
                      const cs = Number(v);
                      updateCharacter(index, {
                        currentStar: cs,
                        targetStar: Math.max(cs + 1, char.targetStar),
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1 bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          <span className="flex items-center gap-1">
                            {s} <Star className="h-3 w-3 text-star fill-star" />
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">目标星级</Label>
                  <Select
                    value={String(char.targetStar)}
                    onValueChange={(v) => updateCharacter(index, { targetStar: Number(v) })}
                  >
                    <SelectTrigger className="mt-1 bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5]
                        .filter((s) => s > char.currentStar)
                        .map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            <span className="flex items-center gap-1">
                              {s} <Star className="h-3 w-3 text-star fill-star" />
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">
                  已有碎片（还需 {Math.max(0, getTotalShardsNeeded(char.currentStar, char.targetStar) - char.currentShards)} 片）
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min={0}
                    value={char.currentShards}
                    onChange={(e) => updateCharacter(index, { currentShards: Math.max(0, Number(e.target.value)) })}
                    className="bg-secondary border-border"
                  />
                  <span className="text-muted-foreground text-sm">片</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs">开始日期</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full mt-1 justify-start bg-secondary border-border text-foreground text-xs px-2">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {format(new Date(char.startDate), "yyyy/MM/dd", { locale: zhCN })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(char.startDate)}
                        onSelect={(d) => d && updateCharacter(index, { startDate: d.toISOString().split("T")[0] })}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">结束日期</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full mt-1 justify-start bg-secondary border-border text-foreground text-xs px-2">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {format(getCompletionDate(char), "yyyy/MM/dd", { locale: zhCN })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={getCompletionDate(char)}
                        onSelect={(d) => {
                          if (!d) return;
                          const start = new Date(char.startDate);
                          start.setHours(0, 0, 0, 0);
                          d.setHours(0, 0, 0, 0);
                          const diffDays = Math.max(0, Math.round((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                          const newTarget = getTargetStarFromDays(char.currentStar, char.currentShards, diffDays);
                          updateCharacter(index, { targetStar: Math.min(5, newTarget) });
                        }}
                        disabled={(d) => {
                          const start = new Date(char.startDate);
                          start.setHours(0, 0, 0, 0);
                          return d < start;
                        }}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="text-xs text-info flex items-center gap-1">
                ⏱ 预计需要 <span className="font-bold">{getDaysNeeded(char)}</span> 天完成
              </div>
            </div>
          ))}

          {characters.length < 10 && (
            <Button
              variant="outline"
              className="w-full border-dashed border-border text-muted-foreground hover:text-foreground"
              onClick={addCharacter}
            >
              <Plus className="mr-2 h-4 w-4" />
              添加角色（{characters.length}/10）
            </Button>
          )}

          {validationError && (
            <p className="text-destructive text-sm text-center">{validationError}</p>
          )}

          <Button className="w-full gradient-primary text-primary-foreground glow-primary" onClick={handleSave}>
            保存计划
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
