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
    <div className="min-h-screen flex flex-col bg-background pb-16 md:pb-0">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold text-sm">
            SF
          </div>
          <span className="font-semibold text-sm">Stayflow</span>
        </div>
        <div className="flex items-center gap-3">
          {summary && summary.openComplaints + summary.overdueRentCount > 0 && (
            <div className="flex items-center text-[10px] font-medium gap-1 text-destructive bg-destructive/10 px-2 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
              </span>
              {summary.overdueRentCount + summary.openComplaints}
            </div>
          )}
          <button 
            className="w-8 h-8 rounded-full bg-accent grid place-items-center text-xs font-medium border border-border"
            onClick={() => {
              if (window.confirm("Do you want to sign out?")) {
                logoutMutation.mutate();
              }
            }}
          >
            {session.admin.email.slice(0, 2).toUpperCase()}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-64 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border z-30">
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 border-b border-border bg-card items-center justify-between px-8">
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
        <div className="flex-1 p-4 md:p-8 overflow-auto">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around z-40 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        {NAV.map((item) => {
          const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs transition-colors relative",
                active ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute top-0 w-8 h-1 bg-primary rounded-b-full"></span>
              )}
              <Icon className={cn("w-5 h-5 mt-1", active && "text-primary")} />
              <span className="truncate text-[10px]">{item.label === "Rooms & Beds" ? "Rooms" : item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
