import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export default function AdminSettings() {
  const [limit, setLimit] = useState("7");
  const [vpa, setVpa] = useState("");
  const [payeeName, setPayeeName] = useState("Residence");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("settings").select("value").eq("key", "admin_limit").maybeSingle(),
      supabase.from("settings").select("value").eq("key", "upi").maybeSingle(),
    ]).then(([a, u]) => {
      if (a.data?.value) setLimit(String(a.data.value));
      const upi = u.data?.value as { vpa?: string; payee_name?: string } | null;
      if (upi) {
        setVpa(upi.vpa ?? "");
        setPayeeName(upi.payee_name ?? "Residence");
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      toast.error("Admin limit must be 1-50");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .update({ value: n, updated_at: new Date().toISOString() })
      .eq("key", "admin_limit");
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
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
        {
          key: "upi",
          value: { vpa: trimmed, payee_name: payeeName.trim() || "Residence" },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    setSavingUpi(false);
    if (error) toast.error(error.message);
    else toast.success("UPI details saved");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="soft-card p-5">
        <h2 className="font-semibold mb-1">Admin limit</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Maximum number of admins allowed at the same time.
        </p>
        <div className="flex gap-3 items-end max-w-sm">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="limit">Limit</Label>
            <Input
              id="limit"
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button onClick={save} disabled={saving} className="rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="soft-card p-5">
        <h2 className="font-semibold mb-1">UPI for maintenance payments</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Residents will pay directly to this UPI ID via their preferred app — no platform fees.
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
              placeholder="Residence"
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
    </div>
  );
}
