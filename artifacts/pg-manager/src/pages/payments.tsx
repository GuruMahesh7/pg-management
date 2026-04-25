import { useState } from "react";
import {
  useListPayments,
  useMarkPaymentPaid,
  useGenerateMonthlyRent,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Calendar, CheckCircle2, RefreshCw } from "lucide-react";
import { formatINR, formatDate, monthName } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  overdue: "bg-destructive/10 text-destructive border-destructive/30",
};

export function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: payments } = useListPayments(
    statusFilter === "all" ? undefined : { status: statusFilter as any },
  );

  const totals = (payments ?? []).reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + Number(p.amount);
      return acc;
    },
    { paid: 0, pending: 0, overdue: 0 } as Record<string, number>,
  );

  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Payments</h2>
          <p className="text-sm text-muted-foreground">Monthly rent collection and reconciliation</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const res = await fetch('/api/payments/send-reminders', { 
                  method: 'POST',
                  credentials: 'include'
                });
                const json = await res.json();
                if (res.ok) {
                  toast({
                    title: "Success",
                    description: `Sent ${json.data.count} reminders.`,
                  });
                } else {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to send reminders.",
                  });
                }
              } catch (e) {
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: "An error occurred.",
                });
              }
            }}
          >
            <Mail className="w-4 h-4 mr-1" /> Send Reminders
          </Button>
          <GenerateDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Collected" value={totals.paid} tone="success" />
        <SummaryCard label="Pending" value={totals.pending} tone="warning" />
        <SummaryCard label="Overdue" value={totals.overdue} tone="danger" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Property / Room</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).map((p) => <PaymentRow key={p.id} p={p} />)}
                {payments && payments.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No payments to show</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" }) {
  const cls = { success: "text-emerald-600", warning: "text-amber-600", danger: "text-destructive" }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${cls}`}>{formatINR(value)}</div>
      </CardContent>
    </Card>
  );
}

function PaymentRow({ p }: { p: any }) {
  const qc = useQueryClient();
  const mark = useMarkPaymentPaid({ mutation: { onSuccess: () => qc.invalidateQueries() } });
  return (
    <tr className="border-t border-border hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{p.tenantName}</div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {p.propertyName ?? "—"}{p.roomNumber ? ` · ${p.roomNumber}` : ""}
      </td>
      <td className="px-4 py-3">{monthName(p.month)} {p.year}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(p.dueDate)}</td>
      <td className="px-4 py-3 text-right font-medium">{formatINR(p.amount)}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={`capitalize ${STATUS_TONE[p.status] ?? ""}`}>{p.status}</Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {p.status !== "paid" ? (
          <Select onValueChange={(v) => mark.mutate({ id: p.id, data: { method: v as any } })}>
            <SelectTrigger className="w-36 ml-auto"><SelectValue placeholder="Mark paid" /></SelectTrigger>
            <SelectContent>
              {["upi","cash","bank_transfer","card"].map((m) => <SelectItem key={m} value={m}>{m.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {p.method ?? "paid"}
          </span>
        )}
      </td>
    </tr>
  );
}

function GenerateDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const gen = useGenerateMonthlyRent({
    mutation: {
      onSuccess: () => { qc.invalidateQueries(); setOpen(false); },
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><RefreshCw className="w-4 h-4 mr-1" /> Generate monthly</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Generate rent invoices</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Create rent invoices for every active tenant for the selected month. Existing invoices will be skipped.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{monthName(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => gen.mutate({ data: { month, year } })} disabled={gen.isPending}>
            {gen.isPending ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
