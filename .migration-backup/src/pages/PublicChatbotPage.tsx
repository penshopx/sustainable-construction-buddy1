import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Bot, Loader2, MessageCircle, Send } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

type PublicChatbot = {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  mode: string;
  welcome_message: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MODE_LABELS: Record<string, string> = {
  pembelajaran: "Mentor Pembelajaran",
  profesi: "Chatbot Profesi",
  proyek: "Chatbot Proyek",
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Chatbot tidak dapat dimuat saat ini.";

export default function PublicChatbotPage() {
  const { token } = useParams<{ token: string }>();
  const [bot, setBot] = useState<PublicChatbot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "inactive">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBot = async () => {
      if (!token) {
        setStatus("error");
        setErrorMessage("Link chatbot tidak lengkap.");
        return;
      }

      setStatus("loading");
      try {
        const response = await fetch(`/api/public-chatbots/${encodeURIComponent(token)}`);
        if (response.status === 410) {
          throw Object.assign(new Error("Chatbot ini sudah tidak aktif atau link-nya sudah dicabut."), { code: "inactive" });
        }
        if (!response.ok) {
          throw new Error(response.status === 404 ? "Chatbot tidak ditemukan atau link sudah tidak berlaku." : "Chatbot tidak dapat dimuat saat ini.");
        }

        const data = await response.json() as PublicChatbot;
        if (!data?.id || !data.name) throw new Error("Konfigurasi chatbot tidak valid.");
        if (!cancelled) {
          setBot(data);
          setStatus("ready");
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setStatus((error && typeof error === "object" && "code" in error && error.code === "inactive") ? "inactive" : "error");
          setErrorMessage(getErrorMessage(error));
        }
      }
    };

    void loadBot();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const modeLabel = useMemo(() => MODE_LABELS[bot?.mode || ""] || "Asisten PUB", [bot?.mode]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || !token || isSending || !bot) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/public-chatbots/${encodeURIComponent(token)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await response.json().catch(() => null) as { reply?: unknown; error?: unknown } | null;
      const reply = data?.reply;
      if (!response.ok || typeof reply !== "string") {
        throw new Error(typeof data?.error === "string" ? data.error : "Gagal mendapatkan jawaban.");
      }
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch (error: unknown) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `Maaf, pesan belum dapat diproses. ${getErrorMessage(error)}` },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (status !== "ready" || !bot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-xl">
          {status === "loading" ? (
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-pub-sky" />
          ) : (
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          )}
          <h1 className="mt-4 font-heading text-xl font-bold">
            {status === "loading" ? "Memuat chatbot..." : status === "inactive" ? "Chatbot tidak aktif" : "Link chatbot tidak tersedia"}
          </h1>
          {status !== "loading" && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{errorMessage}</p>
          )}
          {status !== "loading" && (
            <Button asChild variant="outline" className="mt-5">
              <a href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke PUB ASPEKINDO</a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-pub-navy/10 text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
            {bot.avatar_url ? <img src={bot.avatar_url} alt="" className="h-full w-full object-cover" /> : <Bot className="h-5 w-5 text-primary" />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-bold">{bot.name}</p>
            <p className="text-xs text-muted-foreground">{modeLabel} · PUB ASPEKINDO</p>
          </div>
          <a href="/" className="ml-auto text-xs font-semibold text-pub-sky hover:underline">PUB ASPEKINDO</a>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-4xl flex-col px-3 py-4 sm:px-6 sm:py-8">
        <section className="flex min-h-[min(720px,calc(100vh-120px))] flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
          <div className="border-b border-border bg-gradient-to-r from-pub-sky to-pub-navy px-5 py-5 text-white sm:px-7">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5" />
              <div>
                <p className="font-heading text-sm font-bold">Percakapan privat melalui link</p>
                <p className="text-xs text-white/70">Tidak perlu membuka dashboard</p>
              </div>
            </div>
            {bot.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">{bot.description}</p>}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-7">
            {messages.length === 0 && (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-primary/10">
                  {bot.avatar_url ? <img src={bot.avatar_url} alt="" className="h-full w-full object-cover" /> : <Bot className="h-8 w-8 text-primary" />}
                </div>
                <h2 className="mt-4 font-heading text-xl font-bold">{bot.name}</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {bot.welcome_message || "Silakan ajukan pertanyaan Anda untuk memulai percakapan."}
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && (
                  <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                    {bot.avatar_url ? <img src={bot.avatar_url} alt="" className="h-full w-full object-cover" /> : <Bot className="h-4 w-4 text-primary" />}
                  </div>
                )}
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${message.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-muted/50"}`}>
                  {message.role === "assistant" ? <MarkdownRenderer>{message.content}</MarkdownRenderer> : <p className="whitespace-pre-wrap text-sm">{message.content}</p>}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Sedang menyiapkan jawaban...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-4 sm:p-5">
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ketik pertanyaan Anda..."
                disabled={isSending}
                className="h-11"
                aria-label="Pertanyaan untuk chatbot"
              />
              <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={isSending || !input.trim()}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Jawaban bersifat informatif dan bukan keputusan resmi.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}