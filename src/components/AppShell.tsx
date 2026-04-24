import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { Building2, Home, Megaphone, MessageSquare, Users, LogOut, Shield, Moon, Sun, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { to: "/dashboard", label: "Home", icon: Home },
    { to: "/announcements", label: "News", icon: Megaphone },
    { to: "/complaints", label: "Issues", icon: MessageSquare },
    { to: "/directory", label: "People", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="mx-auto max-w-5xl px-5 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center shadow-soft">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight flex items-center gap-1.5">
              Ashirvaadh Castle Rock
              <Sparkles className="h-3.5 w-3.5 text-warning" />
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => navigate("/admin")}
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-6 pb-28 animate-fade-in">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-background/85 backdrop-blur-xl border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-5xl px-2 grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all ${
                    active ? "gradient-primary text-primary-foreground shadow-soft" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
