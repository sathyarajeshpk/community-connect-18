import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Shield, ShieldOff } from "lucide-react";

type Row = {
  id: string;
  name: string;
  email: string | null;
  is_admin: boolean;
};

export default function AdminAdmins() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(7);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: setting }] = await Promise.all([
      supabase.from("profiles").select("id, name, email").eq("status", "approved").order("name"),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      supabase.from("settings").select("value").eq("key", "admin_limit").maybeSingle(),
    ]);
    const adminIds = new Set((roles ?? []).map((r) => r.user_id));
    setRows(
      (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        is_admin: adminIds.has(p.id),
      })),
    );
    if (setting?.value) setLimit(Number(setting.value));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (userId: string, makeAdmin: boolean) => {
    setBusy(userId);
    const { error } = await supabase.rpc("set_admin_role", {
      _user_id: userId,
      _make_admin: makeAdmin,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(makeAdmin ? "Admin granted" : "Admin removed");
    load();
  };

  const adminCount = rows.filter((r) => r.is_admin).length;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="soft-card p-5 flex items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Shield className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">{adminCount} of {limit} admins</p>
          <p className="text-sm text-muted-foreground">
            Adjust the limit in Settings.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="soft-card p-10 text-center text-sm text-muted-foreground">
          No approved residents yet.
        </div>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <div key={r.id} className="soft-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-semibold">
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{r.name}</p>
                  {r.is_admin && <Badge className="bg-primary/10 text-primary border-0">Admin</Badge>}
                  {r.id === user?.id && <Badge variant="outline">You</Badge>}
                </div>
                <p className="text-sm text-muted-foreground truncate">{r.email}</p>
              </div>
              {r.is_admin ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => toggle(r.id, false)}
                  disabled={busy === r.id || r.id === user?.id}
                >
                  {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                  Revoke
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => toggle(r.id, true)}
                  disabled={busy === r.id || adminCount >= limit}
                >
                  {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Make admin
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
