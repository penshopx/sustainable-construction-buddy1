import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Calendar, MapPin, Users, UserCheck, UserX,
  Newspaper, Image as ImageIcon, Search, Download, Trash2, FileText,
} from "lucide-react";
import { exportParticipantPdf } from "@/lib/participantPdf";
import { usePrograms, useProgramUpdates, useProgramGallery, useDeleteProgramUpdate, useDeleteGalleryItem } from "@/hooks/usePrograms";
import { useUpdateProgram, type ProgramPublicationStatus } from "@/hooks/usePrograms";
import { useParticipants, useUpdateParticipant, useDeleteParticipant } from "@/hooks/useParticipants";
import { useAdmin } from "@/hooks/useAdmin";
import { AddParticipantDialog } from "@/components/participants/AddParticipantDialog";
import { DetailParticipantImport } from "@/components/participants/DetailParticipantImport";
import { EditParticipantDialog } from "@/components/participants/EditParticipantDialog";
import { GalleryUploadDialog } from "@/components/gallery/GalleryUploadDialog";
import { AddUpdateDialog } from "@/components/programs/AddUpdateDialog";
import { EditUpdateDialog } from "@/components/programs/EditUpdateDialog";
import { toast } from "@/components/ui/sonner-toast";

const statusConfig: Record<string, { label: string; color: string }> = {
  upcoming: { label: "Akan Datang", color: "bg-pub-amber/15 text-pub-amber" },
  ongoing: { label: "Sedang Berjalan", color: "bg-pub-emerald/15 text-pub-emerald" },
  completed: { label: "Selesai", color: "bg-muted text-muted-foreground" },
};

const publicationConfig: Record<ProgramPublicationStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-pub-amber/15 text-pub-amber" },
  published: { label: "Published", color: "bg-pub-emerald/15 text-pub-emerald" },
  archived: { label: "Archived", color: "bg-muted text-muted-foreground" },
};

