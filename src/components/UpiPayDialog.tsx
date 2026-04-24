import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultAmount?: number;
  payerName?: string;
}

interface UpiSettings {
  vpa: string;
  payee_name: string;
}

const APPS: { key: string; label: string; scheme: string; color: string }[] = [
  { key: "gpay", label: "Google Pay", scheme: "tez", color: "from-[hsl(140_60%_55%)] to-[hsl(200_70%_60%)]" },
  { key: "phonepe", label: "PhonePe", scheme: "phonepe", color: "from-[hsl(265_60%_55%)] to-[hsl(280_70%_65%)]" },
  { key: "paytm", label: "Paytm", scheme: "paytmmp", color: "from-[hsl(210_70%_55%)] to-[hsl(195_75%_60%)]" },
  { key: "bhim", label: "BHIM / Any UPI app", scheme: "upi", color: "from-[hsl(20_75%_60%)] to-[hsl(40_80%_60%)]" },
];

export function UpiPayDialog({ open, onOpenChange, defaultAmount = 0, payerName }: Props) {
  const [settings, setSettings] = useState<UpiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState<string>(defaultAmount ? String(defaultAmount) : "");
  const [note, setNote] = useState<string>(payerName ? `Maintenance — ${payerName}` : "Maintenance");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("settings")
      .select("value")
      .eq("key", "upi")
      .maybeSingle()
      .then(({ data }) => {
        const v = (data?.value ?? null) as unknown as UpiSettings | null;
        setSettings(v && v.vpa ? v : null);
        setLoading(false);
      });
  }, [open]);

  const buildUri = (scheme: string) => {
    if (!settings?.vpa) return "";
    const params = new URLSearchParams({
      pa: settings.vpa,
      pn: settings.payee_name || "Residence",
      cu: "INR",
    });
    if (amount && Number(amount) > 0) params.set("am", String(Number(amount).toFixed(2)));
    if (note) params.set("tn", note.slice(0, 80));
    return `${scheme}://pay?${params.toString()}`;
  };

  const pay = (scheme: string) => {
    const uri = buildUri(scheme);
    if (!uri) {
      toast.error("UPI is not configured yet. Ask an admin to set it.");
      return;
    }
    window.location.href = uri;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Pay maintenance via UPI</DialogTitle>
          <DialogDescription>
            Choose your UPI app — the amount and payee details will be filled in for you. No platform fees.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !settings ? (
          <div className="neu-inset p-4 text-sm text-muted-foreground">
            UPI hasn't been set up yet. An admin can add the society's UPI ID under Admin → Settings.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="neu-inset p-3 text-sm">
              <p className="text-muted-foreground">Paying to</p>
              <p className="font-medium">{settings.payee_name || "Residence"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{settings.vpa}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amt">Amount (₹)</Label>
                <Input
                  id="amt"
                  inputMode="decimal"
                  placeholder="e.g. 1500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note">Note</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {APPS.map((app) => (
                <button
                  key={app.key}
                  onClick={() => pay(app.scheme)}
                  className="soft-card p-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                >
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center text-primary-foreground font-bold shadow-soft`}>
                    {app.label.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{app.label}</p>
                    <p className="text-[11px] text-muted-foreground">Open app</p>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground">
              The link opens your UPI app to complete the payment. Money goes directly to the society — Residence doesn't take any cut.
            </p>

            <Button variant="ghost" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
