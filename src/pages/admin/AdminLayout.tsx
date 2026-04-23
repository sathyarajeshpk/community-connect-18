import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Users, Database, Shield, Building2, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { to: "/admin", label: "Approvals", icon: Users, end: true },
  { to: "/admin/dataset", label: "Dataset", icon: Database },
  { to: "/admin/plots", label: "Plots", icon: Building2 },
  { to: "/admin/admins", label: "Admins", icon: Shield },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminLayout() {
  const location = useLocation();
  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-sm text-muted-foreground">Administration</p>
        <h1 className="text-3xl font-semibold tracking-tight mt-0.5">Admin Console</h1>
      </div>

      <div className="-mx-2 mb-6 overflow-x-auto">
        <div className="flex gap-2 px-2 min-w-max">
          {tabs.map((t) => {
            const active = t.end ? location.pathname === t.to : location.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-1.5 px-4 h-10 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "bg-card text-muted-foreground border border-border/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      <Outlet />
    </AppShell>
  );
}
