import { Bot, Trash2, Share2, GraduationCap, Briefcase, FolderKanban, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomChatbot } from "@/hooks/useCustomChatbots";
import { toast } from "@/hooks/use-toast";

const MODE_ICONS: Record<string, LucideIcon> = {
  pembelajaran: GraduationCap,
  profesi: Briefcase,
  proyek: FolderKanban,
};

const MODE_COLORS: Record<string, string> = {
  pembelajaran: "text-emerald-500",
  profesi: "text-blue-500",
  proyek: "text-pub-amber",
};

interface Props {
  bot: CustomChatbot;
  onSelect: (bot: CustomChatbot) => void;
  onDelete?: (id: string) => void;
  showShare?: boolean;
}

export function ChatbotCard({ bot, onSelect, onDelete, showShare = true }: Props) {
  const Icon = MODE_ICONS[bot.mode] || Bot;
  const color = MODE_COLORS[bot.mode] || "text-primary";

  const copyShareLink = () => {
    if (!bot.share_token) return;
    const url = `${window.location.origin}/chatbot/${encodeURIComponent(bot.share_token)}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link disalin!", description: "Bagikan link ini ke tim Anda." });
  };

  return (
    <div
      className="group p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
      onClick={() => onSelect(bot)}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
          {bot.avatar_url ? (
            <img src={bot.avatar_url} alt={bot.name} className="w-full h-full object-cover" />
          ) : (
            <Icon className={`w-5 h-5 ${color}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{bot.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{bot.description || "Tanpa deskripsi"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
        <div className="flex items-center gap-1">
          <Icon className={`w-3 h-3 ${color}`} />
          <span className="text-xs text-muted-foreground capitalize">{bot.mode}</span>
          {bot.is_public && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-1">Publik</span>
          )}
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {showShare && bot.share_token && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyShareLink}>
              <Share2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={() => onDelete(bot.id)}
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
