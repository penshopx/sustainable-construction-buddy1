import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Wrench, Package, Lightbulb, Download, CheckCircle2 } from "lucide-react";
import { type ToolboxTemplate, type TemplateSection } from "./toolboxTemplates";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

function SectionChecklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const total = items.length;
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{done}/{total} selesai</span>
        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-pub-emerald transition-all rounded-full" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>
      {items.map((item, i) => (
        <label key={i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group">
          <Checkbox
            checked={!!checked[i]}
            onCheckedChange={(v) => setChecked({ ...checked, [i]: !!v })}
            className="mt-0.5"
          />
          <span className={`text-sm leading-relaxed ${checked[i] ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {item}
          </span>
        </label>
      ))}
    </div>
  );
}

function SectionTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  const [cells, setCells] = useState<Record<string, string>>({});

  const updateCell = (r: number, c: number, value: string) => {
    setCells({ ...cells, [`${r}-${c}`]: value });
  };

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="text-left text-xs font-semibold text-muted-foreground p-2 border-b border-border bg-muted/30">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-muted/20">
              {row.map((cell, ci) => (
                <td key={ci} className="p-1.5 border-b border-border/50">
                  {cell.includes("...") ? (
                    <Input
                      value={cells[`${ri}-${ci}`] ?? ""}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      placeholder={cell}
                      className="h-8 text-xs border-dashed"
                    />
                  ) : (
                    <span className="text-xs px-1">{cell}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionForm({ fields }: { fields: { label: string; placeholder?: string }[] }) {
  return (
    <div className="grid gap-3">
      {fields.map((field, i) => (
        <div key={i}>
          <label className="text-xs font-medium text-foreground mb-1 block">{field.label}</label>
          <Input placeholder={field.placeholder} className="text-sm" />
        </div>
      ))}
    </div>
  );
}

function SectionContent({ section }: { section: TemplateSection }) {
  switch (section.type) {
    case "checklist":
      return section.items ? <SectionChecklist items={section.items} /> : null;
    case "table":
      return section.columns && section.rows ? <SectionTable columns={section.columns} rows={section.rows} /> : null;
    case "form":
      return section.fields ? <SectionForm fields={section.fields} /> : null;
    case "guide":
    case "formula":
      return section.content ? (
        <MarkdownRenderer>{section.content}</MarkdownRenderer>
      ) : null;
    default:
      return null;
  }
}

const sectionTypeLabels: Record<string, { label: string; color: string }> = {
  checklist: { label: "Checklist", color: "bg-pub-emerald/15 text-pub-emerald" },
  table: { label: "Template", color: "bg-pub-sky/15 text-pub-sky" },
  form: { label: "Form Input", color: "bg-pub-amber/15 text-pub-amber" },
  guide: { label: "Panduan", color: "bg-purple-500/15 text-purple-600" },
  formula: { label: "Formula", color: "bg-orange-500/15 text-orange-600" },
};

interface ToolboxViewerProps {
  template: ToolboxTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ToolboxViewer({ template, open, onOpenChange }: ToolboxViewerProps) {
  const isToolkit = template.type === "toolkit";
  const Icon = isToolkit ? Wrench : Package;
  const accentColor = isToolkit ? "text-pub-amber" : "text-pub-sky";
  const bgAccent = isToolkit ? "bg-pub-amber/10" : "bg-pub-sky/10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{template.name}</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-11 h-11 rounded-xl ${bgAccent} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${accentColor}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg font-bold font-heading">{template.name}</h2>
              <Badge variant="outline" className="text-[10px]">
                {isToolkit ? "🧰 Toolkit" : "📦 Toolbox"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{template.objective}</p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {template.sections.map((section, i) => {
            const typeLabel = sectionTypeLabels[section.type];
            return (
              <Card key={i} className="border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold font-heading flex-1">{section.title}</h3>
                    {typeLabel && (
                      <Badge className={`${typeLabel.color} text-[10px]`}>{typeLabel.label}</Badge>
                    )}
                  </div>
                  <SectionContent section={section} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tips */}
        {template.tips && template.tips.length > 0 && (
          <Card className="border-pub-amber/20 bg-pub-amber/5 mt-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold font-heading flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-pub-amber" /> Tips Praktis
              </h3>
              <ul className="space-y-1.5">
                {template.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-pub-amber shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
