import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { PushToggle } from "@/components/PushToggle";
import { UpiPayDialog } from "@/components/UpiPayDialog";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Receipt, Megaphone, MessageSquare, Sparkles, Users, Bell, Shield,
  CheckCircle2, Clock, XCircle, ChevronRight, IndianRupee, Image,
} from "lucide-react";

type Payment = {
  id: string;
  plot_number: string;
  amount: number;
  month: string;
  utr_ref: string | null;
  proof_url: string | null;
  status: "pending" | "confirmed" | "rejected";
  created_at: string;
};

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1).toLocaleString("default", { month: "short", year: "numeric" });
}

export default function Dashboard() {
  const { profile, isAdmin, user } = useAuth();
  const firstName = profile?.name?.split(" ")[0] ?? "Resident";
  const [payOpen, setPayOpen] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plotNumber, setPlotNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Load payments and plot number
    Promise.all([
      supabase
        .from("maintenance_payments")
        .select("id, plot_number, amount, month, utr_ref, proof_url, status, created_at")
        .eq("paid_by", user.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("profiles")
        .select("plot:plots(plot_number)")
        .eq("id", user.id)
        .maybeSingle(),
    ]).then(([payRes, profRes]) => {
      setPayments((payRes.data ?? []) as Payment[]);
      const plot = (profRes.data as { plot?: { plot_number: string } | null } | null)?.plot;
      setPlotNumber(plot?.plot_number ?? null);
    });
  }, [user]);

  const liveCards = [
    { to: "/announcements", icon: Megaphone, label: "Announcements", desc: "Latest community updates", color: "from-accent to-primary-glow" },
    { to: "/complaints", icon: MessageSquare, label: "Complaints", desc: "Raise & track issues", color: "from-primary to-accent" },
    { to: "/directory", icon: Users, label: "Resident directory", desc: "Find your neighbours", color: "from-primary to-primary-glow" },
  ];

  const statusIcon = (s: string) => {
    if (s === "confirmed") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (s === "rejected") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-warning" />;
  };

  const statusBadge = (s: string) => {
    if (s === "confirmed") return <Badge className="bg-success/10 text-success border-0 text-[10px]">Confirmed</Badge>;
    if (s === "rejected") return <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]">Rejected</Badge>;
    return <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Pending</Badge>;
  };

  return (
    <AppShell>
      <section className="mb-8">
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-3xl font-semibold tracking-tight mt-0.5">Hello, {firstName}</h1>
        {plotNumber && <p className="text-sm text-muted-foreground mt-1">Plot {plotNumber}</p>}
      </section>

      <section className="soft-card p-5 mb-6 bg-gradient-primary text-primary-foreground">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-foreground/15 flex items-center justify-center backdrop-blur">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">You're all set</p>
            <p className="text-sm opacity-90 mt-0.5">Browse announcements, raise complaints, and connect with your community.</p>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="soft-card p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold">Admin notifications</p>
                <Shield className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 mb-3">
                Get notified when a new resident needs approval.
              </p>
              <PushToggle />
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-3 mb-6">
        {liveCards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} to={c.to} className="soft-card p-4 flex items-center gap-4 hover:translate-y-[-1px] transition-transform">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-primary-foreground shadow-soft`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{c.label}</p>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}

        <button
          onClick={() => setPayOpen(true)}
          className="soft-card p-4 flex items-center gap-4 text-left active:scale-[0.99] transition-transform"
        >
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground shadow-soft">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Pay maintenance</p>
            <p className="text-sm text-muted-foreground">Pay directly via your UPI app</p>
          </div>
          <span className="text-xs uppercase tracking-wide text-primary font-semibold">UPI</span>
        </button>
      </section>

      {/* Payment history */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Payment history</h2>
          {payments.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IndianRupee className="h-3.5 w-3.5" />
              {payments.filter(p => p.status === "confirmed").length} confirmed
            </div>
          )}
        </div>
        {payments.length === 0 ? (
          <div className="soft-card p-6 text-center text-muted-foreground text-sm">
            No payments recorded yet. Pay via UPI and submit a record above.
          </div>
        ) : (
          <div className="soft-card overflow-hidden">
            <div className="divide-y divide-border/40">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="shrink-0">{statusIcon(p.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{fmtMonth(p.month)}</p>
                      {statusBadge(p.status)}
                    </div>
                    {p.utr_ref && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">UTR: {p.utr_ref}</p>
                    )}
                    {p.proof_url ? (
                      <a href={p.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-0.5">
                        <Image className="h-3 w-3" /> View screenshot
                      </a>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold shrink-0">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <UpiPayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        payerName={profile?.name}
        plotNumber={plotNumber ?? undefined}
      />
    </AppShell>
  );
}
