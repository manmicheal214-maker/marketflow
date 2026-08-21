import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Lock, ArrowRight, UserPlus } from "lucide-react";

export default function Login() {
  const { toast } = useToast();
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState("demo@marketflow.io");
  const [password, setPassword] = useState("demo");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", registering ? "/api/auth/register" : "/api/auth/login", registering ? { email, password, fullName, username } : { email, password });
      return res.json();
    },
    onSuccess: () => { toast({ title: registering ? "Account created" : "Welcome back" }); window.location.hash = "#/"; },
    onError: (error: Error) => toast({ title: "Authentication failed", description: error.message, variant: "destructive" }),
  });

  function submit(e: React.FormEvent) { e.preventDefault(); mutation.mutate(); }

  return <div className="flex min-h-screen">
    <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-sidebar p-12 text-white">
      <div className="text-lg font-bold">MarketFlow</div>
      <div className="space-y-5"><h1 className="text-3xl font-bold">Email Marketing Automation Made Simple</h1><p className="text-slate-400 max-w-md">Build, automate, and analyze email campaigns with a complete CRM and marketing automation platform.</p></div>
      <p className="text-xs text-slate-500">© 2026 MarketFlow</p>
    </div>
    <div className="flex w-full lg:w-1/2 items-center justify-center p-8"><div className="w-full max-w-sm">
      <h2 className="text-xl font-bold mb-1">{registering ? "Create your account" : "Welcome back"}</h2>
      <p className="text-sm text-muted-foreground mb-6">{registering ? "Start using MarketFlow with your own account." : "Sign in with your MarketFlow account."}</p>
      <form onSubmit={submit} className="space-y-4">
        {registering && <><div className="space-y-2"><Label htmlFor="full-name">Full name</Label><Input id="full-name" value={fullName} onChange={e=>setFullName(e.target.value)} required /></div><div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="optional" /></div></>}
        <div className="space-y-2"><Label htmlFor="login-email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input id="login-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} className="pl-9" required /></div></div>
        <div className="space-y-2"><Label htmlFor="login-pass">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input id="login-pass" type="password" value={password} onChange={e=>setPassword(e.target.value)} className="pl-9" minLength={8} required /></div></div>
        <Button type="submit" className="w-full" size="lg" disabled={mutation.isPending}>{mutation.isPending ? "Please wait..." : registering ? <><UserPlus className="mr-1.5 h-4 w-4"/>Create account</> : <>Sign in <ArrowRight className="ml-1.5 h-4 w-4"/></>}</Button>
      </form>
      <button className="mt-6 w-full text-xs text-primary hover:underline" onClick={()=>setRegistering(!registering)}>{registering ? "Already have an account? Sign in" : "Don't have an account? Create one"}</button>
      {!registering && <p className="text-xs text-muted-foreground mt-4 text-center">Demo account: demo@marketflow.io / demo</p>}
    </div></div>
  </div>;
}
