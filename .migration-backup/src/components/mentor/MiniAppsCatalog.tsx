import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ExternalLink, AppWindow } from "lucide-react";
import { MINI_APPS, type MiniApp } from "./mini-apps-catalog-data";

interface MiniAppsCatalogProps {
  compact?: boolean;
  onSelectApp?: (app: MiniApp) => void;
}

export default function MiniAppsCatalog({ compact, onSelectApp }: MiniAppsCatalogProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(!compact);

  const modules = MINI_APPS.filter(a => a.category === "module");
  const tools = MINI_APPS.filter(a => a.category === "tool");

  const handleClick = (app: MiniApp) => {
    if (onSelectApp) onSelectApp(app);
    if (app.route && !app.comingSoon) {
      window.open(app.route, "_blank");
    }
  };

  if (compact) {
    return (
      <div>
        <button onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-sm font-heading font-semibold text-foreground mb-1.5">
          <span className="flex items-center gap-1.5"><AppWindow className="w-4 h-4 text-emerald-500" /> Mini Apps</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expanded && (
          <div className="flex flex-wrap gap-1.5">
            {MINI_APPS.map(app => (
              <button key={app.id} onClick={() => handleClick(app)}
                disabled={app.comingSoon}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                  app.comingSoon
                    ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                    : "border-border hover:bg-muted text-foreground"
                }`}>
                <app.icon className={`w-3 h-3 ${app.color}`} />
                <span className="truncate">{app.name}</span>
                {app.comingSoon && <span className="text-[10px] text-muted-foreground">(soon)</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-heading font-semibold text-foreground flex items-center gap-1.5">
        <AppWindow className="w-4 h-4 text-emerald-500" /> Mini Apps
      </h4>
      <p className="text-xs text-muted-foreground">
        AI dapat menyarankan mini app yang relevan untuk menyelesaikan masalah proyek Anda.
      </p>

      {/* Modules */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Modul</p>
        <div className="space-y-1">
          {modules.map(app => (
            <button key={app.id} onClick={() => handleClick(app)}
              className="w-full text-left flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted border border-transparent hover:border-border transition-colors group">
              <div className={`w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
                <app.icon className={`w-3.5 h-3.5 ${app.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{app.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{app.description}</p>
              </div>
              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tools</p>
        <div className="space-y-1">
          {tools.map(app => (
            <button key={app.id} onClick={() => handleClick(app)}
              disabled={app.comingSoon}
              className={`w-full text-left flex items-center gap-2.5 p-2 rounded-xl border border-transparent transition-colors group ${
                app.comingSoon ? "opacity-50 cursor-not-allowed" : "hover:bg-muted hover:border-border"
              }`}>
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <app.icon className={`w-3.5 h-3.5 ${app.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{app.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{app.description}</p>
              </div>
              {app.comingSoon && (
                <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">Soon</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
