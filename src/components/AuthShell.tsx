import { Building2 } from "lucide-react";
import { ReactNode } from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col">
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-4">
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1.5 text-center">{subtitle}</p>}
          </div>
          <div className="soft-card p-6">{children}</div>
        </div>
      </main>
      <footer className="text-center text-xs text-muted-foreground pb-6">
        Ashirvaadh Castle Rock · Community Management
      </footer>
    </div>
  );
}
