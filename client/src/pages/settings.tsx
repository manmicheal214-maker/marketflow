import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { User, Database, Mail, Shield, RotateCcw, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Settings() {
  const { toast } = useToast();
  const [resetOpen, setResetOpen] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/reset-demo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Demo data reset", description: "All demo data has been restored to defaults." });
      setResetOpen(false);
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Profile */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Profile</h3>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">AM</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">Alex Morgan</p>
              <p className="text-sm text-muted-foreground">demo@marketflow.io</p>
              <Badge variant="secondary" className="text-xs mt-1">Demo Account</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-name">Full Name</Label>
              <Input id="s-name" defaultValue="Alex Morgan" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Email</Label>
              <Input id="s-email" defaultValue="demo@marketflow.io" disabled />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Profile editing is disabled in demo mode. Connect Supabase Auth to enable user management.</p>
        </CardContent>
      </Card>

      {/* Email configuration */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Email Configuration</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">SMTP Provider</p>
                <p className="text-xs text-muted-foreground">Not configured — using demo mode</p>
              </div>
              <Badge variant="outline" className="text-xs">Demo</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Mailpit (Development)</p>
                <p className="text-xs text-muted-foreground">Local SMTP testing at localhost:1025</p>
              </div>
              <Badge variant="secondary" className="text-xs">Available</Badge>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-2">To enable real email sending, set these environment variables:</p>
            <pre className="text-xs font-mono text-muted-foreground">SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@marketflow.io</pre>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Security</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Row Level Security (RLS) enabled on all tables</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Environment variables never exposed to client</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Email input validation on all forms</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>HTML email content sanitized</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo data */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Demo Data</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            MarketFlow runs in demo mode with simulated data. All metrics, contacts, and campaign results are
            generated for demonstration purposes. Reset to restore the original demo dataset.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="text-xl font-bold">1,284</div>
              <div className="text-xs text-muted-foreground">Contacts</div>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="text-xl font-bold">17</div>
              <div className="text-xs text-muted-foreground">Campaigns</div>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="text-xl font-bold">42.7%</div>
              <div className="text-xs text-muted-foreground">Avg Open Rate</div>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="text-xl font-bold">8.4%</div>
              <div className="text-xs text-muted-foreground">Avg Click Rate</div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setResetOpen(true)} data-testid="button-reset-demo">
            <RotateCcw className="mr-1.5 h-4 w-4" /> Reset Demo Data
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all contacts, campaigns, segments, and other data, then restore the original demo dataset. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetMutation.mutate()} data-testid="button-confirm-reset">
              Reset Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
