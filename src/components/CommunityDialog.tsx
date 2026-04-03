import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COMMUNITY_TOP_CHARACTERS } from "@/lib/types";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const medals = ["🥇", "🥈", "🥉"];

export default function CommunityDialog({ open, onOpenChange }: CommunityDialogProps) {
  const totalCount = COMMUNITY_TOP_CHARACTERS.reduce((sum, c) => sum + c.count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gradient text-xl">
            <Trophy className="h-5 w-5 text-star" />
            近7天跑片热门角色 Top10
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {COMMUNITY_TOP_CHARACTERS.map((char, index) => {
            const pct = ((char.count / totalCount) * 100).toFixed(1);
            return (
              <div
                key={char.name}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-3 border border-border",
                  index < 3 ? "gradient-card glow-accent" : "gradient-card"
                )}
              >
                <span className="text-xl w-8 text-center">
                  {index < 3 ? medals[index] : <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>}
                </span>
                <span className="text-2xl">{char.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground text-sm">{char.name}</div>
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
      </DialogContent>
    </Dialog>
  );
}
