import { CustomChatbot } from "@/hooks/useCustomChatbots";
import { ChatbotCard } from "./ChatbotCard";
import { Store, Loader2 } from "lucide-react";

interface Props {
  bots: CustomChatbot[];
  loading: boolean;
  onSelect: (bot: CustomChatbot) => void;
}

export function ChatbotMarketplace({ bots, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bots.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Store className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Belum ada chatbot profesi di marketplace.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {bots.map((bot) => (
        <ChatbotCard
          key={bot.id}
          bot={bot}
          onSelect={onSelect}
          showShare={false}
        />
      ))}
    </div>
  );
}
