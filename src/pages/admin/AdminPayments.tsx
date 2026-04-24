import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2, CheckCircle2, XCircle, Download, IndianRupee,
  AlertTriangle, Clock, Search, X, ChevronDown, ChevronUp,
  TrendingUp, Filter,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Payment = {
  id: string;
  plot_number: string;
  payer_name: string | null;
  amount: number;
  month: string;
  utr_ref: string | null;
  status: "pending" | "confirmed" | "rejected";
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
};

type DueEntry = {
  plot_number: string;
  owner_name: string | null;
  overdueMonths: string[];
  totalDue: number;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return d.toISOString().slice(0, 7);
});

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1).toLocaleString("default", { month: "short", year: "numeric" });
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dues, setDues] = useState<DueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<"payments" | "dues">("payments");
  const [actionTarget, setActionTarget] = useState<{ payment: Payment; action: "confirm" | "reject" } | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [expandedDue, setExpandedDue] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: payData }, { data: setting }, { data: dsData }] = await Promise.all([
      supabase
        .from("maintenance_payments")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("settings").select("value").eq("key", "monthly_amount").maybeSingle(),
      supabase.from("dataset_entries").select("plot_number, owner_name"),
    ]);

    const amount = Number(setting?.value ?? 0);
    setMonthlyAmount(amount);
    const allPayments = (payData ?? []) as Payment[];
    setPayments(allPayments);

    // Compute dues — check last 6 months
    if (amount > 0) {
      const last6 = MONTHS.slice(0, 6);
      const confirmedSet = new Set(
        allPayments
          .filter((p) => p.status === "confirmed")
          .map((p) => `${p.plot_number}::${p.month}`)
      );
      const allPlots = Array.from(
        new Map((dsData ?? []).map((d) => [d.plot_number, d.owner_name])).entries()
      ).map(([plot_number, owner_name]) => ({ plot_number, owner_name }));

      const dueList: DueEntry[] = allPlots
        .map(({ plot_number, owner_name }) => {
          const overdueMonths = last6.filter((m) => !confirmedSet.has(`${plot_number}::${m}`));
          return {
            plot_number,
            owner_name,
            overdueMonths,
            totalDue: overdueMonths.length * amount,
          };
        })
        .filter((d) => d.overdueMonths.length > 0)
        .sort((a, b) => b.overdueMonths.length - a.overdueMonths.length);

      setDues(dueList);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = payments.filter((p) => {
    if (monthFilter !== "all" && p.month !== monthFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (q) {
      const s = q.toLowerCase();
      if (
        !p.plot_number.toLowerCase().includes(s) &&
        !(p.payer_name ?? "").toLowerCase().includes(s) &&
        !(p.utr_ref ?? "").toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const confirmed = payments.filter((p) => p.status === "confirmed");
  const pending = payments.filter((p) => p.status === "pending");
  const totalCollected = confirmed.reduce((s, p) => s + p.amount, 0);

  const doAction = async () => {
    if (!actionTarget) return;
    setActionBusy(true);
    const { error } = await supabase.rpc("confirm_payment", {
      _payment_id: actionTarget.payment.id,
      _action: actionTarget.action,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(actionTarget.action === "confirm" ? "Payment confirmed ✓" : "Payment rejected");
      setActionTarget(null);
      setActionNotes("");
      load();
    }
    setActionBusy(false);
  };

  const exportCSV = () => {
    const rows = [
      ["Plot", "Payer", "Month", "Amount (₹)", "Status", "UTR Ref", "Date"],
      ...filtered.map((p) => [
        p.plot_number,
        p.payer_name ?? "",
        fmtMonth(p.month),
        p.amount.toFixed(2),
        p.status,
        p.utr_ref ?? "",
        new Date(p.created_at).toLocaleString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDuesCSV = () => {
    const rows = [
      ["Plot", "Owner", "Overdue Months", "Total Due (₹)"],
      ...dues.map((d) => [
        d.plot_number,
        d.owner_name ?? "",
        d.overdueMonths.map(fmtMonth).join("; "),
        d.totalDue.toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dues_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (s: string) => {
    if (s === "confirmed") return <Badge className="bg-success/10 text-success border-0 text-[10px]">Confirmed</Badge>;
    if (s === "pending") return <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Pending</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]">Rejected</Badge>;
  };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="soft-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Collected</p>
          <p className="text-xl font-bold text-success">₹{totalCollected.toLocaleString("en-IN")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{confirmed.length} confirmed</p>
        </div>
        <div className="soft-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending review</p>
          <p className="text-xl font-bold text-warning">{pending.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Awaiting confirm</p>
        </div>
        <div className="soft-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Overdue plots</p>
          <p className="text-xl font-bold text-destructive">{dues.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Last 6 months</p>
        </div>
        <div className="soft-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Monthly rate</p>
          <p className="text-xl font-bold">₹{monthlyAmount.toLocaleString("en-IN")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Per plot</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["payments", "dues"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 h-9 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border/50 hover:text-foreground"
            }`}
          >
            {tab === "payments" ? "Payment Records" : `Pending Dues ${dues.length > 0 ? `(${dues.length})` : ""}`}
          </button>
        ))}
      </div>

      {activeTab === "payments" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Plot / payer / UTR" className="pl-8 h-9 rounded-xl text-sm" />
              {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="h-9 rounded-xl text-sm w-[140px]">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {MONTHS.map((m) => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 rounded-xl text-sm w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCSV} className="rounded-xl h-9 gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="soft-card p-10 text-center">
              <IndianRupee className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">No payment records match your filters.</p>
            </div>
          ) : (
            <div className="soft-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">Plot</th>
                      <th className="text-left px-4 py-3">Payer</th>
                      <th className="text-left px-4 py-3">Month</th>
                      <th className="text-right px-4 py-3">Amount</th>
                      <th className="text-left px-4 py-3">UTR / Ref</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{p.plot_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.payer_name ?? "—"}</td>
                        <td className="px-4 py-3">{fmtMonth(p.month)}</td>
                        <td className="px-4 py-3 text-right font-medium">₹{Number(p.amount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.utr_ref ?? "—"}</td>
                        <td className="px-4 py-3">{statusBadge(p.status)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          {p.status === "pending" && (
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                className="rounded-lg h-7 px-2.5 text-xs gap-1"
                                onClick={() => setActionTarget({ payment: p, action: "confirm" })}
                              >
                                <CheckCircle2 className="h-3 w-3" /> Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg h-7 px-2.5 text-xs gap-1 text-destructive"
                                onClick={() => setActionTarget({ payment: p, action: "reject" })}
                              >
                                <XCircle className="h-3 w-3" /> Reject
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "dues" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {monthlyAmount === 0
                ? "Set monthly amount in Settings to track dues."
                : `${dues.length} plot${dues.length !== 1 ? "s" : ""} with unpaid months in last 6 months`}
            </p>
            {dues.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportDuesCSV} className="rounded-xl h-9 gap-1.5 shrink-0">
                <Download className="h-3.5 w-3.5" /> Export dues
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : dues.length === 0 ? (
            <div className="soft-card p-10 text-center">
              <TrendingUp className="h-10 w-10 text-success mx-auto mb-3 opacity-60" />
              <p className="font-medium">All plots are up to date!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {monthlyAmount === 0 ? "Configure monthly amount in Settings first." : "No overdue plots in the last 6 months."}
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {dues.map((d) => {
                const isExpanded = expandedDue === d.plot_number;
                const isHighPriority = d.overdueMonths.length >= 2;
                return (
                  <div key={d.plot_number} className="soft-card overflow-hidden">
                    <button
                      className="w-full p-4 flex items-center gap-3 text-left"
                      onClick={() => setExpandedDue(isExpanded ? null : d.plot_number)}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isHighPriority ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                      }`}>
                        {isHighPriority ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Plot {d.plot_number}</p>
                          <Badge className={`text-[10px] border-0 ${isHighPriority ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                            {d.overdueMonths.length} month{d.overdueMonths.length !== 1 ? "s" : ""} overdue
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.owner_name ?? "Unknown owner"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-destructive">₹{d.totalDue.toLocaleString("en-IN")}</p>
                        <p className="text-xs text-muted-foreground">total due</p>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-border/30">
                        <p className="text-xs text-muted-foreground mb-2">Unpaid months:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {d.overdueMonths.map((m) => (
                            <span key={m} className="px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-xs font-medium">
                              {fmtMonth(m)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirm / Reject Dialog */}
      <Dialog open={!!actionTarget} onOpenChange={(o) => !o && setActionTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.action === "confirm" ? "Confirm payment" : "Reject payment"}
            </DialogTitle>
          </DialogHeader>
          {actionTarget && (
            <div className="space-y-4 py-1">
              <div className="neu-inset p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plot</span>
                  <span className="font-medium">{actionTarget.payment.plot_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Month</span>
                  <span className="font-medium">{fmtMonth(actionTarget.payment.month)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold">₹{Number(actionTarget.payment.amount).toLocaleString("en-IN")}</span>
                </div>
                {actionTarget.payment.utr_ref && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">UTR</span>
                    <span className="font-mono text-xs">{actionTarget.payment.utr_ref}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Add a note…"
                  className="rounded-xl"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionTarget(null)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={doAction}
              disabled={actionBusy}
              className={`rounded-xl ${actionTarget?.action === "reject" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
            >
              {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : actionTarget?.action === "confirm" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {actionTarget?.action === "confirm" ? "Confirm" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
