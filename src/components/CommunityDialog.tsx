import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Loader2, WifiOff, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCommunityTop10, type CommunityCharacter } from "@/lib/communityStats";
import { COMMUNITY_TOP_CHARACTERS } from "@/lib/types";

interface CommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const medals = ["🥇", "🥈", "🥉"];

function formatUpdatedAt(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "刚刚更新";
  if (diffMins < 60) return `${diffMins} 分钟前更新`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前更新`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前更新`;
}

export default function CommunityDialog({ open, onOpenChange }: CommunityDialogProps) {
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

  const totalCount = chars.reduce((sum, c) => sum + c.count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gradient text-xl">
            <Trophy className="h-5 w-5 text-star" />
            近7天跑片热门角色 Top10
          </DialogTitle>
          {!loading && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              {isReal ? (
                <>
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{updatedAt ? formatUpdatedAt(updatedAt) : "数据已加载"}</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span>暂未连接统计服务，显示示例数据</span>
                </>
              )}
            </p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">加载中…</span>
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
                    index < 3 ? "gradient-card glow-accent" : "gradient-card"
                  )}
                >
                  <span className="text-xl w-8 text-center">
                    {index < 3
                      ? medals[index]
                      : <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground text-sm">{char.name}</span>
                      {char.topTargetStar != null && (
                        <span className="text-[10px] text-muted-foreground/70 shrink-0">
                          更多人选择跑<span className="font-bold text-white">{char.topTargetStar}★</span>
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-star">{pct}%</span>
                    <div className="text-xs text-muted-foreground">{char.count}人</div>
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
