import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, RefreshCw, ShieldX } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function Pending() {
  const { user, profile, isAdmin, loading, refresh, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-soft">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (profile?.status === "approved" || isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const isRejected = profile?.status === "rejected";
  const isResidentPending = profile?.status === "resident_pending";

  return (
    <AuthShell
      title={isRejected ? "Access denied" : "Waiting for approval"}
      subtitle={
        isRejected
          ? "Your registration was rejected by an administrator."
          : isResidentPending
          ? "Your details matched the resident dataset. An admin will approve you shortly."
          : "We couldn't match your details against the resident dataset. An admin will review your request."
      }
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div
          className={`h-16 w-16 rounded-2xl flex items-center justify-center ${
            isRejected ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          }`}
        >
          {isRejected ? <ShieldX className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
        </div>
        <div className="text-sm text-muted-foreground">
          Status:{" "}
          <span className="font-semibold text-foreground">
            {profile?.status?.replace("_", " ") ?? "unknown"}
          </span>
        </div>
        <div className="flex gap-2 w-full pt-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
