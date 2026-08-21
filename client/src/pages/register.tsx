import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, ArrowRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(v => ({ ...v, [key]: e.target.value }));

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) return toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
    if (form.password !== form.confirmPassword) return toast({ title: "Passwords do not match", description: "Enter the same password twice.", variant: "destructive" });
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ fullName: form.fullName, email: form.email, password: form.password }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Unable to create account");
      toast({ title: "Account created", description: "Welcome to MarketFlow." });
      navigate("/");
    } catch (error) {
      toast({ title: "Registration failed", description: error instanceof Error ? error.message : "Unable to create account", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return <div className="flex min-h-screen items-center justify-center p-6 bg-muted/30">
    <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><CheckCircle2 className="h-5 w-5" /></div>
        <h1 className="text-2xl font-bold">Create your MarketFlow account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start building campaigns and automations.</p>
      </div>
      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="full-name">Full name</Label><div className="relative"><User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="full-name" className="pl-9" value={form.fullName} onChange={update("fullName")} required maxLength={120} placeholder="Jane Doe" /></div></div>
        <div className="space-y-2"><Label htmlFor="register-email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="register-email" type="email" className="pl-9" value={form.email} onChange={update("email")} required placeholder="you@example.com" /></div></div>
        <div className="space-y-2"><Label htmlFor="register-password">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="register-password" type="password" className="pl-9" value={form.password} onChange={update("password")} required minLength={8} placeholder="At least 8 characters" /></div></div>
        <div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" value={form.confirmPassword} onChange={update("confirmPassword")} required minLength={8} placeholder="Repeat your password" /></div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? "Creating account…" : "Create account"}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <button type="button" className="font-medium text-primary hover:underline" onClick={() => navigate("/login")}>Sign in</button></p>
    </div>
  </div>;
}
