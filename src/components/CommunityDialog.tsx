import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COMMUNITY_TOP_CHARACTERS } from "@/lib/types";
import { Trophy } from "lucide-react";

interface CommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const medals = ["🥇", "🥈", "🥉"];

export default function CommunityDialog({ open, onOpenChange }: CommunityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gradient text-xl">
            <Trophy className="h-5 w-5 text-star" />
            近7天跑片热门角色
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {COMMUNITY_TOP_CHARACTERS.map((char, index) => (
            <div
              key={char.name}
              className={cn(
                "flex items-center gap-4 rounded-lg p-4 border border-border",
                index === 0 ? "gradient-card glow-accent" : "gradient-card"
              )}
            >
              <span className="text-2xl">{medals[index]}</span>
              <span className="text-3xl">{char.avatar}</span>
              <div className="flex-1">
                <div className="font-semibold text-foreground">{char.name}</div>
                <div className="text-xs text-muted-foreground">{char.count} 人在跑</div>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-star">TOP {index + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
