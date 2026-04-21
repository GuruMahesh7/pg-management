import { useState } from "react";
import {
  useListComplaints,
  useListTenants,
  useCreateComplaint,
  useUpdateComplaintStatus,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, MessageSquareWarning } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

const PRIORITY_TONE: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  high: "bg-destructive/10 text-destructive border-destructive/30",
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  in_progress: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  resolved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

const COLUMNS = [
  { key: "open" as const, label: "Open" },
  { key: "in_progress" as const, label: "In progress" },
  { key: "resolved" as const, label: "Resolved" },
];

export function ComplaintsPage() {
  const { data: complaints } = useListComplaints();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Complaints</h2>
          <p className="text-sm text-muted-foreground">Tenant tickets and resolution tracking</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> New ticket</Button>
          </DialogTrigger>
          <NewComplaintDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = (complaints ?? []).filter((c) => c.status === col.key);
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</div>
                <Badge variant="outline">{items.length}</Badge>
              </div>
              <div className="space-y-3 min-h-[100px]">
                {items.map((c) => <ComplaintCard key={c.id} c={c} />)}
                {items.length === 0 && (
                  <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">
                    Nothing here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComplaintCard({ c }: { c: any }) {
  const qc = useQueryClient();
  const update = useUpdateComplaintStatus({ mutation: { onSuccess: () => qc.invalidateQueries() } });
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize text-xs">{c.category}</Badge>
              <Badge variant="outline" className={`capitalize text-xs ${PRIORITY_TONE[c.priority] ?? ""}`}>{c.priority}</Badge>
            </div>
            <div className="font-medium text-sm mt-2 line-clamp-1">{c.title}</div>
          </div>
          <MessageSquareWarning className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{c.tenantName}</span>
          {c.roomNumber && <> · Room {c.roomNumber}</>}
        </div>
        {c.resolutionNote && c.status === "resolved" && (
          <div className="text-xs p-2 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
            {c.resolutionNote}
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
          <Select
            value={c.status}
            onValueChange={(v) => update.mutate({ id: c.id, data: { status: v as any } })}
          >
            <SelectTrigger className={`h-7 w-32 text-xs ${STATUS_TONE[c.status] ?? ""}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function NewComplaintDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: tenants } = useListTenants();
  const create = useCreateComplaint({ mutation: { onSuccess: () => { qc.invalidateQueries(); onClose(); } } });
  const [form, setForm] = useState({
    tenantId: 0,
    category: "plumbing" as const,
    title: "",
    description: "",
    priority: "medium" as const,
  });
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>New complaint ticket</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ data: form }); }}>
        <div className="grid gap-2">
          <Label>Tenant</Label>
          <Select value={String(form.tenantId || "")} onValueChange={(v) => setForm({ ...form, tenantId: Number(v) })}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {(tenants ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.fullName}{t.bedLabel ? ` · ${t.bedLabel}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v: any) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["plumbing","electricity","cleaning","internet","furniture","security","other"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["low","medium","high"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="grid gap-2"><Label>Description</Label><Textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!form.tenantId || create.isPending}>{create.isPending ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
