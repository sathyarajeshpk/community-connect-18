import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

type Plot = { id: string; plot_number: string; owner_name: string | null };

export default function AdminPlots() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ plot_number: "", owner_name: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("plots").select("*").order("plot_number");
    if (error) toast.error(error.message);
    setPlots((data ?? []) as Plot[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.plot_number.trim()) {
      toast.error("Plot number required");
      return;
    }
    const { error } = await supabase.from("plots").insert({
      plot_number: form.plot_number.trim(),
      owner_name: form.owner_name.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Plot added");
    setForm({ plot_number: "", owner_name: "" });
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this plot?")) return;
    const { error } = await supabase.from("plots").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{plots.length} plots</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl">
              <Plus className="h-4 w-4" /> Add plot
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>New plot</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="plot_number">Plot number</Label>
                <Input
                  id="plot_number"
                  value={form.plot_number}
                  onChange={(e) => setForm((s) => ({ ...s, plot_number: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner_name">Owner name</Label>
                <Input
                  id="owner_name"
                  value={form.owner_name}
                  onChange={(e) => setForm((s) => ({ ...s, owner_name: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create} className="rounded-xl">
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : plots.length === 0 ? (
        <div className="soft-card p-10 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="font-medium">No plots yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Plots are created automatically when you upload a dataset, or add manually.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {plots.map((p) => (
            <div key={p.id} className="soft-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {p.plot_number.slice(0, 3)}
              </div>
              <div className="flex-1">
                <p className="font-medium">Plot {p.plot_number}</p>
                <p className="text-sm text-muted-foreground">{p.owner_name ?? "Unassigned"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)} className="rounded-xl text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