const attendanceLabels: Record<string, { label: string; color: string }> = {
  registered: { label: "Terdaftar", color: "bg-pub-sky/15 text-pub-sky" },
  attended: { label: "Hadir", color: "bg-pub-emerald/15 text-pub-emerald" },
  absent: { label: "Tidak Hadir", color: "bg-destructive/15 text-destructive" },
};

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const { data: programs = [], isLoading: loadingProgram } = usePrograms();
  const { data: allUpdates = [], isLoading: loadingUpdates } = useProgramUpdates();
  const { data: allGallery = [], isLoading: loadingGallery } = useProgramGallery();
  const { data: allParticipants = [], isLoading: loadingParticipants } = useParticipants(id);
  const updateParticipant = useUpdateParticipant();
  const delParticipant = useDeleteParticipant();
  const delUpdate = useDeleteProgramUpdate();
  const delGallery = useDeleteGalleryItem();
  const updateProgram = useUpdateProgram();
  const [search, setSearch] = useState("");

  const program = programs.find((p) => p.id === id);
  const updates = allUpdates.filter((u) => u.program_id === id);
  const gallery = allGallery.filter((g) => g.program_id === id);

  const searchLower = search.toLowerCase();
  const participants = allParticipants.filter((p) => {
    if (!searchLower) return true;
    return p.full_name.toLowerCase().includes(searchLower) || p.company.toLowerCase().includes(searchLower);
  });

  const attendedCount = participants.filter((p) => p.attendance_status === "attended").length;
  const absentCount = participants.filter((p) => p.attendance_status === "absent").length;

  const exportCsv = () => {
    if (participants.length === 0) return;
    const headers = ["Nama", "Perusahaan", "Jabatan", "Email", "Telepon", "Status", "Catatan"];
    const rows = participants.map((p) => [
      p.full_name, p.company, p.position, p.email, p.phone,
      attendanceLabels[p.attendance_status]?.label || p.attendance_status, p.notes,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peserta-${program?.title?.replace(/\s+/g, "-") || "program"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingProgram) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (!program) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-muted-foreground">Program tidak ditemukan.</p>
      <Button variant="outline" onClick={() => navigate("/admin/program-kegiatan")}><ArrowLeft className="w-4 h-4 mr-2" /> Kembali</Button>
    </div>
  );

  const config = statusConfig[program.status] || statusConfig.upcoming;
  const publication = publicationConfig[program.publication_status] || publicationConfig.draft;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="mt-1 shrink-0" onClick={() => navigate("/admin/program-kegiatan")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-heading">{program.title}</h1>
            <Badge className={`${config.color} text-xs`}>{config.label}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{program.category}</Badge>
            <Badge className={`${publication.color} text-xs`}>{publication.label}</Badge>
          </div>
          {isAdmin && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status publikasi:</span>
              <Select
                defaultValue={program.publication_status}
                onValueChange={(value) => updateProgram.mutate(
                  { id: program.id, publication_status: value as ProgramPublicationStatus },
                  {
                    onSuccess: () => toast.success(`Program ${publicationConfig[value as ProgramPublicationStatus].label.toLowerCase()}`),
                    onError: () => toast.error("Gagal mengubah status publikasi"),
                  },
                )}
              >
                <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Status publikasi"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {program.description && <p className="text-sm text-muted-foreground mt-1">{program.description}</p>}
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
            {program.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(program.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                {program.end_date && ` — ${new Date(program.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}
              </span>
            )}
            {program.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {program.location}</span>}
          </div>
          {program.status === "ongoing" && (
            <div className="mt-3 max-w-sm space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{program.progress_percent}%</span></div>
              <Progress value={program.progress_percent} className="h-2" />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="participants" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="participants" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" /> Peserta ({allParticipants.length})</TabsTrigger>
          <TabsTrigger value="updates" className="gap-1.5 text-xs"><Newspaper className="w-3.5 h-3.5" /> Update ({updates.length})</TabsTrigger>
          <TabsTrigger value="gallery" className="gap-1.5 text-xs"><ImageIcon className="w-3.5 h-3.5" /> Galeri ({gallery.length})</TabsTrigger>
        </TabsList>

        {/* Participants */}
        <TabsContent value="participants" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cari nama atau perusahaan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            {isAdmin && (
              <>
                <AddParticipantDialog programId={id!} />
                <DetailParticipantImport programId={id!} />
              </>
            )}
            {participants.length > 0 && (
              <>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => exportParticipantPdf(program, allParticipants)}>
                  <FileText className="w-3.5 h-3.5" /> Export PDF
                </Button>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={exportCsv}>
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-3 text-center">
              <Users className="w-4 h-4 text-pub-sky mx-auto mb-1" />
              <p className="text-xl font-bold">{participants.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Peserta</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <UserCheck className="w-4 h-4 text-pub-emerald mx-auto mb-1" />
              <p className="text-xl font-bold text-pub-emerald">{attendedCount}</p>
              <p className="text-[10px] text-muted-foreground">Hadir</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <UserX className="w-4 h-4 text-destructive mx-auto mb-1" />
              <p className="text-xl font-bold text-destructive">{absentCount}</p>
              <p className="text-[10px] text-muted-foreground">Tidak Hadir</p>
            </CardContent></Card>
          </div>

          {loadingParticipants ? <Skeleton className="h-40" /> : participants.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">{search ? "Tidak ada peserta yang cocok." : "Belum ada peserta terdaftar."}</p></Card>
          ) : (
            <Card>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-10">No</TableHead>
                      <TableHead className="text-xs">Nama</TableHead>
                      <TableHead className="text-xs">Perusahaan</TableHead>
                      <TableHead className="text-xs">Jabatan</TableHead>
                      <TableHead className="text-xs">Kontak</TableHead>
                      <TableHead className="text-xs">Kehadiran</TableHead>
                      {isAdmin && <TableHead className="text-xs w-10">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{p.full_name}</TableCell>
                        <TableCell className="text-xs">{p.company || "-"}</TableCell>
                        <TableCell className="text-xs">{p.position || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {p.email && <div>{p.email}</div>}
                          {p.phone && <div className="text-muted-foreground">{p.phone}</div>}
                          {!p.email && !p.phone && "-"}
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Select defaultValue={p.attendance_status} onValueChange={(v) => updateParticipant.mutate({ id: p.id, attendance_status: v, attended_at: v === "attended" ? new Date().toISOString() : null })}>
                              <SelectTrigger className="h-7 text-[10px] w-[100px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="registered">Terdaftar</SelectItem>
                                <SelectItem value="attended">Hadir</SelectItem>
                                <SelectItem value="absent">Tidak Hadir</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={`${attendanceLabels[p.attendance_status]?.color || ""} text-[10px]`}>
                              {attendanceLabels[p.attendance_status]?.label || p.attendance_status}
                            </Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-0.5">
                              <EditParticipantDialog participant={p} />
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Hapus peserta?")) delParticipant.mutate(p.id); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Updates */}
        <TabsContent value="updates" className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <AddUpdateDialog programId={id!} />
            </div>
          )}
          {loadingUpdates ? <Skeleton className="h-40" /> : updates.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">Belum ada update untuk program ini.</p></Card>
          ) : (
            <div className="space-y-3">
              {updates.map((u) => (
                <Card key={u.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{u.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(u.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                        <p className="text-sm mt-2 whitespace-pre-wrap">{u.content}</p>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 shrink-0">
                          <EditUpdateDialog update={u} />
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Hapus update?")) delUpdate.mutate(u.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Gallery */}
        <TabsContent value="gallery" className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <GalleryUploadDialog programId={id!} />
            </div>
          )}
          {loadingGallery ? <Skeleton className="h-40" /> : gallery.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">Belum ada foto untuk program ini.</p></Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {gallery.map((g) => (
                <Card key={g.id} className="overflow-hidden group relative">
                  <img src={g.image_url} alt={g.caption} className="w-full aspect-square object-cover" loading="lazy" />
                  {(g.caption || isAdmin) && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      {g.caption && <p className="text-[10px] text-white truncate">{g.caption}</p>}
                      {isAdmin && (
                        <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { if (confirm("Hapus foto?")) delGallery.mutate(g.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
