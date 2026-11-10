import { useEffect } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { ClinicCase } from "@/hooks/useClinicCases";

export const CASE_STATUS_LABEL: Record<ClinicCase["status"], string> = {
  open: "Terkirim",
  in_review: "Ditinjau operator",
  answered: "Dijawab",
  closed: "Ditutup",
};

const STATUS_TONE: Record<ClinicCase["status"], string> = {
  open: "bg-pub-sky/10 text-pub-sky border-pub-sky/30",
  in_review: "bg-pub-amber/10 text-pub-amber border-pub-amber/30",
  answered: "bg-pub-emerald/10 text-pub-emerald border-pub-emerald/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export function CaseStatusBadge({ status }: { status: ClinicCase["status"] }) {
  return (
    <span data-testid={`status-case-${status}`} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_TONE[status]}`}>
      {CASE_STATUS_LABEL[status]}
    </span>
  );
}

export function formatClinicDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : format(d, "d MMM yyyy, HH:mm", { locale: localeId });
}

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const prevTitle = document.title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    const prevDesc = meta.content;
    document.title = title;
    meta.content = description;
    return () => {
      document.title = prevTitle;
      if (created) meta?.remove(); else if (meta) meta.content = prevDesc;
    };
  }, [title, description]);
}

/** Ticket-style desk number used across the clinic. */
export function DeskNumber({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex flex-col items-center justify-center rounded-md border border-dashed border-pub-amber/50 bg-pub-amber/10 px-2 py-1 font-mono leading-none text-pub-amber ${className}`}>
      <span className="text-[9px] uppercase tracking-[0.2em] opacity-80">Loket</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </span>
  );
}
