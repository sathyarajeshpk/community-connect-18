import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ChevronLeft, Copy, QrCode, Smartphone, UploadCloud, ExternalLink, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultAmount?: number;
  payerName?: string;
  plotNumber?: string;
}

interface UpiSettings {
  vpa: string;
  payee_name: string;
  receiver_phone?: string;
  qr_image_url?: string;
}

const APPS: { key: string; label: string; scheme: string; color: string }[] = [
  { key: "gpay",    label: "Google Pay", scheme: "tez",      color: "from-[hsl(140_60%_55%)] to-[hsl(200_70%_60%)]" },
  { key: "phonepe", label: "PhonePe",    scheme: "phonepe",  color: "from-[hsl(265_60%_55%)] to-[hsl(280_70%_65%)]" },
  { key: "paytm",   label: "Paytm",      scheme: "paytmmp",  color: "from-[hsl(210_70%_55%)] to-[hsl(195_75%_60%)]" },
  { key: "bhim",    label: "BHIM / UPI", scheme: "upi",      color: "from-[hsl(20_75%_60%)] to-[hsl(40_80%_60%)]" },
];

function getDefaultMonth() {
  return new Date().toISOString().slice(0, 7);
}

const TX_REF_QUERY_KEYS = ["utr", "txnRef", "txnId", "txnid", "ApprovalRefNo", "approvalRefNo"] as const;

function readTxnRefFromLocation() {
  if (typeof window === "undefined") return "";

  const fromSearch = new URLSearchParams(window.location.search);
  for (const key of TX_REF_QUERY_KEYS) {
    const value = fromSearch.get(key);
    if (value?.trim()) return value.trim();
  }

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const fromHash = new URLSearchParams(hash);
  for (const key of TX_REF_QUERY_KEYS) {
    const value = fromHash.get(key);
    if (value?.trim()) return value.trim();
  }

  return "";
}

