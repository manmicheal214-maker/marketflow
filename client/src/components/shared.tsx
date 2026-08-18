import { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Inbox } from "lucide-react";

export function KpiCard({
  label, value, change, icon: Icon, color = "blue",
}: {
  label: string;
  value: string;
  change?: { value: string; positive: boolean };
  icon: React.ComponentType<{ className?: string }>;
  color?: "blue" | "green" | "orange" | "purple" | "red";
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    red: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  };

  return (
    <Card data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-2xl font-bold tracking-tight" data-testid={`kpi-value-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</span>
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {change && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className={cn("text-xs font-medium", change.positive ? "text-green-600" : "text-red-500")}>
              {change.positive ? "↑" : "↓"} {change.value}
            </span>
            <span className="text-xs text-muted-foreground">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex h-64 items-center justify-center" data-testid="loading-state">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title, description, action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center" data-testid="empty-state">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

export function SectionCard({
  title, description, children, action, className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status, colorClass }: { status: string; colorClass: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", colorClass)}>
      {status}
    </span>
  );
}
