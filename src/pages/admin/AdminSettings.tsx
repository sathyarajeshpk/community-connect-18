import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, IndianRupee } from "lucide-react";

export default function AdminSettings() {
  const [limit, setLimit] = useState("7");
  const [vpa, setVpa] = useState("");
  const [payeeName, setPayeeName] = useState("Ashirvaadh Castle Rock");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);
  const [savingAmount, setSavingAmount] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("settings").select("value").eq("key", "admin_limit").maybeSingle(),
      supabase.from("settings").select("value").eq("key", "upi").maybeSingle(),
      supabase.from("settings").select("value").eq("key", "monthly_amount").maybeSingle(),
    ]).then(([a, u, m]) => {
      if (a.data?.value) setLimit(String(a.data.value));
      const upi = u.data?.value as { vpa?: string; payee_name?: string } | null;
      if (upi) { setVpa(upi.vpa ?? ""); setPayeeName(upi.payee_name ?? "Ashirvaadh Castle Rock"); }
      if (m.data?.value !== undefined && m.data.value !== null) setMonthlyAmount(String(m.data.value));
      setLoading(false);
    });
  }, []);

  const save = async () => {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 50) { toast.error("Admin limit must be 1–50"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .update({ value: n, updated_at: new Date().toISOString() })
      .eq("key", "admin_limit");
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const saveUpi = async () => {
    const trimmed = vpa.trim();
    if (trimmed && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(trimmed)) {
      toast.error("Enter a valid UPI ID (e.g. name@okhdfcbank)");
      return;
    }
    setSavingUpi(true);
    const { error } = await supabase
      .from("settings")
      .upsert(
        { key: "upi", value: { vpa: trimmed, payee_name: payeeName.trim() || "Ashirvaadh Castle Rock" }, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    setSavingUpi(false);
    if (error) toast.error(error.message); else toast.success("UPI details saved");
  };

  const saveAmount = async () => {
    const n = Number(monthlyAmount);
    if (isNaN(n) || n < 0) { toast.error("Enter a valid amount"); return; }
    setSavingAmount(true);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "monthly_amount", value: n, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSavingAmount(false);
    if (error) toast.error(error.message); else toast.success("Monthly amount saved");
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Monthly maintenance amount */}
      <div className="soft-card p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Monthly maintenance amount</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Set the amount each plot must pay per month. Used to calculate pending dues.
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-end max-w-sm">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="monthly_amount">Amount (₹)</Label>
            <Input
              id="monthly_amount"
              type="number"
              min={0}
              placeholder="e.g. 1500"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button onClick={saveAmount} disabled={savingAmount} className="rounded-xl">
            {savingAmount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {/* UPI settings */}
      <div className="soft-card p-5">
        <h2 className="font-semibold mb-1">UPI for maintenance payments</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Residents pay directly to this UPI ID. No platform fees. You can update this anytime.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div className="space-y-1.5">
            <Label htmlFor="vpa">UPI ID (VPA)</Label>
            <Input
              id="vpa"
              placeholder="society@okhdfcbank"
              value={vpa}
              onChange={(e) => setVpa(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payee">Payee name</Label>
            <Input
              id="payee"
              placeholder="Ashirvaadh Castle Rock"
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
        <Button onClick={saveUpi} disabled={savingUpi} className="rounded-xl">
          {savingUpi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save UPI details
        </Button>
      </div>

      {/* Admin limit */}
      <div className="soft-card p-5">
        <h2 className="font-semibold mb-1">Admin limit</h2>
        <p className="text-sm text-muted-foreground mb-4">Maximum number of admins allowed at the same time.</p>
        <div className="flex gap-3 items-end max-w-sm">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="limit">Limit</Label>
            <Input id="limit" type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(e.target.value)} className="rounded-xl" />
          </div>
          <Button onClick={save} disabled={saving} className="rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
