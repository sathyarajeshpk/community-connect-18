import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { loginSchema } from "@/lib/validation";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      toast.error("Could not load your account. Please try again.");
      return;
    }

    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("status").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const isAdmin = !!roles?.some((r) => r.role === "admin");
    const isApproved = prof?.status === "approved";

    if (isAdmin || isApproved) {
      toast.success("Welcome back");
      navigate("/dashboard");
      return;
    }

    toast.info("Your account is pending admin approval.");
    navigate("/pending");
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your community account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" disabled={submitting} className="w-full h-11 rounded-xl shadow-soft">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
