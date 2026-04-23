import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, UserCheck } from "lucide-react";

type PendingProfile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: "resident_pending" | "external_pending" | "approved" | "rejected";
  created_at: string;
  plot_id: string | null;
};

export default function AdminApprovals() {
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, phone, status, created_at, plot_id")
      .in("status", ["resident_pending", "external_pending"])
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setProfiles((data ?? []) as PendingProfile[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handle = async (userId: string, approve: boolean) => {
    setBusyId(userId);
    const { error } = await supabase.rpc("approve_user", {
      _user_id: userId,
      _approve: approve,
      _notes: null,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approve ? "User approved" : "User rejected");
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="soft-card p-10 text-center">
        <div className="h-14 w-14 rounded-2xl bg-success/10 text-success flex items-center justify-center mx-auto mb-4">
          <UserCheck className="h-7 w-7" />
        </div>
        <p className="font-medium">All caught up</p>
        <p className="text-sm text-muted-foreground mt-1">No pending approvals right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {profiles.map((p) => (
        <div key={p.id} className="soft-card p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold">{p.name}</p>
                <Badge
                  variant="secondary"
                  className={
                    p.status === "resident_pending"
                      ? "bg-success/10 text-success border-0"
                      : "bg-warning/10 text-warning border-0"
                  }
                >
                  {p.status === "resident_pending" ? "Verified resident" : "External"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{p.email}</p>
              {p.phone && <p className="text-sm text-muted-foreground">{p.phone}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Requested {new Date(p.created_at).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              className="rounded-xl flex-1"
              onClick={() => handle(p.id, true)}
              disabled={busyId === p.id}
            >
              {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl flex-1"
              onClick={() => handle(p.id, false)}
              disabled={busyId === p.id}
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
