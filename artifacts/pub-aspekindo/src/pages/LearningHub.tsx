import { ArrowRight, CalendarDays, GraduationCap, Target } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Courses from "./Courses";
import { AspekindoLmsCatalog } from "./AspekindoLmsNative";

export default function LearningHub() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeTab = pathname === "/aspekindo-lms" ? "activities" : "courses";

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-card md:flex-row md:items-center md:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-pub-sky">Kompetensi & kegiatan PUB</p>
          <h1 className="mt-2 text-2xl font-bold font-heading text-foreground md:text-3xl">Pusat Pembelajaran PUB</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Bedakan E-Course umum untuk kompetensi mandiri, LMS native ASPEKINDO untuk kursus
            dan bukti kegiatan internal, serta tautan eksternal yang tetap memakai akun platform asal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/siap-kompetensi")}
          className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-pub-navy px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Target className="h-4 w-4" />
          Lihat peta 4 SIAP
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => navigate(value === "activities" ? "/aspekindo-lms" : "/courses", { replace: true })}
      >
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger value="courses" className="gap-2 py-2.5">
            <GraduationCap className="h-4 w-4" /> E-Course umum
          </TabsTrigger>
          <TabsTrigger value="activities" className="gap-2 py-2.5">
            <CalendarDays className="h-4 w-4" /> LMS ASPEKINDO
          </TabsTrigger>
        </TabsList>
        <TabsContent value="courses" className="mt-6">
          <Courses embedded />
        </TabsContent>
        <TabsContent value="activities" className="mt-6">
          <AspekindoLmsCatalog />
        </TabsContent>
      </Tabs>
    </div>
  );
}