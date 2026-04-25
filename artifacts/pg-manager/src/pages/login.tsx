import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADMIN_SESSION_QUERY_KEY,
  fetchAdminSession,
  type AdminSession,
  isUnauthorizedError,
  loginAdmin,
} from "@/lib/admin-auth";

export function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await loginAdmin(email, password);
      return fetchAdminSession();
    },
    onSuccess: (session) => {
      queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, session);
      setLocation("/");
    },
  });

  useEffect(() => {
    const session = queryClient.getQueryData<AdminSession>(ADMIN_SESSION_QUERY_KEY);
    if (session?.admin) {
      setLocation("/");
    }
  }, [queryClient, setLocation]);

  const errorMessage = (() => {
    if (!loginMutation.error) {
      return null;
    }

    if (isUnauthorizedError(loginMutation.error)) {
      return "Invalid email or password.";
    }

    return loginMutation.error instanceof Error
      ? loginMutation.error.message
      : "Login failed. Please try again.";
  })();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(38,87,214,0.16),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden rounded-3xl border border-slate-200 bg-slate-950 p-10 text-slate-50 shadow-2xl lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              <ShieldCheck className="h-4 w-4" />
              Admin Security
            </div>
            <h1 className="mt-6 max-w-md text-4xl font-semibold leading-tight">
              Secure access for operations that cannot afford mistakes.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
              Sessions are signed with JWT, stored in HTTP-only cookies, and checked on every
              admin API request. Sensitive actions stay behind role-aware middleware.
            </p>
            <div className="mt-10 grid gap-4 text-sm text-slate-200">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                Centralized route protection across dashboard, tenants, payments, and complaints.
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                `super_admin` privileges for high-risk actions like tenant deletion and admin
                management.
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                Brute-force protection on login with lockout windows and generic auth failures.
              </div>
            </div>
          </section>

          <Card className="border-slate-200 shadow-xl">
            <CardHeader className="space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-slate-50">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-2xl">Admin sign in</CardTitle>
                <CardDescription>
                  Use your approved admin account. Public self-registration is disabled.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  loginMutation.mutate({
                    email,
                    password,
                  });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@stayflow.in"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>

                {errorMessage ? (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {errorMessage}
                  </div>
                ) : null}

                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
