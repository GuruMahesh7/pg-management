import { useEffect } from "react";
import { Route, Switch, Router, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "@/pages/dashboard";
import { PropertiesPage } from "@/pages/properties";
import { RoomsPage } from "@/pages/rooms";
import { TenantsPage } from "@/pages/tenants";
import { PaymentsPage } from "@/pages/payments";
import { ComplaintsPage } from "@/pages/complaints";
import { LoginPage } from "@/pages/login";
import NotFound from "@/pages/not-found";
import { Toaster } from "@/components/ui/toaster";
import {
  ADMIN_SESSION_QUERY_KEY,
  fetchAdminSession,
  isUnauthorizedError,
} from "@/lib/admin-auth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false } },
});

const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router base={base}>
        <AppRoutes />
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route>
        <ProtectedApp />
      </Route>
    </Switch>
  );
}

function ProtectedApp() {
  const [location, setLocation] = useLocation();
  const client = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ADMIN_SESSION_QUERY_KEY,
    queryFn: fetchAdminSession,
    retry: false,
  });

  useEffect(() => {
    const handleAuthError = () => {
      client.removeQueries({ queryKey: ADMIN_SESSION_QUERY_KEY });
      if (location !== "/login") {
        setLocation("/login");
      }
    };

    window.addEventListener("workspace-api-auth-error", handleAuthError);
    return () => {
      window.removeEventListener("workspace-api-auth-error", handleAuthError);
    };
  }, [client, location, setLocation]);

  useEffect(() => {
    if (sessionQuery.data?.admin && location === "/login") {
      setLocation("/");
      return;
    }

    if (sessionQuery.error && isUnauthorizedError(sessionQuery.error) && location !== "/login") {
      setLocation("/login");
    }
  }, [location, sessionQuery.data, sessionQuery.error, setLocation]);

  if (sessionQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Checking admin session...</div>
      </div>
    );
  }

  if (sessionQuery.error) {
    if (isUnauthorizedError(sessionQuery.error)) {
      return null;
    }

    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="max-w-md text-center">
          <div className="text-lg font-semibold">Unable to load admin session</div>
          <div className="mt-2 text-sm text-muted-foreground">
            {sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : "Please refresh and try again."}
          </div>
        </div>
      </div>
    );
  }

  if (!sessionQuery.data?.admin) {
    return null;
  }

  return (
    <Layout session={sessionQuery.data}>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/properties" component={PropertiesPage} />
        <Route path="/rooms" component={RoomsPage} />
        <Route path="/tenants" component={TenantsPage} />
        <Route path="/payments" component={PaymentsPage} />
        <Route path="/complaints" component={ComplaintsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}
