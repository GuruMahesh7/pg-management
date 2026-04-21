import { useState } from "react";
import {
  useListTenants,
  useCreateTenant,
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
import { Plus, Mail, Phone, BedDouble, Search } from "lucide-react";
import { initials, formatINR, formatDate } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

export function TenantsPage() {
  const { data: tenants } = useListTenants();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = (tenants ?? []).filter((t) =>
    !q || t.fullName.toLowerCase().includes(q.toLowerCase()) || t.email.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Tenants</h2>
          <p className="text-sm text-muted-foreground">Profiles, KYC, and bed assignments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Add tenant</Button></DialogTrigger>
          <NewTenantDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold">
                  {initials(t.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{t.fullName}</div>
                  <div className="text-xs text-muted-foreground">{t.occupation ?? "—"}</div>
                </div>
                <Badge variant={t.status === "active" ? "default" : "outline"} className="capitalize">{t.status}</Badge>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{t.email}</div>
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{t.phone}</div>
                <div className="flex items-center gap-2">
                  <BedDouble className="w-3.5 h-3.5" />
                  {t.bedLabel ? (
                    <span className="text-foreground">
                      {t.propertyName} · Room {t.roomNumber} · Bed {t.bedLabel}
                    </span>
                  ) : (
                    <span className="text-amber-600">Unassigned</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                <span className="text-muted-foreground">Joined {formatDate(t.joinedAt)}</span>
                <span className="font-medium">{t.monthlyRent ? `${formatINR(t.monthlyRent)}/mo` : "—"}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No tenants found</CardContent></Card>
      )}
    </div>
  );
}

function NewTenantDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateTenant({ mutation: { onSuccess: () => { qc.invalidateQueries(); onClose(); } } });
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "",
    gender: "" as "" | "male" | "female" | "other",
    occupation: "",
    emergencyContactName: "", emergencyContactPhone: "",
    idProofType: "" as "" | "aadhaar" | "passport" | "driving_license" | "voter_id" | "pan",
    idProofNumber: "",
    permanentAddress: "",
    joinedAt: new Date().toISOString().slice(0, 10),
  });
  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Add tenant</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const { gender, idProofType, ...rest } = form;
          create.mutate({
            data: {
              ...rest,
              gender: gender || undefined,
              idProofType: idProofType || undefined,
            } as any,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2 col-span-2"><Label>Full name</Label><Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div className="grid gap-2"><Label>Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid gap-2"><Label>Phone</Label><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="grid gap-2">
            <Label>Gender</Label>
            <Select value={form.gender} onValueChange={(v: any) => setForm({ ...form, gender: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {["male","female","other"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2"><Label>Occupation</Label><Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} /></div>
          <div className="grid gap-2"><Label>Emergency contact name</Label><Input value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} /></div>
          <div className="grid gap-2"><Label>Emergency contact phone</Label><Input value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} /></div>
          <div className="grid gap-2">
            <Label>ID proof type</Label>
            <Select value={form.idProofType} onValueChange={(v: any) => setForm({ ...form, idProofType: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {["aadhaar","passport","driving_license","voter_id","pan"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2"><Label>ID number</Label><Input value={form.idProofNumber} onChange={(e) => setForm({ ...form, idProofNumber: e.target.value })} /></div>
          <div className="grid gap-2"><Label>Joined</Label><Input type="date" required value={form.joinedAt} onChange={(e) => setForm({ ...form, joinedAt: e.target.value })} /></div>
          <div className="grid gap-2 col-span-2"><Label>Permanent address</Label><Textarea value={form.permanentAddress} onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
