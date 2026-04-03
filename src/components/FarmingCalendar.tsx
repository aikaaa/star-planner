import { useMemo } from "react";
import { CharacterPlan, getCharactersOnDate, getCompletionDate, getDaysNeeded } from "@/lib/types";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface FarmingCalendarProps {
  plans: CharacterPlan[];
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// Simple color palette for up to 3 characters
const CHAR_COLORS = [
  "bg-primary/30 border-primary/50",
  "bg-info/30 border-info/50",
  "bg-star/20 border-star/40",
];

const CHAR_DOT_COLORS = ["bg-primary", "bg-info", "bg-star"];

export default function FarmingCalendar({ plans }: FarmingCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date());

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
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold text-foreground">
          {year}年{month + 1}月
        </h2>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Legend */}
      {plans.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {plans.map((p, i) => (
            <div key={p.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`w-2.5 h-2.5 rounded-full ${CHAR_DOT_COLORS[i]}`} />
              <span>{p.name}</span>
              <span className="flex items-center">
                {p.currentStar}→{p.targetStar}
                <Star className="h-3 w-3 text-star fill-star ml-0.5" />
              </span>
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
              className={`relative flex flex-col items-center justify-center rounded-md p-1 min-h-[2.5rem] sm:min-h-[3.5rem] text-sm transition-all ${
                isToday
                  ? "ring-2 ring-primary bg-primary/10"
                  : hasChars
                  ? "bg-secondary/50"
                  : ""
              }`}
            >
              <span className={`text-xs sm:text-sm ${isToday ? "font-bold text-primary" : "text-foreground"}`}>
                {day}
              </span>
              {hasChars && (
                <div className="flex gap-0.5 mt-0.5">
                  {characters.map((c) => {
                    const idx = plans.findIndex((p) => p.id === c.id);
                    return (
                      <div
                        key={c.id}
                        className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${CHAR_DOT_COLORS[idx] || "bg-muted-foreground"}`}
                        title={c.name}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary cards */}
      {plans.length > 0 && (
        <div className="mt-4 space-y-2">
          {plans.map((p, i) => {
            const days = getDaysNeeded(p);
            const endDate = getCompletionDate(p);
            return (
              <div key={p.id} className={`rounded-lg p-3 border ${CHAR_COLORS[i]}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground text-sm">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.currentStar}★ → {p.targetStar}★
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  预计 {days} 天 · 完成于 {endDate.getFullYear()}/{endDate.getMonth() + 1}/{endDate.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