export function UpiPayDialog({ open, onOpenChange, defaultAmount = 0, payerName, plotNumber }: Props) {
  const { user, profile } = useAuth();
  const [settings, setSettings] = useState<UpiSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [amount, setAmount] = useState<string>(defaultAmount ? String(defaultAmount) : "");
  const [note, setNote] = useState<string>(payerName ? `Maintenance — ${payerName}` : "Maintenance");
  const [step, setStep] = useState<"pay" | "record">("pay");
  const [utrRef, setUtrRef] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Build last-6-months list for month selector
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  function fmtMonth(m: string) {
    const [y, mo] = m.split("-");
    return new Date(Number(y), Number(mo) - 1).toLocaleString("default", { month: "long", year: "numeric" });
  }

  useEffect(() => {
    if (!open) { setStep("pay"); setUtrRef(""); setDone(false); setProofFile(null); return; }
    setLoadingSettings(true);
    // Also load monthly amount from settings
    Promise.all([
      supabase.from("settings").select("value").eq("key", "upi").maybeSingle(),
      supabase.from("settings").select("value").eq("key", "monthly_amount").maybeSingle(),
    ]).then(([upiRes, amtRes]) => {
      const v = (upiRes.data?.value ?? null) as unknown as UpiSettings | null;
      setSettings(v && v.vpa ? v : null);
      const amt = Number(amtRes.data?.value ?? 0);
      if (amt > 0 && !defaultAmount) setAmount(String(amt));
      setLoadingSettings(false);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const hydratedTxnRef = readTxnRefFromLocation();
    if (hydratedTxnRef) {
      setUtrRef((prev) => prev || hydratedTxnRef);
      setStep("record");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const normalizedPlot = (plotNumber ?? profile?.plot_id ?? "NA").replace(/\s+/g, "").slice(0, 10).toUpperCase();
    const now = Date.now().toString(36).toUpperCase();
    setPaymentRef(`CC-${normalizedPlot}-${now}`);
  }, [open, plotNumber, profile?.plot_id]);

  const buildUri = (scheme: string) => {
    if (!settings?.vpa) return "";
    const params = new URLSearchParams({
      pa: settings.vpa,
      pn: settings.payee_name || "Ashirvaadh Castle Rock",
      cu: "INR",
    });
    if (amount && Number(amount) > 0) params.set("am", String(Number(amount).toFixed(2)));
    if (note) params.set("tn", note.slice(0, 80));
    if (paymentRef) params.set("tr", paymentRef);
    return `${scheme}://pay?${params.toString()}`;
  };

  const pay = (scheme: string) => {
    const uri = buildUri(scheme);
    if (!uri) { toast.error("UPI is not configured yet. Ask an admin to set it up."); return; }
    window.location.href = uri;
    // After redirect back, show record step
    setTimeout(() => setStep("record"), 1500);
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  const recordPayment = async () => {
    if (!user) return;
    const resolvedPlot = plotNumber ?? profile?.plot_id ?? null;
    if (!resolvedPlot) {
      toast.error("Plot number not found. Contact admin.");
      return;
    }
    if (!amount || Number(amount) <= 0) { toast.error("Enter the amount paid"); return; }
    if (!utrRef.trim()) {
      toast.error("UTR / transaction reference is mandatory.");
      return;
    }
    setRecording(true);
    let proofUrl: string | null = null;
    if (proofFile) {
      const ext = proofFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, proofFile, {
        contentType: proofFile.type || "image/jpeg",
      });
      if (uploadError) {
        setRecording(false);
        toast.error(uploadError.message);
        return;
      }
      const { data: publicData } = supabase.storage.from("payment-proofs").getPublicUrl(path);
      proofUrl = publicData.publicUrl;
    }
    const { error } = await supabase.from("maintenance_payments").insert({
      plot_number: resolvedPlot,
      paid_by: user.id,
      payer_name: payerName ?? profile?.name ?? null,
      amount: Number(amount),
      month: selectedMonth,
      utr_ref: utrRef.trim(),
      proof_url: proofUrl,
      status: "pending",
    });
    setRecording(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
    toast.success("Payment recorded! Admin will confirm it shortly.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>
            {step === "pay" ? "Pay maintenance via UPI" : "Record your payment"}
          </DialogTitle>
          <DialogDescription>
            {step === "pay"
              ? "Choose your UPI app — amount and payee details will be prefilled."
              : "Enter your UTR / transaction reference so the admin can verify."}
          </DialogDescription>
        </DialogHeader>

        {loadingSettings ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : done ? (
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <p className="font-semibold text-lg">Payment recorded!</p>
              <p className="text-sm text-muted-foreground mt-1">The admin will confirm your payment shortly. You can track it in your payment history.</p>
            </div>
            <Button className="rounded-xl w-full mt-2" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : step === "pay" ? (
          <div className="space-y-4">
            {!settings ? (
              <div className="neu-inset p-4 text-sm text-muted-foreground">
                UPI hasn't been set up yet. An admin can add the society's UPI ID under Admin → Settings.
              </div>
            ) : (
              <>
                <div className="neu-inset p-3 text-sm">
                  <p className="text-muted-foreground text-xs mb-1">Paying to</p>
                  <p className="font-medium">{settings.payee_name || "Ashirvaadh Castle Rock"}</p>
                  <p className="text-xs text-muted-foreground">{settings.vpa}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {settings.receiver_phone ? (
                    <div className="soft-card p-3 border border-border/60">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Pay via phone number</p>
                      <p className="font-medium">{settings.receiver_phone}</p>
                      <Button variant="secondary" size="sm" className="mt-2 rounded-lg gap-1.5" onClick={() => settings.receiver_phone && copyToClipboard(settings.receiver_phone, "Phone number")}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                    </div>
                  ) : null}
                  {settings.qr_image_url ? (
                    <div className="soft-card p-3 border border-border/60">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><QrCode className="h-3.5 w-3.5" /> Pay via QR code</p>
                      <img src={settings.qr_image_url} alt="Society UPI QR code" className="rounded-lg h-28 w-28 object-cover border border-border" />
                      <a href={settings.qr_image_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-2">
                        Open full QR <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="amt">Amount (₹)</Label>
                    <Input id="amt" inputMode="decimal" placeholder="e.g. 1500" value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="note">Note</Label>
                    <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {APPS.map((app) => (
                    <button key={app.key} onClick={() => pay(app.scheme)}
                      className="soft-card p-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
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
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 mt-0.5 text-warning" />
                  If your app blocks gallery QR payments, use <span className="font-medium">mobile number</span> or scan the QR directly from another screen/device.
                </p>

                <button
                  onClick={() => setStep("record")}
                  className="text-sm text-primary underline w-full text-center mt-1"
                >
                  Already paid? Record your payment →
                </button>
              </>
            )}
            <p className="text-[11px] text-muted-foreground">Money goes directly to the society — no platform fee.</p>
            <Button variant="ghost" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Month paid for</Label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{fmtMonth(m)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rec-amt">Amount paid (₹)</Label>
                <Input id="rec-amt" inputMode="decimal" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="rounded-xl" placeholder="e.g. 1500" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="utr">UTR / Ref no.</Label>
                <Input id="utr" value={utrRef} onChange={(e) => setUtrRef(e.target.value)}
                  className="rounded-xl" placeholder="Transaction ID" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proof" className="flex items-center gap-1.5">
                <UploadCloud className="h-4 w-4" /> Payment screenshot (optional)
              </Label>
              <Input
                id="proof"
                type="file"
                accept="image/*"
                className="rounded-xl"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {paymentRef ? (
              <p className="text-xs text-muted-foreground">
                Tracking ref used in payment link: <span className="font-medium text-foreground">{paymentRef}</span>
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">UTR is mandatory. It will be auto-filled if your UPI app returns it; otherwise paste it manually from your transaction history.</p>
            <p className="text-xs text-muted-foreground">If your UPI app sends a callback with transaction details, we auto-fill this field.</p>
            <Button onClick={recordPayment} disabled={recording} className="w-full rounded-xl h-11">
              {recording ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Submit for confirmation
            </Button>
            <Button variant="ghost" size="sm" className="w-full rounded-xl gap-1.5" onClick={() => setStep("pay")}>
              <ChevronLeft className="h-4 w-4" /> Back to payment
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
