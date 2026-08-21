import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayout } from "@/components/layout";
import { apiFetch } from "@/lib/api";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Segments from "@/pages/segments";
import Campaigns from "@/pages/campaigns";
import Templates from "@/pages/templates";
import Automations from "@/pages/automations";
import Analytics from "@/pages/analytics";
import AbTesting from "@/pages/ab-testing";
import LeadScoring from "@/pages/lead-scoring";
import AiAssistant from "@/pages/ai-assistant";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";

function Protected({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  useEffect(() => { apiFetch("/api/auth/me").then(r => setState(r.ok ? "authenticated" : "unauthenticated")).catch(() => setState("unauthenticated")); }, []);
  if (state === "loading") return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking your session…</div>;
  if (state === "unauthenticated") return <Redirect to="/login" />;
  return <>{children}</>;
}
function AppRouter() {
  const protectedRoute = (title: string, children: React.ReactNode) => <Protected><AppLayout title={title}>{children}</AppLayout></Protected>;
  return <Switch>
    <Route path="/login" component={Login} /><Route path="/register" component={Register} />
    <Route path="/">{protectedRoute("Dashboard", <Dashboard />)}</Route><Route path="/contacts">{protectedRoute("Contacts", <Contacts />)}</Route><Route path="/segments">{protectedRoute("Segments", <Segments />)}</Route><Route path="/campaigns">{protectedRoute("Campaigns", <Campaigns />)}</Route><Route path="/templates">{protectedRoute("Email Templates", <Templates />)}</Route><Route path="/automations">{protectedRoute("Automations", <Automations />)}</Route><Route path="/analytics">{protectedRoute("Analytics", <Analytics />)}</Route><Route path="/ab-testing">{protectedRoute("A/B Testing", <AbTesting />)}</Route><Route path="/lead-scoring">{protectedRoute("Lead Scoring", <LeadScoring />)}</Route><Route path="/ai-assistant">{protectedRoute("AI Marketing Assistant", <AiAssistant />)}</Route><Route path="/settings">{protectedRoute("Settings", <Settings />)}</Route><Route component={NotFound} />
  </Switch>;
}
function App() { return <QueryClientProvider client={queryClient}><ThemeProvider><TooltipProvider><Toaster /><Router hook={useHashLocation}><AppRouter /></Router></TooltipProvider></ThemeProvider></QueryClientProvider>; }
export default App;
