import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, CheckCircle2, MessageSquare } from "lucide-react";

type Complaint = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "closed";
  created_at: string;
  closed_at: string | null;
};

type AuthorMap = Record<string, { name: string; plot: string | null }>;

export default function Complaints() {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<Complaint[]>([]);
  const [authors, setAuthors] = useState<AuthorMap>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "closed" | "mine">("all");
  const [editing, setEditing] = useState<Complaint | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("complaints")
      .select("id, author_id, title, description, status, created_at, closed_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Complaint[];
    setItems(list);

    if (isAdmin && list.length) {
      const ids = Array.from(new Set(list.map((c) => c.author_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name, plot:plots(plot_number)")
        .in("id", ids);
      const map: AuthorMap = {};
      (profs ?? []).forEach((p) => {
        map[p.id] = {
          name: p.name,
          plot: (p as { plot?: { plot_number: string } | null }).plot?.plot_number ?? null,
        };
      });
      setAuthors(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [isAdmin]);

  const visible = items.filter((c) => {
    if (filter === "open") return c.status !== "closed";
    if (filter === "closed") return c.status === "closed";
    if (filter === "mine") return c.author_id === user?.id;
    return true;
  });

  const closeComplaint = async (c: Complaint) => {
    const { error } = await supabase
      .from("complaints")
      .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: user?.id })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Complaint closed");
      load();
    }
  };

  return (
    <AppShell>
      <section className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Complaints</h1>
          <p className="text-sm text-muted-foreground mt-1">Raise issues; admins respond and close.</p>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> New
            </Button>
          </DialogTrigger>
          <ComplaintForm
            mode="create"
            onClose={() => {
              setCreating(false);
              load();
            }}
          />
        </Dialog>
      </section>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
          <TabsTrigger value="open" className="rounded-lg">Open</TabsTrigger>
          <TabsTrigger value="closed" className="rounded-lg">Closed</TabsTrigger>
          <TabsTrigger value="mine" className="rounded-lg">Mine</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="soft-card p-10 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-7 w-7" />
          </div>
          <p className="font-medium">No complaints yet</p>
          <p className="text-sm text-muted-foreground mt-1">Be the first to raise an issue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => {
            const mine = c.author_id === user?.id;
            const closed = c.status === "closed";
            const author = authors[c.author_id];
            return (
              <div key={c.id} className={`soft-card p-4 ${closed ? "opacity-75" : ""}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{c.title}</p>
                      <Badge
                        variant="secondary"
                        className={
                          closed
                            ? "bg-muted text-muted-foreground border-0"
                            : "bg-warning/10 text-warning border-0"
                        }
                      >
                        {closed ? "Closed" : "Open"}
                      </Badge>
                      {mine && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                          You
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1.5">{c.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(c.created_at).toLocaleString()}
                      {isAdmin && author && (
                        <> · by {author.name}{author.plot ? ` (Plot ${author.plot})` : ""}</>
                      )}
                      {closed && c.closed_at && <> · closed {new Date(c.closed_at).toLocaleDateString()}</>}
                    </p>
                  </div>
                </div>
                {(mine || isAdmin) && !closed && (
                  <div className="flex gap-2 mt-3">
                    {(mine || isAdmin) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1.5"
                        onClick={() => setEditing(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        className="rounded-xl gap-1.5 ml-auto"
                        onClick={() => closeComplaint(c)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Close
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <ComplaintForm
            mode="edit"
            complaint={editing}
            onClose={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </Dialog>
    </AppShell>
  );
}

function ComplaintForm({
  mode,
  complaint,
  onClose,
}: {
  mode: "create" | "edit";
  complaint?: Complaint;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(complaint?.title ?? "");
  const [description, setDescription] = useState(complaint?.description ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    if (title.length > 200 || description.length > 4000) {
      toast.error("Too long");
      return;
    }
    setBusy(true);
    if (mode === "create") {
      const { error } = await supabase
        .from("complaints")
        .insert({ author_id: user!.id, title: title.trim(), description: description.trim() });
      if (error) toast.error(error.message);
      else toast.success("Complaint raised");
    } else if (complaint) {
      const { error } = await supabase
        .from("complaints")
        .update({ title: title.trim(), description: description.trim() })
        .eq("id", complaint.id);
      if (error) toast.error(error.message);
      else toast.success("Updated");
    }
    setBusy(false);
    onClose();
  };

  return (
    <DialogContent className="rounded-2xl">
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "New complaint" : "Edit complaint"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="rounded-xl"
          autoFocus
        />
        <Textarea
          placeholder="Describe the issue…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
          rows={6}
          className="rounded-xl"
        />
        <Button type="submit" disabled={busy} className="w-full rounded-xl h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "create" ? "Raise complaint" : "Save changes"}
        </Button>
      </form>
    </DialogContent>
  );
}
