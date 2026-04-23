import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export default function AdminSettings() {
  const [limit, setLimit] = useState("7");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "admin_limit")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setLimit(String(data.value));
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
            />
          </div>
          <Button onClick={save} disabled={saving} className="rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="soft-card p-5">
        <h2 className="font-semibold mb-1">Monthly maintenance amounts</h2>
        <p className="text-sm text-muted-foreground">
          Coming in the payments phase — set per-month amounts and generate bills automatically.
        </p>
      </div>
    </div>
  );
}
