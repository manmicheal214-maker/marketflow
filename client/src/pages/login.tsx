import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, ArrowRight, Sparkles, BarChart3, Users, Workflow } from "lucide-react";

export default function Login() {
  const { toast } = useToast();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    toast({ title: "Welcome to MarketFlow", description: "Entering demo mode..." });
    // Redirect to dashboard
    window.location.hash = "#/";
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-sidebar p-12 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-6l-2 3h-4l-2-3H2" />
              <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
          </div>
          <span className="text-lg font-bold">MarketFlow</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-3xl font-bold leading-tight">
            Email Marketing Automation Made Simple
          </h1>
          <p className="text-slate-400 max-w-md">
            Build, automate, and analyze email campaigns with a complete CRM and marketing automation platform.
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary"><Users className="h-4 w-4" /></div>
              <span className="text-sm text-slate-300">Contact CRM</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary"><Workflow className="h-4 w-4" /></div>
              <span className="text-sm text-slate-300">Automation Builder</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary"><BarChart3 className="h-4 w-4" /></div>
              <span className="text-sm text-slate-300">Analytics Dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary"><Sparkles className="h-4 w-4" /></div>
              <span className="text-sm text-slate-300">AI Assistant</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">© 2025 MarketFlow. Portfolio demo project.</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
            </div>
            <span className="text-lg font-bold">MarketFlow</span>
          </div>

          <h2 className="text-xl font-bold mb-1">Welcome back</h2>
          <p className="text-sm text-muted-foreground mb-6">Sign in to your account or enter demo mode.</p>

          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <Badge variant="secondary" className="text-xs mb-1">Demo Mode</Badge>
            <p className="text-xs text-muted-foreground">Click "Enter Demo" to explore with pre-loaded data.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="login-email" type="email" defaultValue="demo@marketflow.io" className="pl-9" placeholder="you@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-pass">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="login-pass" type="password" defaultValue="demo" className="pl-9" placeholder="••••••••" />
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" data-testid="button-enter-demo">
              Enter Demo <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Don't have an account? <a href="#/" className="text-primary font-medium hover:underline">Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
