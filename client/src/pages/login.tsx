import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { signIn } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function Login() {
  const [,navigate]=useLocation(); const {toast}=useToast(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [loading,setLoading]=useState(false);
  async function handleLogin(e:React.FormEvent){e.preventDefault();if(!isSupabaseConfigured){toast({title:"Authentication is not configured",description:"Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment.",variant:"destructive"});return;}setLoading(true);try{const {error}=await signIn(email,password);if(error)throw error;navigate("/");}catch(error){toast({title:"Sign in failed",description:error instanceof Error?error.message:"Unable to sign in",variant:"destructive"});}finally{setLoading(false);}}
  return <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6"><div className="w-full max-w-sm rounded-xl border bg-background p-8 shadow-sm"><div className="mb-7 text-center"><div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Mail className="h-5 w-5"/></div><h1 className="text-2xl font-bold">Welcome back</h1><p className="mt-1 text-sm text-muted-foreground">Sign in to your MarketFlow account.</p></div><form onSubmit={handleLogin} className="space-y-4"><div className="space-y-2"><Label htmlFor="login-email">Email</Label><Input id="login-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div><div className="space-y-2"><Label htmlFor="login-password">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input id="login-password" type="password" className="pl-9" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></div></div><Button type="submit" className="w-full" disabled={loading}>{loading?"Signing in…":"Sign in"}<ArrowRight className="ml-1.5 h-4 w-4"/></Button></form><p className="mt-6 text-center text-sm text-muted-foreground">New to MarketFlow? <button type="button" className="font-medium text-primary hover:underline" onClick={()=>navigate("/register")}>Create an account</button></p></div></div>;
}
