import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Receipt, Megaphone, MessageSquare, Sparkles } from "lucide-react";

export default function Dashboard() {
  const { profile } = useAuth();
  const firstName = profile?.name?.split(" ")[0] ?? "Resident";

  const cards = [
    { icon: Receipt, label: "Maintenance dues", desc: "View and pay your bills", color: "from-primary to-primary-glow" },
    { icon: Megaphone, label: "Announcements", desc: "Latest community updates", color: "from-accent to-primary-glow" },
    { icon: MessageSquare, label: "Complaints", desc: "Raise & track issues", color: "from-primary to-accent" },
  ];

  return (
    <AppShell>
      <section className="mb-8">
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-3xl font-semibold tracking-tight mt-0.5">Hello, {firstName}</h1>
      </section>

      <section className="soft-card p-5 mb-6 bg-gradient-primary text-primary-foreground">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-foreground/15 flex items-center justify-center backdrop-blur">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">You're all set</p>
            <p className="text-sm opacity-90 mt-0.5">
              Bills, announcements, and complaints arrive in upcoming releases.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="soft-card p-4 flex items-center gap-4 opacity-80">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-primary-foreground shadow-soft`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{c.label}</p>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
              </div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Soon</span>
            </div>
          );
        })}
      </section>
    </AppShell>
  );
}
