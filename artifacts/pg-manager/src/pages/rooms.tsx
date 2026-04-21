import { useMemo, useState } from "react";
import {
  useListRooms,
  useListProperties,
  useListTenants,
  useCreateRoom,
  useAssignBed,
  useUnassignBed,
} from "@workspace/api-client-react";
import type { Bed as BedT, RoomWithBeds } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Bed, Plus, UserPlus, UserMinus } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

export function RoomsPage() {
  const { data: properties } = useListProperties();
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const { data: rooms, isLoading } = useListRooms(
    propertyFilter === "all" ? undefined : { propertyId: Number(propertyFilter) },
  );
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, RoomWithBeds[]>();
    for (const r of rooms ?? []) {
      const key = r.propertyName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [rooms]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Rooms & beds</h2>
          <p className="text-sm text-muted-foreground">Manage room inventory and bed assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Filter property" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {(properties ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" /> Add room</Button>
            </DialogTrigger>
            <NewRoomDialog onClose={() => setOpen(false)} />
          </Dialog>
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      <div className="space-y-6">
        {grouped.map(([propName, items]) => (
          <div key={propName} className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{propName}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((r) => <RoomCard key={r.id} room={r} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomCard({ room }: { room: RoomWithBeds }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">Room {room.roomNumber}</CardTitle>
            <div className="text-xs text-muted-foreground mt-1">
              Floor {room.floor} · {room.roomType} · {formatINR(room.monthlyRent)}/mo
            </div>
          </div>
          <Badge variant={room.occupiedCount === room.capacity ? "default" : "outline"}>
            {room.occupiedCount}/{room.capacity}
          </Badge>
        </div>
        {room.amenities && (
          <div className="text-xs text-muted-foreground pt-1">{room.amenities}</div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {room.beds.map((b) => <BedTile key={b.id} bed={b} />)}
        </div>
      </CardContent>
    </Card>
  );
}

function BedTile({ bed }: { bed: BedT }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-left p-3 rounded-md border transition-colors hover-elevate ${
          bed.isOccupied
            ? "bg-primary/5 border-primary/30"
            : "bg-muted/30 border-dashed border-border"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded grid place-items-center ${
            bed.isOccupied ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
            <Bed className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs font-medium">{bed.bedLabel}</div>
        </div>
        <div className="mt-2 text-xs">
          {bed.isOccupied ? (
            <span className="text-foreground truncate block">{bed.tenantName}</span>
          ) : (
            <span className="text-muted-foreground">Vacant</span>
          )}
        </div>
      </button>
      <BedDialog bed={bed} open={open} onOpenChange={setOpen} />
    </>
  );
}

function BedDialog({ bed, open, onOpenChange }: { bed: BedT; open: boolean; onOpenChange: (b: boolean) => void }) {
  const qc = useQueryClient();
  const { data: tenants } = useListTenants();
  const [tenantId, setTenantId] = useState<string>("");
  const assign = useAssignBed({ mutation: { onSuccess: () => { qc.invalidateQueries(); onOpenChange(false); } } });
  const release = useUnassignBed({ mutation: { onSuccess: () => { qc.invalidateQueries(); onOpenChange(false); } } });

  const unassigned = (tenants ?? []).filter((t) => !t.bedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bed {bed.bedLabel}</DialogTitle>
        </DialogHeader>
        {bed.isOccupied ? (
          <div className="space-y-4">
            <div className="p-4 rounded-md bg-muted/40">
              <div className="text-sm text-muted-foreground">Currently occupied by</div>
              <div className="font-medium">{bed.tenantName}</div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button
                variant="destructive"
                onClick={() => release.mutate({ id: bed.id })}
                disabled={release.isPending}
              >
                <UserMinus className="w-4 h-4 mr-1" />
                Release bed
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Assign to tenant</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  {unassigned.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground">No unassigned tenants</div>
                  )}
                  {unassigned.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                disabled={!tenantId || assign.isPending}
                onClick={() => assign.mutate({ id: bed.id, data: { tenantId: Number(tenantId) } })}
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Assign
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewRoomDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: properties } = useListProperties();
  const create = useCreateRoom({ mutation: { onSuccess: () => { qc.invalidateQueries(); onClose(); } } });
  const [form, setForm] = useState({
    propertyId: 0,
    roomNumber: "",
    floor: 1,
    capacity: 2,
    monthlyRent: 8000,
    roomType: "double" as const,
    amenities: "",
  });
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Add room</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ data: form });
        }}
      >
        <div className="grid gap-2">
          <Label>Property</Label>
          <Select value={String(form.propertyId || "")} onValueChange={(v) => setForm({ ...form, propertyId: Number(v) })}>
            <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              {(properties ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Room number</Label>
            <Input required value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Floor</Label>
            <Input type="number" min={1} value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={form.roomType} onValueChange={(v: any) => setForm({ ...form, roomType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["single","double","triple","quad","dormitory"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Capacity</Label>
            <Input type="number" min={1} max={12} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </div>
          <div className="grid gap-2">
            <Label>Rent (₹)</Label>
            <Input type="number" min={0} value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Amenities</Label>
          <Input placeholder="AC, Wi-Fi, Attached bath" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!form.propertyId || create.isPending}>
            {create.isPending ? "Saving…" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
