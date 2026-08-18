import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayout } from "@/components/layout";

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
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <AppLayout title="Dashboard">
          <Dashboard />
        </AppLayout>
      </Route>
      <Route path="/contacts">
        <AppLayout title="Contacts">
          <Contacts />
        </AppLayout>
      </Route>
      <Route path="/segments">
        <AppLayout title="Segments">
          <Segments />
        </AppLayout>
      </Route>
      <Route path="/campaigns">
        <AppLayout title="Campaigns">
          <Campaigns />
        </AppLayout>
      </Route>
      <Route path="/templates">
        <AppLayout title="Email Templates">
          <Templates />
        </AppLayout>
      </Route>
      <Route path="/automations">
        <AppLayout title="Automations">
          <Automations />
        </AppLayout>
      </Route>
      <Route path="/analytics">
        <AppLayout title="Analytics">
          <Analytics />
        </AppLayout>
      </Route>
      <Route path="/ab-testing">
        <AppLayout title="A/B Testing">
          <AbTesting />
        </AppLayout>
      </Route>
      <Route path="/lead-scoring">
        <AppLayout title="Lead Scoring">
          <LeadScoring />
        </AppLayout>
      </Route>
      <Route path="/ai-assistant">
        <AppLayout title="AI Marketing Assistant">
          <AiAssistant />
        </AppLayout>
      </Route>
      <Route path="/settings">
        <AppLayout title="Settings">
          <Settings />
        </AppLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
