import { Router, type IRouter } from "express";
import { db, propertiesTable, roomsTable, bedsTable, bookingRequestsTable, tenantsTable, paymentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecurejwtsecret_change_me_in_prod";

router.get("/public/properties", async (req, res) => {
  const properties = await db.select().from(propertiesTable);
  const rooms = await db.select().from(roomsTable);
  const beds = await db.select().from(bedsTable);

  const payload = properties.map((p) => ({
    ...p,
    rooms: rooms
      .filter((r) => r.propertyId === p.id)
      .map((r) => ({
        ...r,
        beds: beds.filter((b) => b.roomId === r.id),
      })),
  }));

  res.json(payload);
});

router.post("/public/bookings/request", async (req, res) => {
  try {
    const bodySchema = z.object({
      bedId: z.number().int(),
      applicantName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(1),
      idNumber: z.string().min(1),
    });

    const parsed = bodySchema.parse(req.body);

    // 1. Ensure bed is available
    const [bed] = await db.select().from(bedsTable).where(eq(bedsTable.id, parsed.bedId));
    console.log("Booking Request for Bed:", parsed.bedId, "Found Bed:", bed);

    if (!bed || bed.isOccupied) {
      console.log("Bed unavailable or occupied. Bed:", bed);
      throw new Error("BED_UNAVAILABLE");
    }


    // 2. Insert booking request with status = "pending"
    const [booking] = await db
      .insert(bookingRequestsTable)
      .values({ ...parsed, status: "pending" })
      .returning();

    res.json({ success: true, bookingId: booking.id });
  } catch (error: any) {
    if (error.message === "BED_UNAVAILABLE") {
      res.status(409).json({ error: "Bed is already occupied or does not exist. Please select another bed." });
    } else if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error(error);
      res.status(500).json({ error: "Failed to create booking request" });
    }
  }
});


router.post("/public/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.email, email));
    if (!tenant) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!tenant.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, tenant.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ tenantId: tenant.id, role: "tenant" }, JWT_SECRET, { expiresIn: "7d" });

    res.cookie("tenant_session", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    console.log("Login Success - Cookie Set for tenant:", tenant.id);

    res.json({ success: true, tenantId: tenant.id });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
    return;
  }
});


// Razorpay Order Creation (Public)
router.post("/public/payments/create-order", async (req, res) => {
  try {
    const { bookingRequestId } = z.object({ bookingRequestId: z.number() }).parse(req.body);

    const [booking] = await db
      .select()
      .from(bookingRequestsTable)
      .where(and(eq(bookingRequestsTable.id, bookingRequestId), eq(bookingRequestsTable.status, "pending")))
      .limit(1);

    if (!booking) {
      res.status(404).json({ error: "Pending booking request not found" });
      return;
    }

    const [room] = await db
      .select({ monthlyRent: roomsTable.monthlyRent })
      .from(roomsTable)
      .innerJoin(bedsTable, eq(bedsTable.roomId, roomsTable.id))
      .where(eq(bedsTable.id, booking.bedId))
      .limit(1);

    if (!room) {
      res.status(404).json({ error: "Room not found for this booking" });
      return;
    }

    const amount = Number(room.monthlyRent);
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_booking_${bookingRequestId}`,
    };

    const order = await razorpay.orders.create(options);
    await db.insert(paymentsTable).values({
      bookingRequestId: booking.id,
      amount: String(amount),
      status: "pending",
      razorpayOrderId: order.id,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    });

    res.json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    console.error("Razorpay Order Error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Razorpay Webhook Handler (Public)
router.post("/public/payments/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"] as string;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

  const shasum = crypto.createHmac("sha256", webhookSecret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  if (digest !== signature) {
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  if (req.body.event === "payment.captured") {
    const razorpayPaymentId = req.body.payload.payment.entity.id;
    const razorpayOrderId = req.body.payload.payment.entity.order_id;

    try {
      await db.transaction(async (tx) => {
        const [existing] = await tx.select().from(paymentsTable).where(eq(paymentsTable.razorpayPaymentId, razorpayPaymentId)).limit(1);
        if (existing) return;

        const [payment] = await tx.select().from(paymentsTable).where(and(eq(paymentsTable.razorpayOrderId, razorpayOrderId), eq(paymentsTable.status, "pending"))).limit(1);
        if (!payment || !payment.bookingRequestId) throw new Error("Payment record not found");

        const [booking] = await tx.select().from(bookingRequestsTable).where(and(eq(bookingRequestsTable.id, payment.bookingRequestId), eq(bookingRequestsTable.status, "pending"))).limit(1);
        if (!booking) throw new Error("Booking not found");

        await tx.update(paymentsTable).set({ status: "success", razorpayPaymentId, paidDate: new Date(), method: req.body.payload.payment.entity.method }).where(eq(paymentsTable.id, payment.id));
        await tx.update(bookingRequestsTable).set({ status: "confirmed" }).where(eq(bookingRequestsTable.id, booking.id));

        const password = Math.random().toString(36).slice(-8);
        const passwordHash = await bcrypt.hash(password, 10);
        const [tenant] = await tx.insert(tenantsTable).values({ fullName: booking.applicantName, email: booking.email, phone: booking.phone, idProofNumber: booking.idNumber, passwordHash, joinedAt: new Date().toISOString().slice(0, 10), status: "active" }).returning();

        await tx.update(bedsTable).set({ isOccupied: true, tenantId: tenant.id }).where(eq(bedsTable.id, booking.bedId));
        await tx.update(paymentsTable).set({ tenantId: tenant.id }).where(eq(paymentsTable.id, payment.id));

        console.log(`Tenant created: ${tenant.id}. Temp Password: ${password}`);
      });
      res.json({ status: "ok" });
    } catch (e) {
      console.error(e);
      res.status(500).end();
    }
  } else {
    res.json({ status: "ignored" });
  }
});

export default router;
