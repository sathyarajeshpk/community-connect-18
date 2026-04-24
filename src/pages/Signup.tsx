import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { signupSchema } from "@/lib/validation";
import { Loader2 } from "lucide-react";

export default function Signup() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    plotNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { name: parsed.data.name, phone: parsed.data.phone, plot_number: parsed.data.plotNumber },
      },
    });
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    // Bootstrap-first-admin: if no admin exists yet, promote this user.
    if (data.user) {
      try {
        await supabase.rpc("bootstrap_first_admin", { _user_id: data.user.id });
      } catch {
        /* ignore */
      }
    }

    setSubmitting(false);
    await supabase.auth.signOut();
    toast.success("Account created. Awaiting admin approval. Please sign in after approval.");
    navigate("/auth");
  };

  return (
    <AuthShell title="Join your community" subtitle="Sign up — your details will be verified by an admin">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={form.name} onChange={setField("name")} required />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={setField("email")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={setField("phone")} placeholder="+91 98765 43210" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plotNumber">Plot number</Label>
            <Input id="plotNumber" value={form.plotNumber} onChange={setField("plotNumber")} placeholder="e.g. A-102" required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={setField("password")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={setField("confirmPassword")} required />
        </div>
        <Button type="submit" disabled={submitting} className="w-full h-11 rounded-xl shadow-soft">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
