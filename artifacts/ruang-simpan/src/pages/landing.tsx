import { Link } from 'wouter';
import { ArrowRight, Search, MessageSquareQuote, KeyRound, Lock } from 'lucide-react';
import { Brand } from '@/components/app-shell';
import { STATUS_META } from '@/lib/vault';
import { cn } from '@/lib/utils';

const FOLDERS = ['Legalitas', 'Teknis', 'Penawaran & RAB', 'SDM & Sertifikasi', 'Tender', 'Proyek', 'Umum'];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-5 py-4">
          <Brand />
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-secondary" data-testid="link-sign-in">Masuk</Link>
            <Link href="/sign-up" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground" data-testid="link-sign-up">Daftar gratis</Link>
          </div>
        </div>
      </header>

      <section className="relative grid-lines">
        <div className="mx-auto max-w-6xl px-5 pt-16 pb-20 md:pt-28 md:pb-28 grid lg:grid-cols-[1.25fr_1fr] gap-12 items-center">
          <div>
            <p className="rise font-mono-ui text-xs uppercase tracking-[0.25em] text-primary">Memori bisnis untuk badan usaha</p>
            <h1 className="rise mt-5 text-[44px] sm:text-6xl md:text-7xl font-extrabold leading-[0.95] tracking-tight" style={{ animationDelay: '80ms' }}>
              Dokumen tersimpan.<br /><span className="text-primary">Pengetahuan hidup.</span>
            </h1>
            <p className="rise mt-6 max-w-xl text-lg text-foreground/85" style={{ animationDelay: '160ms' }}>
              Penyimpanan biasa hanya menyimpan file. Ruang Simpan membaca isinya — akta, SBU, SOP, RAB — sehingga bisa dicari per kalimat dan ditanyakan ke asisten AI dengan kutipan sumber.
            </p>
            <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
              <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-bold text-primary-foreground" data-testid="link-hero-sign-up">Mulai dengan 50 MB gratis <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/sign-in" className="inline-flex items-center rounded-xl border border-border px-6 py-3.5 font-semibold hover:border-primary" data-testid="link-hero-sign-in">Saya sudah punya akun</Link>
            </div>
          </div>

          <div className="rise relative" style={{ animationDelay: '200ms' }}>
            <div className="absolute -inset-6 rounded-[32px] bg-primary/10 blur-2xl" />
            <div className="relative rounded-3xl bg-ice p-5 shadow-2xl rotate-[1.5deg]">
              <div className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-sm">
                <Search className="h-4 w-4" /><span className="opacity-70">masa berlaku SBU</span>
              </div>
              <div className="mt-3 space-y-2">
                {[['Sertifikat_Badan_Usaha.pdf', 'ready'], ['Akta_Pendirian_scan.jpg', 'stored'], ['RAB_Gedung_B.xlsx', 'ready']].map(([n, s]) => (
                  <div key={n} className="flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2.5">
                    <span className="font-mono-ui text-[10px] font-bold uppercase w-9">{n.split('.').pop()}</span>
                    <span className="flex-1 truncate text-sm font-semibold">{n}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{STATUS_META[s as 'ready'].label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] font-mono-ui opacity-60">Ilustrasi antarmuka — ruang kerja Anda mulai kosong.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="font-mono-ui text-xs uppercase tracking-[0.25em] text-primary">Cara kerja</p>
        <div className="mt-8 divide-y divide-border border-y border-border">
          {[
            { n: '01', icon: Search, t: 'Unggah, lalu cari isinya', d: 'Seret beberapa file sekaligus. Teks dari PDF, DOCX, XLSX, TXT, MD, dan CSV dibaca otomatis sehingga pencarian menemukan kalimat di dalam dokumen, bukan hanya nama file.' },
            { n: '02', icon: MessageSquareQuote, t: 'Tanya, dapat jawaban bersumber', d: 'Asisten AI menjawab dari dokumen Anda dan menunjukkan kutipan aslinya. Buat asisten khusus — misalnya hanya untuk dokumen tender.' },
            { n: '03', icon: KeyRound, t: 'Bagikan profil lewat izin terbatas', d: 'Satu profil resmi perusahaan untuk aplikasi tepercaya. Setiap aplikasi mendapat token sendiri, berlaku 90 hari, dan bisa dicabut kapan saja.' },
          ].map((s) => (
            <div key={s.n} className="grid md:grid-cols-[120px_1fr_1.3fr] gap-4 py-8 items-start">
              <span className="font-mono-ui text-4xl font-medium text-primary/70">{s.n}</span>
              <h3 className="text-2xl font-bold flex items-center gap-3"><s.icon className="h-6 w-6 text-primary" />{s.t}</h3>
              <p className="text-foreground/80 text-[17px] leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ice">
        <div className="mx-auto max-w-6xl px-5 py-20 grid lg:grid-cols-2 gap-12">
          <div>
            <p className="font-mono-ui text-xs uppercase tracking-[0.25em] opacity-70">Status yang jujur</p>
            <h2 className="mt-4 text-4xl md:text-5xl font-extrabold leading-[1.02] tracking-tight">Anda selalu tahu file mana yang benar-benar terbaca.</h2>
            <p className="mt-5 text-lg opacity-80">Tidak semua file berisi teks. Kami tidak berpura-pura: hasil scan gambar disimpan apa adanya sampai OCR tersedia.</p>
          </div>
          <div className="space-y-3">
            {(['ready', 'stored', 'failed'] as const).map((s, i) => (
              <div key={s} className={cn('rounded-2xl p-5 bg-white/70', i === 1 && 'md:ml-8', i === 2 && 'md:ml-16')}>
                <p className="font-bold text-lg">{STATUS_META[s].label}</p>
                <p className="opacity-80 mt-1">{STATUS_META[s].hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="font-mono-ui text-xs uppercase tracking-[0.25em] text-primary">Folder siap pakai untuk badan usaha</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {FOLDERS.map((f) => <span key={f} className="rounded-full border border-border px-5 py-2.5 text-lg font-semibold">{f}</span>)}
          <span className="rounded-full border border-dashed border-primary/60 text-primary px-5 py-2.5 text-lg font-semibold">+ folder Anda sendiri</span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 grid md:grid-cols-[1fr_1.4fr] gap-10 items-start">
        <div className="rounded-3xl border border-border bg-card p-8">
          <Lock className="h-8 w-8 text-primary" />
          <h3 className="mt-4 text-2xl font-bold">Privat secara bawaan</h3>
          <p className="mt-2 text-foreground/80">Dokumen hanya terlihat oleh akun Anda. Sebelum bertanya ke AI, Anda diminta menyetujui pengiriman potongan teks ke layanan AI eksternal — setiap kali.</p>
        </div>
        <div className="p-2">
          <p className="font-mono-ui text-xs uppercase tracking-[0.25em] text-primary">Paket</p>
          <p className="mt-4 text-6xl md:text-7xl font-extrabold tracking-tight">50 MB</p>
          <p className="mt-2 text-xl text-foreground/85">Gratis. Maksimal 50 MB per file, sesuai sisa kuota ruang simpan. OCR maksimal 15 MiB per file.</p>
          <Link href="/sign-up" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-bold text-primary-foreground" data-testid="link-footer-sign-up">Buat ruang kerja <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row justify-between gap-3 text-sm text-muted-foreground">
          <Brand />
          <span>Memori bisnis dokumen untuk badan usaha Indonesia.</span>
        </div>
      </footer>
    </div>
  );
}
