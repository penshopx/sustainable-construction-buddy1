import { CircleHelp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { trackHelpCenterOpened } from "@/lib/helpAnalytics";
import { getHelpHrefForPath } from "@/lib/helpGuide";

export function ContextualHelpLink() {
  const { pathname } = useLocation();
  return (
    <Link
      to={getHelpHrefForPath(pathname)}
      onClick={() => trackHelpCenterOpened(pathname)}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-semibold text-foreground transition-colors hover:border-pub-sky/60 hover:bg-pub-sky/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Buka panduan untuk fitur ini"
      title="Panduan fitur ini"
    >
      <CircleHelp className="h-4 w-4 text-pub-sky" />
      <span className="hidden lg:inline">Panduan fitur ini</span>
    </Link>
  );
}