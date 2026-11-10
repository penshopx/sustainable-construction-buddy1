import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props { disabled: boolean; busy: boolean; label: string; placeholder: string; onSend: (t: string) => Promise<void> | void; maxLength?: number; id: string }

export default function FollowUpComposer({ disabled, busy, label, placeholder, onSend, maxLength = 3600, id }: Props) {
  const [text, setText] = useState("");
  const submit = async () => {
    const t = text.trim();
    if (!t || disabled || busy) return;
    await onSend(t);
    setText("");
  };
  return (
    <form className="space-y-2" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <Textarea id={id} rows={3} value={text} maxLength={maxLength} disabled={disabled || busy} placeholder={placeholder} onChange={e => setText(e.target.value)} data-testid={`input-${id}`} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{text.length}/{maxLength} karakter</span>
        <Button type="submit" disabled={disabled || busy || !text.trim()} data-testid={`button-${id}`}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Kirim
        </Button>
      </div>
    </form>
  );
}
