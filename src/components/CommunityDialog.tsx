import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Loader2, WifiOff, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCommunityTop10, type CommunityCharacter } from "@/lib/communityStats";
import { COMMUNITY_TOP_CHARACTERS, formatCharName } from "@/lib/types";
import { getEnName } from "@/lib/roles";
import { getAvatarUrl } from "@/lib/roleAvatars";
import { useI18n } from "@/lib/i18n";

function CharAvatar({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const url = getAvatarUrl(name);
  const bg = "hsl(var(--primary) / 0.15)";
  const size = 32;
  if (url && !failed) {
    return (
      <div style={{ width: size, height: size, minWidth: size, borderRadius: "50%", overflow: "hidden", background: bg }}>
        <img src={url} alt={name} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, minWidth: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 24 24" fill="hsl(var(--primary) / 0.5)" style={{ width: "55%", height: "55%" }}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8H4z" />
      </svg>
    </div>
  );
}

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
    const prefix = lang === "en" ? "Updated " : "";
    if (diffMins < 60) return `${prefix}${diffMins} ${t.communityDialog.minutesAgo}`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${prefix}${diffHours} ${t.communityDialog.hoursAgo}`;
    const diffDays = Math.floor(diffHours / 24);
    return `${prefix}${diffDays} ${t.communityDialog.daysAgo}`;
  }

  const totalCount = chars.reduce((sum, c) => sum + c.count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-background border-border" style={{ maxWidth: 400 }}>
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
                    "flex items-center gap-3 rounded-lg py-3 pl-3 pr-4 border border-border",
                    "gradient-card"
                  )}
                >
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xl text-center" style={{ width: 24, display: "inline-block" }}>
                      {index < 3
                        ? medals[index]
                        : <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>}
                    </span>
                    <CharAvatar name={char.name} />
                  </div>
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
