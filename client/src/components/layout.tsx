import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Tags, Mail, FileText, Workflow,
  FlaskConical, BarChart3, Settings, Sparkles, Menu, X,
  Bell, Search, Moon, Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet, SheetContent, SheetTrigger, SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/contacts", label: "Contacts", icon: Users },
  { path: "/segments", label: "Segments", icon: Tags },
  { path: "/campaigns", label: "Campaigns", icon: Mail },
  { path: "/templates", label: "Templates", icon: FileText },
  { path: "/automations", label: "Automations", icon: Workflow },
  { path: "/ab-testing", label: "A/B Testing", icon: FlaskConical },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/lead-scoring", label: "Lead Scoring", icon: Sparkles },
  { path: "/ai-assistant", label: "AI Assistant", icon: Sparkles },
  { path: "/settings", label: "Settings", icon: Settings },
];

function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="text-base font-bold leading-none text-white">MarketFlow</span>
        <span className="text-[10px] text-slate-400 leading-none mt-0.5">Email Marketing Automation</span>
      </div>
    </div>
  );
}

function NavLinks({ currentPath }: { currentPath: string }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => {
        const isActive = item.path === "/" ? currentPath === "/" : currentPath.startsWith(item.path);
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={item.path}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-slate-400 hover:bg-sidebar-accent/50 hover:text-slate-200"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function DemoBadge() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-xs font-medium text-amber-400">Demo Mode — Simulated Data</span>
      </div>
    </div>
  );
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [dark, setDark] = useState(false);

  function toggleTheme() {
    const newDark = !dark;
    setDark(newDark);
    document.documentElement.classList.toggle("dark", newDark);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} data-testid="button-menu">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="relative hidden flex-1 md:block max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search contacts, campaigns..."
          className="pl-9 bg-muted/50 border-0"
          data-testid="input-search"
        />
      </div>

      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme">
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </Button>
        <div className="flex items-center gap-2 pl-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              AM
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:flex flex-col">
            <span className="text-sm font-medium leading-none">Alex Morgan</span>
            <span className="text-xs text-muted-foreground leading-none mt-0.5">demo@marketflow.io</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
          <BrandLogo />
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks currentPath={location} />
        </div>
        <DemoBadge />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
            <BrandLogo />
          </div>
          <div className="flex-1 overflow-y-auto py-4" onClick={() => setMobileOpen(false)}>
            <NavLinks currentPath={location} />
          </div>
          <DemoBadge />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight" data-testid="page-title">{title}</h1>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
