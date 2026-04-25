import { useState } from "react";
import {
  useListProperties,
  useCreateProperty,
  useCreateRoom,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, MapPin, Phone, Plus, Bed } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function PropertiesPage() {
  const { data: properties, isLoading } = useListProperties();
  const [open, setOpen] = useState(false);
  // Track which propertyId to pre-fill when opening Add Room from a card
  const [addRoomPropertyId, setAddRoomPropertyId] = useState<number | null>(null);
  type PropertyCard = (NonNullable<typeof properties>[number] & {
    totalRooms?: number;
    totalBeds?: number;
    occupiedBeds?: number;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">All properties</h2>
          <p className="text-sm text-muted-foreground">Manage hostel locations and capacity</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1" /> Add property
            </Button>
          </DialogTrigger>
          <NewPropertyDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(properties ?? []).map((property) => {
          const p = property as PropertyCard;
          return (
          <Card key={p.id} className="overflow-hidden">
            <div className="h-2 bg-primary" />
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.totalFloors} floors</div>
                </div>
                <div className="w-10 h-10 rounded-md bg-primary/10 text-primary grid place-items-center">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{p.address}, {p.city}</span>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {p.contactPhone}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                <Stat label="Rooms" value={p.totalRooms ?? 0} />
                <Stat label="Beds" value={p.totalBeds ?? 0} icon={Bed} />
                <Stat label="Occupied" value={p.occupiedBeds ?? 0} highlight />
              </div>
              {/* Add Room button per property */}
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-1"
                onClick={() => setAddRoomPropertyId(p.id)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add room
              </Button>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {properties && properties.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No properties yet. Add your first one to get started.
          </CardContent>
        </Card>
      )}

      {/* Add Room dialog, pre-filled with selected property */}
      {addRoomPropertyId !== null && (
        <Dialog open={true} onOpenChange={(v) => { if (!v) setAddRoomPropertyId(null); }}>
          <NewRoomDialog
            preselectedPropertyId={addRoomPropertyId}
            onClose={() => setAddRoomPropertyId(null)}
          />
        </Dialog>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  icon: Icon,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`text-lg font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function NewPropertyDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateProperty({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries();
        onClose();
      },
    },
  });
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    totalFloors: 1,
    contactPhone: "",
    description: "",
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add property</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ data: form });
        }}
      >
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>Address</Label>
          <Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>City</Label>
            <Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Floors</Label>
            <Input
              type="number"
              min={1}
              required
              value={form.totalFloors}
              onChange={(e) => setForm({ ...form, totalFloors: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Contact phone</Label>
          <Input required value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function NewRoomDialog({
  onClose,
  preselectedPropertyId,
}: {
  onClose: () => void;
  preselectedPropertyId?: number;
}) {
  const qc = useQueryClient();
  const { data: properties } = useListProperties();
  const create = useCreateRoom({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries();
        onClose();
      },
    },
  });
  const [form, setForm] = useState({
    propertyId: preselectedPropertyId ?? 0,
    roomNumber: "",
    floor: 1,
    capacity: 2,
    monthlyRent: 8000,
    roomType: "double" as const,
    amenities: "",
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add room</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ data: form });
        }}
      >
        <div className="grid gap-2">
          <Label>Property</Label>
          <Select
            value={String(form.propertyId || "")}
            onValueChange={(v) => setForm({ ...form, propertyId: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {(properties ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Room number</Label>
            <Input
              required
              value={form.roomNumber}
              onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Floor</Label>
            <Input
              type="number"
              min={1}
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select
              value={form.roomType}
              onValueChange={(v: any) => setForm({ ...form, roomType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["single", "double", "triple", "quad", "dormitory"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Capacity</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Rent (₹)</Label>
            <Input
              type="number"
              min={0}
              value={form.monthlyRent}
              onChange={(e) => setForm({ ...form, monthlyRent: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Amenities</Label>
          <Input
            placeholder="AC, Wi-Fi, Attached bath"
            value={form.amenities}
            onChange={(e) => setForm({ ...form, amenities: e.target.value })}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!form.propertyId || create.isPending}>
            {create.isPending ? "Saving…" : "Create room"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
