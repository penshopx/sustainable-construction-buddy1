import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, XCircle, Eye, Clock, FileText, Send, Lightbulb, Paperclip, Download, MessageCircle, Shield } from "lucide-react";
import { useProposalDetail, useProposalLogs, useProposalComments, useAddComment } from "@/hooks/useInnovations";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner-toast";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  submitted: { label: "Diajukan", color: "bg-pub-amber/15 text-pub-amber", icon: Send },
  reviewed: { label: "Direview", color: "bg-pub-sky/15 text-pub-sky", icon: Eye },
  approved: { label: "Disetujui", color: "bg-pub-emerald/15 text-pub-emerald", icon: CheckCircle2 },
  rejected: { label: "Ditolak", color: "bg-destructive/15 text-destructive", icon: XCircle },
};

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: proposal, isLoading } = useProposalDetail(id);
  const { data: logs = [], isLoading: logsLoading } = useProposalLogs(id);
  const { data: comments = [], isLoading: commentsLoading } = useProposalComments(id);
  const addComment = useAddComment();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [commentText, setCommentText] = useState("");

  const handleSendComment = async () => {
    if (!commentText.trim() || !id) return;
    try {
      await addComment.mutateAsync({ proposal_id: id, message: commentText.trim(), is_admin: isAdmin });
      setCommentText("");
    } catch {
      toast.error("Gagal mengirim komentar");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Proposal tidak ditemukan.</p>
        <Button className="mt-4" onClick={() => navigate("/inovasi")}>Kembali</Button>
      </Card>
    );
  }

  const currentStatus = statusConfig[proposal.status] || statusConfig.draft;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </Button>

      {/* Proposal Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-accent" />
              </div>
              <div>
                <CardTitle className="text-xl">{proposal.title}</CardTitle>
                {proposal.innovation_categories && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Kategori: {proposal.innovation_categories.name}
                  </p>
                )}
              </div>
            </div>
            <Badge className={currentStatus.color + " text-sm px-3 py-1"}>
              {currentStatus.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Deskripsi</h4>
            <p className="text-sm text-muted-foreground">{proposal.description || "-"}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Lingkup Penerapan</h4>
              <p className="text-sm text-muted-foreground">{proposal.scope || "-"}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Dampak yang Diharapkan</h4>
              <p className="text-sm text-muted-foreground">{proposal.expected_impact || "-"}</p>
            </div>
          </div>
          {proposal.admin_notes && (
            <div className="p-3 rounded-lg bg-muted">
              <h4 className="text-sm font-medium mb-1">Catatan Admin</h4>
              <p className="text-sm text-muted-foreground">{proposal.admin_notes}</p>
            </div>
          )}
          {proposal.attachment_url && proposal.attachment_name && (
            <div>
              <h4 className="text-sm font-medium mb-1">Lampiran</h4>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  const { data } = await supabase.storage
                    .from("innovation-attachments")
                    .createSignedUrl(proposal.attachment_url, 300);
                  if (data?.signedUrl) {
                    window.open(data.signedUrl, "_blank");
                  } else {
                    toast.error("Gagal membuka lampiran");
                  }
                }}
              >
                <Paperclip className="w-4 h-4" />
                {proposal.attachment_name}
                <Download className="w-3 h-3" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Dibuat: {new Date(proposal.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" /> Riwayat Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada perubahan status.</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />

              <div className="space-y-6">
                {/* Initial creation */}
                <div className="relative flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center z-10 shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="text-sm font-medium">Proposal dibuat</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(proposal.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {logs.map((log) => {
                  const config = statusConfig[log.new_status] || statusConfig.draft;
                  const Icon = config.icon;
                  return (
                    <div key={log.id} className="relative flex gap-4 items-start">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 shrink-0 ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">
                            Status berubah: <span className="text-muted-foreground">{statusConfig[log.old_status]?.label || log.old_status}</span>
                            {" → "}
                            <Badge className={config.color + " text-xs"}>{config.label}</Badge>
                          </p>
                        </div>
                        {log.notes && (
                          <p className="text-xs text-muted-foreground mt-1 p-2 rounded bg-muted">
                            {log.notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(log.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments / Diskusi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Diskusi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {commentsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada komentar.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className={`p-3 rounded-lg ${c.is_admin ? "bg-accent/10 border border-accent/20" : "bg-muted"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{c.author_name}</span>
                    {c.is_admin && (
                      <Badge variant="outline" className="text-xs gap-1 py-0">
                        <Shield className="w-3 h-3" /> Admin
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(c.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.message}</p>
                </div>
              ))}
            </div>
          )}

          {user && (
            <div className="flex gap-2 pt-2 border-t">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Tulis komentar..."
                rows={2}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendComment();
                  }
                }}
              />
              <Button
                size="icon"
                onClick={handleSendComment}
                disabled={!commentText.trim() || addComment.isPending}
                className="shrink-0 self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
