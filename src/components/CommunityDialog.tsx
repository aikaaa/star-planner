import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Loader2, WifiOff, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCommunityTop10, type CommunityCharacter } from "@/lib/communityStats";
import { COMMUNITY_TOP_CHARACTERS, formatCharName } from "@/lib/types";
import { getEnName } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";

interface CommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const medals = ["🥇", "🥈", "🥉"];

export default function CommunityDialog({ open, onOpenChange }: CommunityDialogProps) {
  const { t, lang } = useI18n();
  const getCharName = (zh: string) => lang === "en" ? getEnName(zh) : formatCharName(zh);
  const [chars, setChars] = useState<CommunityCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [isReal, setIsReal] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchCommunityTop10().then((result) => {
      if (result && result.data.length > 0) {
        setChars(result.data);
        setUpdatedAt(result.updatedAt);
        setIsReal(true);
      } else {
        setChars(COMMUNITY_TOP_CHARACTERS);
        setUpdatedAt(null);
        setIsReal(false);
      }
      setLoading(false);
    });
  }, [open]);

  function formatUpdatedAt(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t.communityDialog.justUpdated;
    if (diffMins < 60) return `${diffMins} ${t.communityDialog.minutesAgo}`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ${t.communityDialog.hoursAgo}`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ${t.communityDialog.daysAgo}`;
  }

  const totalCount = chars.reduce((sum, c) => sum + c.count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gradient-title text-xl">
            <Trophy className="h-5 w-5" style={{ color: "hsl(var(--star))" }} />
            {t.communityDialog.title}
          </DialogTitle>
          {!loading && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              {isReal ? (
                <>
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{updatedAt ? formatUpdatedAt(updatedAt) : t.communityDialog.loaded}</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span>{t.communityDialog.noService}</span>
                </>
              )}
            </p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">{t.communityDialog.loading}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {chars.map((char, index) => {
              const pct = totalCount > 0 ? ((char.count / totalCount) * 100).toFixed(1) : "0.0";
              return (
                <div
                  key={char.name}
                  className={cn(
                    "flex items-center gap-3 rounded-lg p-3 border border-border",
                    "gradient-card"
                  )}
                >
                  <span className="text-xl w-8 text-center">
                    {index < 3
                      ? medals[index]
                      : <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground text-sm">{getCharName(char.name)}</span>
                      {char.topTargetStar != null && (
                        <span className="text-[10px] text-muted-foreground/70 shrink-0">
                          {t.communityDialog.morePeople} <span className="font-bold text-primary">{char.topTargetStar}★</span>
                        </span>
                      )}
                    </div>
                    <div className="w-full rounded-full h-1.5 mt-1" style={{ backgroundColor: "hsl(var(--primary) / 0.15)" }}>
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: "hsl(var(--star))" }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold" style={{ color: "hsl(var(--star))" }}>{pct}%</span>
                    <div className="text-xs text-muted-foreground flex items-center justify-end gap-0.5">
                      <User className="h-3 w-3" style={{ color: "hsl(var(--star))" }} />
                      <span style={{ color: "hsl(var(--star))" }}>{char.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
