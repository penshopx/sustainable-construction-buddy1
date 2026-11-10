import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal, Award, Crown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string;
  company: string;
  current_level: string;
  total_score: number;
  modules_completed: number;
  modules_in_progress: number;
  total_modules: number;
  composite_score: number;
}

const levelColor: Record<string, string> = {
  Pemula: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  Muda: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Madya: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  Utama: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

const RankIcon = ({ rank }: { rank: number }) => {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await supabase.functions.invoke("get-leaderboard", {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (res.error) throw res.error;
        if (res.data?.error) throw new Error(res.data.error);
        setEntries(res.data.leaderboard);
        setCurrentUserId(res.data.current_user_id);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Gagal memuat leaderboard");
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const myEntry = entries.find((e) => e.user_id === currentUserId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-destructive">
        <p>Gagal memuat leaderboard: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">Ranking pengguna berdasarkan skor dan progress modul</p>
        </div>
      </div>

      {/* My Rank Card */}
      {myEntry && (
        <Card className="border-2 border-accent/30">
          <CardContent className="flex items-center gap-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-xl font-bold text-accent">#{myEntry.rank}</span>
              </div>
              <div>
                <p className="font-bold font-heading text-foreground">{myEntry.full_name}</p>
                <p className="text-xs text-muted-foreground">{myEntry.company}</p>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">{myEntry.composite_score}</p>
                <p className="text-xs text-muted-foreground">Skor Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{myEntry.modules_completed}/{myEntry.total_modules}</p>
                <p className="text-xs text-muted-foreground">Modul Selesai</p>
              </div>
              <div>
                <Badge className={levelColor[myEntry.current_level] || "bg-muted text-muted-foreground"}>
                  {myEntry.current_level}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Level</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 3 Podium */}
      {entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[entries[1], entries[0], entries[2]].map((entry, i) => {
            const order = [2, 1, 3][i];
            const heights = ["h-28", "h-36", "h-24"];
            const colors = [
              "from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700",
              "from-yellow-300 to-amber-400 dark:from-yellow-600 dark:to-amber-700",
              "from-amber-500 to-amber-600 dark:from-amber-700 dark:to-amber-800",
            ];
            return (
              <div key={entry.user_id} className="flex flex-col items-center">
                <p className="text-sm font-bold text-foreground truncate max-w-full mb-1">{entry.full_name}</p>
                <p className="text-xs text-muted-foreground mb-2">{entry.composite_score} pts</p>
                <div className={cn("w-full rounded-t-lg bg-gradient-to-b flex items-start justify-center pt-3", heights[i], colors[i])}>
                  <span className="text-2xl font-bold text-white">#{order}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Award className="w-5 h-5 text-accent" /> Ranking Lengkap
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Progress Modul</TableHead>
                <TableHead className="text-right">Skor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada data</TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const isMe = entry.user_id === currentUserId;
                  const progressPercent = entry.total_modules > 0
                    ? Math.round((entry.modules_completed / entry.total_modules) * 100)
                    : 0;
                  return (
                    <TableRow key={entry.user_id} className={cn(isMe && "bg-accent/10")}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <RankIcon rank={entry.rank} />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.full_name}
                        {isMe && <Badge variant="outline" className="ml-2 text-[10px] py-0">Anda</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.company}</TableCell>
                      <TableCell>
                        <Badge className={levelColor[entry.current_level] || "bg-muted text-muted-foreground"}>
                          {entry.current_level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={progressPercent} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground w-16">
                            {entry.modules_completed}/{entry.total_modules}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">{entry.composite_score}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
