import { BUILT_IN_BOTS } from "./expert-bot-catalog-data";

interface ExpertBotCatalogProps {
  selectedBotId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}

export default function ExpertBotCatalog({ selectedBotId, onSelect, compact }: ExpertBotCatalogProps) {
  if (compact) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-heading font-semibold text-foreground">Pilih Pakar</h4>
        <div className="flex flex-wrap gap-1.5">
          {BUILT_IN_BOTS.map(bot => (
            <button key={bot.id} onClick={() => onSelect(bot.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                bot.id === selectedBotId
                  ? "bg-primary/10 border border-primary/20 text-foreground font-medium"
                  : "hover:bg-muted border border-border text-muted-foreground"
              }`}>
              <bot.icon className={`w-3.5 h-3.5 ${bot.color}`} />
              {bot.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-heading font-semibold text-foreground">Pilih Pakar</h4>
      <div className="space-y-1.5">
        {BUILT_IN_BOTS.map(bot => (
          <button key={bot.id} onClick={() => onSelect(bot.id)}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all ${
              bot.id === selectedBotId
                ? "bg-primary/10 border border-primary/20 shadow-sm"
                : "hover:bg-muted border border-transparent"
            }`}>
            <div className={`w-9 h-9 rounded-lg ${bot.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
              <bot.icon className={`w-5 h-5 ${bot.color}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold font-heading truncate ${
                bot.id === selectedBotId ? "text-foreground" : "text-muted-foreground"
              }`}>{bot.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{bot.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
