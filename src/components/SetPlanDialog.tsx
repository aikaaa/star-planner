import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Star, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  CharacterPlan,
  FarmingMode,
  getDaysNeeded,
  getCompletionDate,
  getTotalShardsNeeded,
  getTargetStarFromDays,
  getPartialProgress,
  parseLocalDate,
  toDateStr,
} from "@/lib/types";
import { ROLES, fetchRemoteRoles, type RoleEntry } from "@/lib/roles";
import { generateUUID } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

interface SetPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPlans: CharacterPlan[];
  onSave: (plans: CharacterPlan[]) => void;
}

const emptyCharacter = (): CharacterPlan => ({
  id: generateUUID(),
  name: "",
  farmingMode: "star",
  currentStar: 1,
  targetStar: 2,
  currentShards: 0,
  startDate: toDateStr(new Date()),
});

function RoleCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleEntries, setRoleEntries] = useState<RoleEntry[]>([...ROLES].reverse());

  useEffect(() => {
    fetchRemoteRoles().then((roles) => setRoleEntries([...roles].reverse())).catch(() => {});
  }, []);

  const getDisplayName = (entry: RoleEntry) =>
    lang === "en" && entry.en ? entry.en.replace(/_/g, " ") : entry.zh;

  const filtered = search.trim()
    ? roleEntries.filter((r) => {
        const q = search.trim().toLowerCase();
        return getDisplayName(r).toLowerCase().includes(q) || r.zh.toLowerCase().includes(q);
      })
    : roleEntries;

  const selectedEntry = roleEntries.find((r) => r.zh === value);
  const displayValue = selectedEntry ? getDisplayName(selectedEntry) : value;

  const handleSelect = (zh: string) => {
    onChange(zh);
    setOpen(false);
    setSearch("");
  };

  return (
    <div>
      <Label className="text-muted-foreground text-xs">{t.setPlanDialog.characterName}</Label>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full mt-1 justify-between bg-transparent border-border text-foreground"
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
      >
        {displayValue || t.setPlanDialog.selectCharacter}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="mt-1 rounded-md border border-border bg-popover shadow-md">
          <div className="flex items-center border-b border-border px-3">
            <input
              autoFocus
              type="text"
              placeholder={t.setPlanDialog.searchCharacter}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <div
            style={{
              height: "220px",
              overflowY: "scroll",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{t.setPlanDialog.notFound}</div>
            ) : (
              filtered.map((entry) => (
                <button
                  key={entry.zh}
                  type="button"
                  onClick={() => handleSelect(entry.zh)}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-sm text-left hover:bg-accent active:bg-accent",
                  )}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === entry.zh ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{getDisplayName(entry)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}



function DatePickerButton({ date, onSelect, disabled, locale }: {
  date: Date;
  onSelect: (d: Date) => void;
  disabled?: (d: Date) => boolean;
  locale: Locale;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full mt-1 justify-start bg-transparent border-border text-foreground text-xs px-2">
          <CalendarIcon className="mr-1 h-3 w-3" />
          {format(date, "yyyy/MM/dd", { locale })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(d) => d && onSelect(d)}
          disabled={disabled}
          locale={locale}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

const toCharacters = (plans: CharacterPlan[]) =>
  plans.length > 0
    ? plans.map((c) => ({ farmingMode: "star" as FarmingMode, ...c }))
    : [emptyCharacter()];

export default function SetPlanDialog({ open, onOpenChange, existingPlans, onSave }: SetPlanDialogProps) {
  const { t, lang } = useI18n();
  const locale = lang === "en" ? enUS : zhCN;

  const [characters, setCharacters] = useState<CharacterPlan[]>(() => toCharacters(existingPlans));

  // 每次打开弹窗时从最新的 existingPlans 重新初始化，避免显示旧数据
  useEffect(() => {
    if (open) setCharacters(toCharacters(existingPlans));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCharacter = (index: number, updates: Partial<CharacterPlan>) => {
    setCharacters((prev) => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const changeFarmingMode = (index: number, mode: FarmingMode) => {
    const char = characters[index];
    if (mode === "free") {
      // 切换到自由模式：用当前计算出的结束日期作为初始 endDate
      const endDate = toDateStr(getCompletionDate(char));
      updateCharacter(index, { farmingMode: mode, endDate });
    } else {
      // 切换到按星模式：根据 endDate 反推 targetStar
      const endDate = char.endDate ? parseLocalDate(char.endDate!) : getCompletionDate(char);
      const start = parseLocalDate(char.startDate);
      start.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      const days = Math.max(0, Math.round((endDate.getTime() - start.getTime()) / 86400000));
      const targetStar = getTargetStarFromDays(char.currentStar, char.currentShards, days);
      updateCharacter(index, { farmingMode: mode, targetStar });
    }
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
    const ranges = plans.map((p) => {
      const start = new Date(p.startDate);
      start.setHours(0, 0, 0, 0);
      const end = getCompletionDate(p);
      end.setHours(0, 0, 0, 0);
      return { name: p.name, start: start.getTime(), end: end.getTime() };
    });
    const allDates = new Set(ranges.flatMap((r) => {
      const dates: number[] = [];
      for (let d = r.start; d <= r.end; d += 86400000) dates.push(d);
      return dates;
    }));
    for (const ts of allDates) {
      const active = ranges.filter((r) => ts >= r.start && ts <= r.end);
      const uniqueNames = new Set(active.map((r) => r.name));
      if (uniqueNames.size > 3) {
        const d = new Date(ts);
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${t.setPlanDialog.tooManyChars}`;
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-gradient-title text-xl">{t.setPlanDialog.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {characters.map((char, index) => {
            const isFree = char.farmingMode === "free";
            const completionDate = getCompletionDate(char);
            const days = getDaysNeeded(char);
            const endDateObj = char.endDate ? parseLocalDate(char.endDate!) : completionDate;
            const freeDays = isFree
              ? Math.max(0, Math.round((endDateObj.getTime() - parseLocalDate(char.startDate).getTime()) / 86400000) + 1)
              : 0;

            return (
              <div key={char.id} className="gradient-card rounded-lg p-4 border border-border space-y-3">
                {/* 标题行 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{t.setPlanDialog.character} {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive rounded-[4px]"
                    onClick={() => removeCharacter(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* 跑片方式切换 */}
                <div className="flex gap-2">
                  {(["star", "free"] as FarmingMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => changeFarmingMode(index, mode)}
                      className={cn(
                        "flex-1 py-1.5 rounded-md text-xs font-medium border transition-all",
                        char.farmingMode === mode
                          ? "gradient-primary text-primary-foreground border-transparent glow-primary"
                          : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {mode === "star" ? t.setPlanDialog.modeStar : t.setPlanDialog.modeFree}
                    </button>
                  ))}
                </div>

                {/* 角色名称 */}
                <RoleCombobox
                  value={char.name}
                  onChange={(v) => {
                    const prevSegments = characters
                      .filter((c, ci) => ci !== index && c.name === v);
                    if (prevSegments.length > 0) {
                      const last = prevSegments.reduce((a, b) =>
                        getCompletionDate(a).getTime() >= getCompletionDate(b).getTime() ? a : b
                      );
                      const lastEnd = getCompletionDate(last);
                      const days = getDaysNeeded(last);
                      const { reachableStar, remainingShards } = getPartialProgress(last.currentStar, last.currentShards, days);
                      const nextStart = new Date(lastEnd);
                      nextStart.setDate(nextStart.getDate() + 1);
                      updateCharacter(index, {
                        name: v,
                        currentStar: reachableStar,
                        currentShards: remainingShards,
                        targetStar: Math.min(reachableStar + 1, 5),
                        startDate: toDateStr(nextStart),
                      });
                    } else {
                      updateCharacter(index, { name: v });
                    }
                  }}
                />

                {/* 已有碎片 + 追忆/万能碎片 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-muted-foreground text-xs">
                      {t.setPlanDialog.currentShards}
                      {!isFree && (() => {
                        const needed = Math.max(0, getTotalShardsNeeded(char.currentStar, char.targetStar) - char.currentShards - (char.bonusShards ?? 0));
                        return (
                          <span className="ml-1">
                            {lang === "en"
                              ? `(${needed} ${t.setPlanDialog.need.toLowerCase()})`
                              : `（${t.setPlanDialog.need} ${needed} ${t.setPlanDialog.shardsUnit}）`}
                          </span>
                        );
                      })()}
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min={0}
                        value={char.currentShards === 0 ? "" : char.currentShards}
                        placeholder="0"
                        onChange={(e) => {
                          const newShards = Math.max(0, Number(e.target.value) || 0);
                          const updates: Partial<CharacterPlan> = { currentShards: newShards };
                          if (isFree) {
                            const starPlan = { ...char, currentShards: newShards, farmingMode: "star" as FarmingMode };
                            updates.endDate = toDateStr(getCompletionDate(starPlan));
                          }
                          updateCharacter(index, updates);
                        }}
                        className="bg-transparent border-border"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.setPlanDialog.bonusShards}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min={0}
                        value={!char.bonusShards ? "" : char.bonusShards}
                        placeholder="0"
                        onChange={(e) => {
                          const newBonus = Math.max(0, Number(e.target.value) || 0);
                          updateCharacter(index, { bonusShards: newBonus });
                        }}
                        className="bg-transparent border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* 按星跑片：当前星级 + 目标星级 */}
                {!isFree && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-muted-foreground text-xs">{t.setPlanDialog.currentStar}</Label>
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
                        <SelectTrigger className="mt-1 bg-transparent border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4].map((s) => (
                            <SelectItem key={s} value={String(s)}>
                              <span className="flex items-center gap-1">{s} <Star className="h-3 w-3 text-star fill-star" /></span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">{t.setPlanDialog.targetStar}</Label>
                      <Select
                        value={String(char.targetStar)}
                        onValueChange={(v) => updateCharacter(index, { targetStar: Number(v) })}
                      >
                        <SelectTrigger className="mt-1 bg-transparent border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 5]
                            .filter((s) => s > char.currentStar)
                            .map((s) => (
                              <SelectItem key={s} value={String(s)}>
                                <span className="flex items-center gap-1">{s} <Star className="h-3 w-3 text-star fill-star" /></span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* 自由跑片：仅当前星级可选 */}
                {isFree && (
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.setPlanDialog.currentStar}</Label>
                    <Select
                      value={String(char.currentStar)}
                      onValueChange={(v) => updateCharacter(index, { currentStar: Number(v) })}
                    >
                      <SelectTrigger className="mt-1 bg-transparent border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            <span className="flex items-center gap-1">{s} <Star className="h-3 w-3 text-star fill-star" /></span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 日期区域 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.setPlanDialog.startDate}</Label>
                    <DatePickerButton
                      date={parseLocalDate(char.startDate)}
                      locale={locale}
                      onSelect={(d) => {
                        const newStart = toDateStr(d);
                        if (isFree && char.endDate && d > parseLocalDate(char.endDate!)) {
                          updateCharacter(index, { startDate: newStart, endDate: newStart });
                        } else {
                          updateCharacter(index, { startDate: newStart });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.setPlanDialog.endDate}</Label>
                    {isFree ? (
                      <DatePickerButton
                        date={endDateObj}
                        locale={locale}
                        onSelect={(d) => updateCharacter(index, { endDate: toDateStr(d) })}
                        disabled={(d) => {
                          const start = parseLocalDate(char.startDate);
                          start.setHours(0, 0, 0, 0);
                          return d < start;
                        }}
                      />
                    ) : (
                      <Button
                        variant="outline"
                        disabled
                        className="w-full mt-1 justify-start bg-transparent border-border text-muted-foreground text-xs px-2 opacity-60"
                      >
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {format(completionDate, "yyyy/MM/dd", { locale })}
                      </Button>
                    )}
                  </div>
                </div>

                {/* 底部信息 */}
                {isFree ? (() => {
                  const { reachableStar, remainingShards: freeRemaining } = getPartialProgress(
                    char.currentStar, char.currentShards + (char.bonusShards ?? 0), freeDays
                  );
                  const isMaxStar = reachableStar >= 5;
                  const freeExcess = isMaxStar ? freeRemaining : 0;
                  if (lang === "en") {
                    return (
                      <div className="text-xs text-info flex items-center gap-1 flex-wrap">
                        🎯{" "}
                        {isMaxStar ? (
                          <>
                            <span className="font-bold text-star">Max★</span>
                            {freeExcess > 0 && <span className="text-destructive font-medium">{freeExcess} {t.setPlanDialog.excess}</span>}
                            🎉
                          </>
                        ) : (
                          <span className="font-bold text-star">{reachableStar}★ {freeRemaining} Left</span>
                        )}
                        <span className="text-muted-foreground">· {freeDays}d</span>
                      </div>
                    );
                  }
                  return (
                    <div className="text-xs text-info flex items-center gap-1 flex-wrap">
                      🎯 {t.setPlanDialog.estimated}
                      <span className="font-bold text-star">
                        {isMaxStar ? t.setPlanDialog.fullStar : `${reachableStar}★ 余 ${freeRemaining} ${t.setPlanDialog.shardsUnit}`}
                      </span>
                      {freeExcess > 0 && (
                        <span className="text-destructive font-medium">（超 {freeExcess} {t.setPlanDialog.shardsUnit}）</span>
                      )}
                      {isMaxStar && <span>🎉</span>}
                      <span className="text-muted-foreground ml-1">（共 {freeDays} {t.setPlanDialog.days}）</span>
                    </div>
                  );
                })() : (() => {
                  const totalNeeded = getTotalShardsNeeded(char.currentStar, char.targetStar);
                  const remaining = Math.max(0, totalNeeded - char.currentShards - (char.bonusShards ?? 0));
                  const excess = days > 0
                    ? days * 3 - remaining
                    : Math.max(0, char.currentShards + (char.bonusShards ?? 0) - totalNeeded);
                  const bonusNeeded = excess > 0 ? 3 - excess : 0;
                  if (lang === "en") {
                    return (
                      <div className="text-xs text-info flex items-center gap-1 flex-wrap">
                        ⏱ ETA <span className="font-bold">{days}</span>d
                        {excess > 0 && (
                          days > 0 ? (
                            <span className="text-destructive font-medium">
                              (Excess {excess}) or +{bonusNeeded} Recollection → {days - 1}d
                            </span>
                          ) : (
                            <span className="text-destructive font-medium">(Excess {excess})</span>
                          )
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="text-xs text-info flex items-center gap-1 flex-wrap">
                      {t.setPlanDialog.estimatedNeeds} <span className="font-bold">{days}</span> {t.setPlanDialog.daysToComplete}
                      {excess > 0 && (
                        days > 0 ? (
                          <span className="text-destructive font-medium">
                            （超 {excess} {t.setPlanDialog.shardsUnit}），或补 {bonusNeeded} {t.setPlanDialog.universalShards} {days - 1} 天完成
                          </span>
                        ) : (
                          <span className="text-destructive font-medium">（已超 {excess} {t.setPlanDialog.shardsUnit}）</span>
                        )
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {characters.length < 10 && (
            <Button
              variant="outline"
              className="w-full border-dashed border-border text-muted-foreground hover:text-foreground"
              onClick={addCharacter}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t.setPlanDialog.addCharacter}（{characters.length}/10）
            </Button>
          )}

          {validationError && (
            <p className="text-destructive text-sm text-center">{validationError}</p>
          )}

          <Button className="w-full gradient-primary text-primary-foreground glow-primary" onClick={handleSave}>
            {t.setPlanDialog.savePlan}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
