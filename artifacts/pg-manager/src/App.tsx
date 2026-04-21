import { Route, Switch, Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "@/pages/dashboard";
import { PropertiesPage } from "@/pages/properties";
import { RoomsPage } from "@/pages/rooms";
import { TenantsPage } from "@/pages/tenants";
import { PaymentsPage } from "@/pages/payments";
import { ComplaintsPage } from "@/pages/complaints";
import NotFound from "@/pages/not-found";
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router base={base}>
        <Layout>
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
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
