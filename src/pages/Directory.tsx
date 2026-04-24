import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Phone, MapPin, X } from "lucide-react";

type Resident = {
  id: string;
  name: string;
  phone: string | null;
  plot_number: string | null;
};

export default function Directory() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, phone, plot:plots(plot_number)")
        .eq("status", "approved")
        .order("name");

      if (!error) {
        setResidents(
          (data ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            phone: p.phone,
            plot_number: (p as { plot?: { plot_number: string } | null }).plot?.plot_number ?? null,
          })),
        );
      }
      setLoading(false);
    })();
  }, []);

  const filtered = residents.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      r.name.toLowerCase().includes(s) ||
      (r.plot_number ?? "").toLowerCase().includes(s) ||
      (r.phone ?? "").includes(s)
    );
  });

  return (
    <AppShell>
      <section className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Residents</h1>
        <p className="text-sm text-muted-foreground mt-1">All approved residents in the community.</p>
      </section>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, plot, phone"
          className="pl-9 pr-9 rounded-xl h-11"
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
        <div className="soft-card p-8 text-center text-muted-foreground">No residents found.</div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id} className="soft-card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {r.plot_number && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />Plot {r.plot_number}
                      </span>
                    )}
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        <Phone className="h-3 w-3" />{r.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {r.phone && (
                <a
                  href={`tel:${r.phone}`}
                  className="h-9 w-9 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0 hover:bg-success/20 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
