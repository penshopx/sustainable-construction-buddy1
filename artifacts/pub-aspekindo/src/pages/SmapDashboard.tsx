import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, FileText, Award, GraduationCap, ShieldAlert } from "lucide-react";
import SuratPernyataanTab from "@/components/smap/SuratPernyataanTab";
import SertifikatIsoTab from "@/components/smap/SertifikatIsoTab";
import PendidikanAntikorupsiTab from "@/components/smap/PendidikanAntikorupsiTab";
import PancekAssessment from "@/pages/PancekAssessment";
import SmapPilotPanel from "@/components/smap/SmapPilotPanel";

export default function SmapDashboard() {
  const [tab, setTab] = useState("pancek");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-pub-amber/20 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-pub-amber" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">SMAP</h1>
          <p className="text-sm text-muted-foreground">
            Sistem Manajemen Anti Penyuapan — SNI ISO 37001:2016
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {import.meta.env.DEV && <TabsTrigger value="pilot" className="gap-2 text-xs sm:text-sm">
            <ShieldCheck className="w-4 h-4" /> Pilot AI baca-saja
          </TabsTrigger>}
          <TabsTrigger value="pancek" className="gap-2 text-xs sm:text-sm">
            <ShieldAlert className="w-4 h-4" /> PANCEK KPK
          </TabsTrigger>
          <TabsTrigger value="surat" className="gap-2 text-xs sm:text-sm">
            <FileText className="w-4 h-4" /> Surat Pernyataan
          </TabsTrigger>
          <TabsTrigger value="iso" className="gap-2 text-xs sm:text-sm">
            <Award className="w-4 h-4" /> Sertifikat ISO 37001
          </TabsTrigger>
          <TabsTrigger value="pendidikan" className="gap-2 text-xs sm:text-sm">
            <GraduationCap className="w-4 h-4" /> Pendidikan Anti Korupsi
          </TabsTrigger>
        </TabsList>

        {import.meta.env.DEV && <TabsContent value="pilot" className="mt-6">
          <SmapPilotPanel />
        </TabsContent>}

        <TabsContent value="pancek" className="mt-6">
          <PancekAssessment />
        </TabsContent>
        <TabsContent value="surat" className="mt-6">
          <SuratPernyataanTab />
        </TabsContent>
        <TabsContent value="iso" className="mt-6">
          <SertifikatIsoTab />
        </TabsContent>
        <TabsContent value="pendidikan" className="mt-6">
          <PendidikanAntikorupsiTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
