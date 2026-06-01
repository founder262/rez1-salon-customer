import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, Calendar, Tag, ShieldCheck, ArrowLeft, Trash2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

const typeIcons: Record<string, any> = {
  promo: Tag,
  system: ShieldCheck,
  booking: Calendar,
};

const typeColors: Record<string, string> = {
  promo: "bg-red-500/10 text-red-500",
  system: "bg-yellow-500/10 text-yellow-500",
  booking: "bg-primary/10 text-primary",
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    const stored = localStorage.getItem('rez1-dismissed-notifs');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const { data: res, error } = await supabase.functions.invoke("admin-api", {
          body: {
            action: "SELECT",
            table: "notifications",
            query: "*",
            orderBy: { column: "created_at", ascending: false }
          }
        });

        if (res?.success) {
          const list = res.data || [];
          const filteredList = list.filter((n: any) =>
            (n.target_type === 'individual' && n.target_id === user.id) ||
            ["broadcast_customers", "broadcast_all"].includes(n.target_type)
          );
          setNotifications(filteredList);
        } else {
          console.error("fetchNotifications error:", res?.error || error);
        }
      } catch (err) {
        console.error("fetchNotifications error:", err);
      }
    };
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const clearAll = () => {
    const ids = notifications.map(n => n.id);
    const updated = [...new Set([...dismissed, ...ids])];
    setDismissed(updated);
    localStorage.setItem('rez1-dismissed-notifs', JSON.stringify(updated));
  };

  const visibleNotifications = notifications.filter(n => !dismissed.includes(n.id));

  return (
    <div className="min-h-[100dvh] bg-background safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card transition-all active:scale-90"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <h2 className="font-display text-base font-semibold text-foreground">
            Notifications
          </h2>
        </div>
        <button 
          onClick={clearAll}
          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear All
        </button>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-6 pb-20">
        <div className="space-y-4">
          {visibleNotifications.map((notif, i) => {
            const Icon = typeIcons[notif.notif_type] || Bell;
            const colorClass = typeColors[notif.notif_type] || "bg-muted text-muted-foreground";
            
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative overflow-hidden rounded-3xl border border-border bg-card p-4 transition-all active:scale-[0.98] shadow-sm`}
              >
                
                <div className="flex gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${colorClass}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display text-sm font-bold text-foreground">
                        {notif.title}
                      </h4>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Empty State */}
        {visibleNotifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Bell className="h-10 w-10 text-muted-foreground opacity-20" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">All caught up!</h3>
            <p className="text-sm text-muted-foreground">You don't have any new notifications.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
