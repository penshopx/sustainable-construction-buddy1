import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { isAppNotification, mergeNotifications, type AppNotification } from "@/lib/notificationState";

const typeIcon: Record<string, string> = {
  level_up: "🎉",
  certificate: "🏆",
  competency_insight_fallback: "⚠️",
  info: "ℹ️",
};

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    let cancelled = false;
    setNotifications([]);
    setLoading(true);
    if (!user) return () => { cancelled = true; };

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (data) setNotifications((prev) => mergeNotifications(prev, data as AppNotification[]));
      setLoading(false);
    };
    void fetchNotifications();

    let hasSubscribed = false;
    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const notification = payload.new as unknown;
          if (!isAppNotification(notification)) return;
          setNotifications((prev) => mergeNotifications(prev, [notification]));
        }
      )
      .subscribe((status) => {
        if (cancelled) return;

        if (status === "SUBSCRIBED") {
          if (hasSubscribed) void fetchNotifications();
          hasSubscribed = true;
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          void fetchNotifications();
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Bell className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Notifikasi</h1>
            <p className="text-sm text-muted-foreground font-body">
              {unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="w-4 h-4" />
            Tandai semua dibaca
          </Button>
        )}
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-body font-semibold">Belum ada notifikasi</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">Anda akan menerima notifikasi saat:</p>
          <div className="grid sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
            {[
              { emoji: "🎉", title: "Naik Level", desc: "Level kompetensi Anda meningkat" },
              { emoji: "🏆", title: "Sertifikat Baru", desc: "Sertifikat berhasil diterbitkan" },
              { emoji: "📋", title: "PANCEK Terverifikasi", desc: "Asesmen diverifikasi oleh Asosiasi" },
            ].map((ex, i) => (
              <div key={i} className="p-3 rounded-lg border border-dashed border-border bg-muted/30">
                <span className="text-lg">{ex.emoji}</span>
                <p className="text-xs font-heading font-semibold text-foreground mt-1">{ex.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{ex.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`bg-card border border-border rounded-xl p-4 shadow-card transition-colors ${!n.is_read ? "border-l-4 border-l-primary" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{typeIcon[n.type] || "📌"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold text-foreground">{n.title}</p>
                  <p className="text-sm text-muted-foreground font-body mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: id })}
                  </p>
                </div>
                {!n.is_read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
