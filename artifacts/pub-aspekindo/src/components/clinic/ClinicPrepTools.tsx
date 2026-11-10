import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { CLINIC_PREP_TOOLS } from "@/lib/clinicCatalog";

export default function ClinicPrepTools({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={compact ? "space-y-1" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
      {CLINIC_PREP_TOOLS.map(tool => {
        const cls = compact
          ? "flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
          : "group flex h-full items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-pub-amber/50";
        const body = (
          <>
            <span>
              <span className="block font-medium">{tool.label}</span>
              {!compact && <span className="mt-0.5 block text-xs text-muted-foreground">{tool.note}</span>}
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        );
        return (
          <li key={tool.href}>
            {tool.href.startsWith("/ruang-simpan")
              ? <a href={tool.href} className={cls} data-testid="link-prep-ruang-simpan">{body}</a>
              : <Link to={tool.href} className={cls} data-testid={`link-prep-${tool.href.slice(1)}`}>{body}</Link>}
          </li>
        );
      })}
    </ul>
  );
}
