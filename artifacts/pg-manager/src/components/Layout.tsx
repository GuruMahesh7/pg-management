import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  Receipt,
  MessageSquareWarning,
  Bell,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { ADMIN_SESSION_QUERY_KEY, logoutAdmin, type AdminSession } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/rooms", label: "Rooms & Beds", icon: DoorOpen },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/payments", label: "Payments", icon: Receipt },
  { href: "/complaints", label: "Complaints", icon: MessageSquareWarning },
];

export function Layout({
  children,
  session,
}: {
  children: React.ReactNode;
  session: AdminSession;
}) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: summary } = useGetDashboardSummary();
  const logoutMutation = useMutation({
    mutationFn: logoutAdmin,
    onSettled: () => {
      queryClient.removeQueries({ queryKey: ADMIN_SESSION_QUERY_KEY });
      queryClient.clear();
      setLocation("/login");
    },
  });

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="fixed top-0 left-0 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border z-30">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">
              SF
            </div>
            <div>
              <div className="font-semibold text-base leading-tight">Stayflow</div>
              <div className="text-xs text-sidebar-foreground/60">PG Management</div>
            </div>
          </div>
        </div>

        <nav className="p-3 flex-1 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-sidebar-accent grid place-items-center text-sm font-medium">
                {session.admin.email.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-sm min-w-0">
                <div className="font-medium capitalize">{session.admin.role.replace("_", " ")}</div>
                <div className="text-xs text-sidebar-foreground/60 truncate">{session.admin.email}</div>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-start"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 ml-64">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8">
          <div>
            <div className="text-sm text-muted-foreground">Welcome back</div>
            <div className="text-base font-semibold">
              {NAV.find((n) =>
                n.href === "/" ? location === "/" : location.startsWith(n.href),
              )?.label ?? "Dashboard"}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {summary && summary.openComplaints + summary.overdueRentCount > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="text-destructive font-medium">
                  {summary.overdueRentCount}
                </span>{" "}
                overdue ·{" "}
                <span className="text-accent font-medium">
                  {summary.openComplaints}
                </span>{" "}
                open complaints
              </div>
            )}
            <button className="relative w-9 h-9 grid place-items-center rounded-md hover-elevate border border-transparent">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
