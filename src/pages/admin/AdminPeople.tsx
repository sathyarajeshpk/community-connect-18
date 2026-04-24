import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Search, Phone, MapPin, Pencil, Trash2, X, Check,
  UserPlus, Mail, Users
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Person = {
  id: string;
  source: "profile" | "dataset";
  name: string;
  email: string | null;
  phone: string | null;
  plot_number: string | null;
  status: string | null;
  profile_id: string | null;
  dataset_id: string | null;
};

type EditForm = {
  name: string;
  email: string;
  phone: string;
  plot_number: string;
};

export default function AdminPeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editTarget, setEditTarget] = useState<Person | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", email: "", phone: "", plot_number: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles, error: pe }, { data: dataset, error: de }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, email, phone, status, plot:plots(plot_number)")
        .in("status", ["approved", "resident_pending", "external_pending"])
        .order("name"),
      supabase
        .from("dataset_entries")
        .select("id, plot_number, owner_name, email, phone")
        .order("plot_number"),
    ]);
    if (pe) toast.error(pe.message);
    if (de) toast.error(de.message);

    const profileEmails = new Set(
      (profiles ?? []).map((p) => (p.email ?? "").toLowerCase()).filter(Boolean)
    );
    const profilePhones = new Set(
      (profiles ?? []).map((p) => p.phone ?? "").filter(Boolean)
    );

    const profilePeople: Person[] = (profiles ?? []).map((p) => ({
      id: `profile-${p.id}`,
      source: "profile",
      name: p.name,
      email: p.email,
      phone: p.phone,
      plot_number: (p as { plot?: { plot_number: string } | null }).plot?.plot_number ?? null,
      status: p.status,
      profile_id: p.id,
      dataset_id: null,
    }));

    // Dataset entries not already signed up
    const datasetPeople: Person[] = (dataset ?? [])
      .filter((d) => {
        const emailMatch = d.email && profileEmails.has(d.email.toLowerCase());
        const phoneMatch = d.phone && profilePhones.has(d.phone);
        return !emailMatch && !phoneMatch;
      })
      .map((d) => ({
        id: `dataset-${d.id}`,
        source: "dataset" as const,
        name: d.owner_name ?? "Unknown",
        email: d.email,
        phone: d.phone,
        plot_number: d.plot_number,
        status: null,
        profile_id: null,
        dataset_id: d.id,
      }));

    setPeople([...profilePeople, ...datasetPeople]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = people.filter((p) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      p.name.toLowerCase().includes(s) ||
      (p.plot_number ?? "").toLowerCase().includes(s) ||
      (p.phone ?? "").includes(s) ||
      (p.email ?? "").toLowerCase().includes(s)
    );
  });

  const openEdit = (p: Person) => {
    setEditTarget(p);
    setEditForm({
      name: p.name,
      email: p.email ?? "",
      phone: p.phone ?? "",
      plot_number: p.plot_number ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      if (editTarget.source === "profile" && editTarget.profile_id) {
        // Update profile name/phone/email
        const { error: profErr } = await supabase
          .from("profiles")
          .update({
            name: editForm.name.trim(),
            email: editForm.email.trim() || null,
            phone: editForm.phone.trim() || null,
          })
          .eq("id", editTarget.profile_id);
        if (profErr) throw profErr;

        // Update or create plot
        const plotNum = editForm.plot_number.trim();
        if (plotNum) {
          let plotId: string | null = null;
          const { data: existing } = await supabase
            .from("plots")
            .select("id")
            .eq("plot_number", plotNum)
            .maybeSingle();
          if (existing) {
            plotId = existing.id;
            await supabase.from("plots").update({ owner_name: editForm.name.trim() }).eq("id", existing.id);
          } else {
            const { data: newPlot } = await supabase
              .from("plots")
              .insert({ plot_number: plotNum, owner_name: editForm.name.trim() })
              .select("id")
              .single();
            plotId = newPlot?.id ?? null;
          }
          await supabase.from("profiles").update({ plot_id: plotId }).eq("id", editTarget.profile_id);
        } else {
          await supabase.from("profiles").update({ plot_id: null }).eq("id", editTarget.profile_id);
        }
        toast.success("Profile updated");
      } else if (editTarget.source === "dataset" && editTarget.dataset_id) {
        const { error } = await supabase
          .from("dataset_entries")
          .update({
            owner_name: editForm.name.trim(),
            email: editForm.email.trim() || null,
            phone: editForm.phone.trim() || null,
            plot_number: editForm.plot_number.trim(),
          })
          .eq("id", editTarget.dataset_id);
        if (error) throw error;
        toast.success("Entry updated");
      }
      setEditTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.source === "profile" && deleteTarget.profile_id) {
        const { error } = await supabase.rpc("admin_delete_user", { _user_id: deleteTarget.profile_id });
        if (error) throw error;
        toast.success("User removed");
      } else if (deleteTarget.source === "dataset" && deleteTarget.dataset_id) {
        const { error } = await supabase.from("dataset_entries").delete().eq("id", deleteTarget.dataset_id);
        if (error) throw error;
        toast.success("Entry removed");
      }
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const statusBadge = (status: string | null, source: "profile" | "dataset") => {
    if (source === "dataset") return (
      <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Not signed up</Badge>
    );
    if (status === "approved") return (
      <Badge className="bg-success/10 text-success border-0 text-[10px]">Approved</Badge>
    );
    if (status === "resident_pending") return (
      <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Pending</Badge>
    );
    if (status === "external_pending") return (
      <Badge className="bg-accent/10 text-accent-foreground border-0 text-[10px]">External</Badge>
    );
    return null;
  };

  const profileCount = people.filter((p) => p.source === "profile").length;
  const datasetCount = people.filter((p) => p.source === "dataset").length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="soft-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{profileCount}</p>
            <p className="text-xs text-muted-foreground">Registered</p>
          </div>
        </div>
        <div className="soft-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{datasetCount}</p>
            <p className="text-xs text-muted-foreground">Not signed up</p>
          </div>
        </div>
        <div className="soft-card p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{people.filter(p => p.status === "approved").length}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, plot, phone, email…"
          className="pl-9 rounded-xl h-11"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="soft-card p-10 text-center text-muted-foreground">No people found.</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => (
            <div key={p.id} className="soft-card p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-semibold shrink-0 ${
                p.source === "profile"
                  ? "gradient-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{p.name}</p>
                  {statusBadge(p.status, p.source)}
                </div>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {p.plot_number && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />Plot {p.plot_number}
                    </span>
                  )}
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      <Phone className="h-3 w-3" />{p.phone}
                    </a>
                  )}
                  {p.email && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <Mail className="h-3 w-3" />{p.email}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.phone && (
                  <Button asChild variant="ghost" size="icon" className="rounded-xl h-8 w-8 text-success">
                    <a href={`tel:${p.phone}`}><Phone className="h-4 w-4" /></a>
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 text-destructive" onClick={() => setDeleteTarget(p)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit person</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Plot number</Label>
              <Input value={editForm.plot_number} onChange={(e) => setEditForm((s) => ({ ...s, plot_number: e.target.value }))} placeholder="e.g. A-12" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" value={editForm.phone} onChange={(e) => setEditForm((s) => ({ ...s, phone: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((s) => ({ ...s, email: e.target.value }))} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.source === "profile"
                ? "This will remove their account from the community. Their payments history will be preserved."
                : "This will remove the dataset entry."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
