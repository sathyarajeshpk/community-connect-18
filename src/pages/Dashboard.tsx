import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { PushToggle } from "@/components/PushToggle";
import { Link } from "react-router-dom";
import { Receipt, Megaphone, MessageSquare, Sparkles, Users, Bell, Shield } from "lucide-react";

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const firstName = profile?.name?.split(" ")[0] ?? "Resident";

  const liveCards = [
    { to: "/announcements", icon: Megaphone, label: "Announcements", desc: "Latest community updates", color: "from-accent to-primary-glow" },
    { to: "/complaints", icon: MessageSquare, label: "Complaints", desc: "Raise & track issues", color: "from-primary to-accent" },
    { to: "/directory", icon: Users, label: "Resident directory", desc: "Find your neighbours", color: "from-primary to-primary-glow" },
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
              Browse announcements, raise complaints, and connect with your community.
            </p>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="soft-card p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold">Admin notifications</p>
                <Shield className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 mb-3">
                Get a phone notification when a new resident needs approval. Install this app to your Home Screen first for best results.
              </p>
              <PushToggle />
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-3">
        {liveCards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} to={c.to} className="soft-card p-4 flex items-center gap-4 hover:translate-y-[-1px] transition-transform">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-primary-foreground shadow-soft`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{c.label}</p>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
              </div>
            </Link>
          );
        })}
        <div className="soft-card p-4 flex items-center gap-4 opacity-70">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground shadow-soft">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Maintenance dues</p>
            <p className="text-sm text-muted-foreground">Pay monthly dues — coming next</p>
          </div>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Soon</span>
        </div>
      </section>
    </AppShell>
  );
}
