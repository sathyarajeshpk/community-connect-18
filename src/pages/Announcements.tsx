import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Megaphone, Pin } from "lucide-react";

type Announcement = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
};

export default function Announcements() {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("id, author_id, title, body, pinned, created_at")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Announcement[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  const togglePin = async (a: Announcement) => {
    const { error } = await supabase
      .from("announcements")
      .update({ pinned: !a.pinned })
      .eq("id", a.id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <AppShell>
      <section className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">Latest community updates.</p>
        </div>
        {isAdmin && (
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl gap-1.5 shrink-0">
                <Plus className="h-4 w-4" /> New
              </Button>
            </DialogTrigger>
            <AnnouncementForm
              mode="create"
              onClose={() => {
                setCreating(false);
                load();
              }}
            />
          </Dialog>
        )}
      </section>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="soft-card p-10 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Megaphone className="h-7 w-7" />
          </div>
          <p className="font-medium">No announcements yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Post the first update for the community." : "Check back soon."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="soft-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin className="h-3.5 w-3.5 text-primary fill-primary" />}
                    <p className="font-semibold">{a.title}</p>
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-1.5">{a.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => togglePin(a)}>
                    <Pin className="h-3.5 w-3.5" /> {a.pinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setEditing(a)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 ml-auto text-destructive hover:text-destructive"
                    onClick={() => remove(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <AnnouncementForm
            mode="edit"
            announcement={editing}
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

function AnnouncementForm({
  mode,
  announcement,
  onClose,
}: {
  mode: "create" | "edit";
  announcement?: Announcement;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    if (title.length > 200 || body.length > 4000) {
      toast.error("Too long");
      return;
    }
    setBusy(true);
    if (mode === "create") {
      const { error } = await supabase
        .from("announcements")
        .insert({ author_id: user!.id, title: title.trim(), body: body.trim() });
      if (error) toast.error(error.message);
      else toast.success("Posted");
    } else if (announcement) {
      const { error } = await supabase
        .from("announcements")
        .update({ title: title.trim(), body: body.trim() })
        .eq("id", announcement.id);
      if (error) toast.error(error.message);
      else toast.success("Updated");
    }
    setBusy(false);
    onClose();
  };

  return (
    <DialogContent className="rounded-2xl">
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "New announcement" : "Edit announcement"}</DialogTitle>
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
          placeholder="Body…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          rows={6}
          className="rounded-xl"
        />
        <Button type="submit" disabled={busy} className="w-full rounded-xl h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "create" ? "Post" : "Save"}
        </Button>
      </form>
    </DialogContent>
  );
}
