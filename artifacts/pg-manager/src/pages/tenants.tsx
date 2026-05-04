import { useState } from "react";
import {
  useListTenants,
  useCreateTenant,
  useListRooms,
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
import { Plus, Mail, Phone, BedDouble, Search, CheckCircle2 } from "lucide-react";
import { initials, formatINR, formatDate } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function TenantsPage() {
  const { data: tenants } = useListTenants();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = (tenants ?? []).filter((t) =>
    !q || t.fullName.toLowerCase().includes(q.toLowerCase()) || t.email.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Tenants</h2>
          <p className="text-sm text-muted-foreground">Profiles, KYC, and bed assignments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="hidden md:flex"><Plus className="w-4 h-4 mr-1" /> Add tenant</Button>
          </DialogTrigger>
          <DialogTrigger asChild>
            <Button
              size="icon"
              className="md:hidden fixed right-4 h-14 w-14 rounded-full shadow-lg z-40"
              style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
            >
              <Plus className="w-6 h-6" />
            </Button>
          </DialogTrigger>
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
  const { data: rooms } = useListRooms();
  const vacantBeds = (rooms ?? []).flatMap(r => r.beds.filter(b => !b.isOccupied).map(b => ({ ...b, roomNumber: r.roomNumber, propertyName: r.propertyName })));

  const [form, setForm] = useState({
    fullName: "", email: "", phone: "",
    gender: "" as "" | "male" | "female" | "other",
    occupation: "",
    emergencyContactName: "", emergencyContactPhone: "",
    idProofType: "" as "" | "aadhaar" | "passport" | "driving_license" | "voter_id" | "pan",
    idProofNumber: "",
    permanentAddress: "",
    joinedAt: new Date().toISOString().slice(0, 10),
    bedId: "none",
  });

  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const handleSendOtp = async () => {
    if (!form.email) return toast.error("Please enter email first");
    setIsSendingOtp(true);
    try {
      const res = await fetch("/api/verification/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email })
      });
      if (!res.ok) throw new Error("Failed to send OTP");
      setOtpSent(true);
      toast.success("OTP sent to email");
    } catch (e) {
      toast.error("Failed to send OTP");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) return toast.error("Please enter OTP");
    setIsVerifyingOtp(true);
    try {
      const res = await fetch("/api/verification/verify-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, otp })
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Invalid OTP");
      }
      setOtpVerified(true);
      toast.success("Email verified");
    } catch (e: any) {
      toast.error(e.message || "Invalid OTP");
    } finally {
      setIsVerifyingOtp(false);
    }
  };
  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Add tenant</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!otpVerified) {
            toast.error("Please verify the email with OTP first");
            return;
          }
          const { gender, idProofType, bedId, ...rest } = form;
          create.mutate({
            data: {
              ...rest,
              gender: gender || undefined,
              idProofType: idProofType || undefined,
              bedId: bedId !== "none" ? Number(bedId) : undefined,
            } as any,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2 col-span-2"><Label>Full name</Label><Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          
          <div className="grid gap-2 col-span-2 sm:col-span-1">
            <Label>Email</Label>
            <div className="flex gap-2">
              <Input type="email" required value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setOtpSent(false); setOtpVerified(false); }} disabled={otpVerified} />
              {!otpVerified && (
                <Button type="button" variant="outline" onClick={handleSendOtp} disabled={isSendingOtp || !form.email}>
                  {isSendingOtp ? "Sending..." : (otpSent ? "Resend" : "Send OTP")}
                </Button>
              )}
            </div>
            {otpSent && !otpVerified && (
              <div className="flex gap-2 mt-2">
                <Input placeholder="Enter OTP" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} />
                <Button type="button" onClick={handleVerifyOtp} disabled={isVerifyingOtp || otp.length !== 6}>Verify</Button>
              </div>
            )}
            {otpVerified && (
              <div className="text-xs text-emerald-600 flex items-center gap-1 mt-1"><CheckCircle2 className="w-3.5 h-3.5"/> Email verified</div>
            )}
          </div>

          <div className="grid gap-2 col-span-2 sm:col-span-1"><Label>Phone (Used as password)</Label><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="grid gap-2">
            <Label>Gender</Label>
            <Select value={form.gender} onValueChange={(v: any) => setForm({ ...form, gender: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {["male", "female", "other"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
                {["aadhaar", "passport", "driving_license", "voter_id", "pan"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2"><Label>ID number</Label><Input value={form.idProofNumber} onChange={(e) => setForm({ ...form, idProofNumber: e.target.value })} /></div>
          <div className="grid gap-2"><Label>Joined</Label><Input type="date" required value={form.joinedAt} onChange={(e) => setForm({ ...form, joinedAt: e.target.value })} /></div>
          <div className="grid gap-2 col-span-2">
            <Label>Assign Bed (Optional)</Label>
            <Select value={form.bedId} onValueChange={(v) => setForm({ ...form, bedId: v })}>
              <SelectTrigger><SelectValue placeholder="Select an available bed" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Do not assign yet</SelectItem>
                {vacantBeds.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.propertyName} - Room {b.roomNumber} - Bed {b.bedLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
