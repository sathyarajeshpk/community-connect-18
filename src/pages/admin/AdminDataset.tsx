import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Loader2, Database, Trash2, RefreshCw, Save, Link2 } from "lucide-react";

type Entry = {
  id: string;
  plot_number: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
};

export default function AdminDataset() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ at: string; count: number } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: rows, error }, { data: urlSetting }, { data: syncSetting }] = await Promise.all([
      supabase.from("dataset_entries").select("*").order("plot_number"),
      supabase.from("settings").select("value").eq("key", "google_sheet_url").maybeSingle(),
      supabase.from("settings").select("value").eq("key", "google_sheet_last_sync").maybeSingle(),
    ]);
    if (error) toast.error(error.message);
    setEntries((rows ?? []) as Entry[]);
    const url = urlSetting?.value
      ? typeof urlSetting.value === "string"
        ? urlSetting.value
        : (urlSetting.value as { url?: string })?.url ?? ""
      : "";
    setSheetUrl(url);
    setSavedUrl(url);
    setLastSync((syncSetting?.value as { at: string; count: number } | null) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveSheetUrl = async () => {
    setSavingUrl(true);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "google_sheet_url", value: sheetUrl as any }, { onConflict: "key" });
    if (error) toast.error(error.message);
    else { toast.success("Sheet URL saved"); setSavedUrl(sheetUrl); }
    setSavingUrl(false);
  };

  const syncNow = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-dataset-sheet");
    if (error) { toast.error(error.message); }
    else if ((data as any)?.error) { toast.error((data as any).error); }
    else { toast.success(`Synced ${(data as any).count} rows`); load(); }
    setSyncing(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      const normalized = rows
        .map((r) => {
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          const get = (...keys: string[]) => {
            for (const k of keys) {
              const nk = norm(k);
              const found = Object.keys(r).find((rk) => norm(rk) === nk);
              if (found && r[found] !== null && r[found] !== undefined && String(r[found]).trim() !== "") {
                let v = String(r[found]).trim();
                if (/^\d+\.0+$/.test(v)) v = v.replace(/\.0+$/, "");
                return v;
              }
            }
            return null;
          };
          const plot = get("plotnumber", "plotno", "plot", "flat", "flatnumber");
          if (!plot) return null;
          return {
            plot_number: plot,
            owner_name: get("ownername", "residentname", "owner", "resident", "name"),
            email: get("email", "emailoptional", "emailid", "mail"),
            phone: get("phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber"),
          };
        })
        .filter(Boolean) as Array<{ plot_number: string; owner_name: string | null; email: string | null; phone: string | null }>;

      if (normalized.length === 0) {
        toast.error("No valid rows found. Expected columns: PlotNumber, OwnerName, Email, Phone");
        setUploading(false);
        return;
      }

      // Upsert on plot_number — prevents duplicates on re-upload
      const { error } = await supabase
        .from("dataset_entries")
        .upsert(normalized, { onConflict: "plot_number" });

      if (error) { toast.error(error.message); }
      else { toast.success(`Imported / updated ${normalized.length} rows — no duplicates created`); load(); }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearAll = async () => {
    if (!confirm("Delete ALL dataset entries? This cannot be undone.")) return;
    const { error } = await supabase
      .from("dataset_entries")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) toast.error(error.message);
    else { toast.success("Dataset cleared"); load(); }
  };

  return (
    <div className="space-y-5">
      <div className="soft-card p-5">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Link2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Sync from Google Sheets</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Paste a public Google Sheet URL. Re-syncing updates existing plots without creating duplicates.
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="rounded-xl"
                />
                <Button onClick={saveSheetUrl} disabled={savingUrl || sheetUrl === savedUrl} variant="outline" className="rounded-xl shrink-0">
                  {savingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button onClick={syncNow} disabled={syncing || !savedUrl} className="rounded-xl">
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sync now
                </Button>
                {lastSync && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {new Date(lastSync.at).toLocaleString()} · {lastSync.count} rows
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="soft-card p-5">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Database className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Manual upload (Excel / CSV)</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Columns: <span className="font-mono text-xs">PlotNumber, OwnerName, Email, Phone</span>.
              Safe to re-upload — existing entries are updated, no duplicates.
            </p>
            <div className="flex gap-2 mt-4 flex-wrap">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" className="rounded-xl">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload file
              </Button>
              {entries.length > 0 && (
                <Button variant="outline" onClick={clearAll} className="rounded-xl text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Clear all
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="soft-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
          <p className="font-medium">Dataset</p>
          <span className="text-sm text-muted-foreground">{entries.length} plots</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : entries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Plot</th>
                  <th className="text-left px-4 py-2">Owner</th>
                  <th className="text-left px-4 py-2">Email</th>
                  <th className="text-left px-4 py-2">Phone</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 200).map((e) => (
                  <tr key={e.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{e.plot_number}</td>
                    <td className="px-4 py-2">{e.owner_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{e.email}</td>
                    <td className="px-4 py-2 text-muted-foreground">{e.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length > 200 && (
              <p className="text-center text-xs text-muted-foreground py-3">
                Showing first 200 of {entries.length}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
