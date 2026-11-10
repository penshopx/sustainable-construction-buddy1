import { MessageCircle } from "lucide-react";
import FloatingChatbot from "@/components/FloatingChatbot";

export default function PublicHelpdeskPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pub-sky to-pub-navy">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-heading text-sm font-bold">PUB ASPEKINDO</p>
            <p className="text-xs text-muted-foreground">HelpDesk publik</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-pub-sky">Pusat bantuan</p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            Tanya PUB HelpDesk
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Panduan fitur dan jawaban seputar PUB ASPEKINDO dalam satu halaman yang bisa dibagikan.
          </p>
        </div>

        <FloatingChatbot variant="landing" standalone initialOpen />

        <p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-5 text-muted-foreground">
          Jawaban AI bersifat informatif. Untuk keputusan resmi, selalu periksa regulasi dan sumber berwenang.
        </p>
      </main>
    </div>
  );
}