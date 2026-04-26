import { Router, type IRouter, type Response } from "express";
import { db, propertiesTable, roomsTable, bedsTable, bookingRequestsTable, tenantsTable, paymentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import crypto from "crypto";
import { logger } from "../lib/logger";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecurejwtsecret_change_me_in_prod";

function setTenantSessionCookie(res: Response, tenantId: number) {
  const token = jwt.sign({ tenantId, role: "tenant" }, JWT_SECRET, { expiresIn: "7d" });

  res.cookie("tenant_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function finalizeSuccessfulBooking(
  tx: any,
  {
    razorpayOrderId,
    razorpayPaymentId,
    method,
  }: { razorpayOrderId: string; razorpayPaymentId: string; method?: string | null },
) {
  const [existing] = await tx
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.razorpayPaymentId, razorpayPaymentId))
    .limit(1);

  if (existing?.tenantId) {
    const [tenant] = await tx.select().from(tenantsTable).where(eq(tenantsTable.id, existing.tenantId)).limit(1);
    if (tenant) return { tenant, password: tenant.phone };
  }

  const [payment] = await tx
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.razorpayOrderId, razorpayOrderId), eq(paymentsTable.status, "pending")))
    .limit(1);
  if (!payment || !payment.bookingRequestId) throw new Error("Payment record not found");

  const [booking] = await tx
    .select()
    .from(bookingRequestsTable)
    .where(eq(bookingRequestsTable.id, payment.bookingRequestId))
    .limit(1);
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "pending" && booking.status !== "confirmed") throw new Error("Booking is not payable");

  const password = booking.phone.trim();
  const passwordHash = await bcrypt.hash(password, 10);

  await tx
    .update(paymentsTable)
    .set({
      status: "paid",
      razorpayPaymentId,
      paidDate: new Date(),
      method: method ?? "razorpay",
    })
    .where(eq(paymentsTable.id, payment.id));
  await tx.update(bookingRequestsTable).set({ status: "confirmed" }).where(eq(bookingRequestsTable.id, booking.id));

  const [tenant] = await tx
    .insert(tenantsTable)
    .values({
      fullName: booking.applicantName,
      email: booking.email,
      phone: booking.phone,
      idProofNumber: booking.idNumber,
      passwordHash,
      joinedAt: new Date().toISOString().slice(0, 10),
      status: "active",
    })
    .returning();

  await tx.update(bedsTable).set({ isOccupied: true, tenantId: tenant.id }).where(eq(bedsTable.id, booking.bedId));
  await tx.update(paymentsTable).set({ tenantId: tenant.id }).where(eq(paymentsTable.id, payment.id));

  return { tenant, password };
}

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
    logger.info({ bedId: parsed.bedId, bed }, "Booking Request for Bed");

    if (!bed || bed.isOccupied) {
      logger.warn({ bed }, "Bed unavailable or occupied");
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
      logger.error({ err: error }, "Failed to create booking request");
      res.status(500).json({ error: "Failed to create booking request" });
    }
  }
});


router.post("/public/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.email, email));
    if (!tenant) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!tenant.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const isValid = await bcrypt.compare(password, tenant.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    setTenantSessionCookie(res, tenant.id);

    logger.info({ tenantId: tenant.id }, "Login Success - Cookie Set for tenant");

    res.json({ success: true, tenantId: tenant.id });
  } catch (error) {
    logger.error({ err: error }, "Login error");
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
      dueDate: new Date().toISOString().slice(0, 10),
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      notes: "Security deposit",
    });

    res.json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    logger.error({ err: error }, "Razorpay Order Error");
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Razorpay Checkout Verification (Public)
router.post("/public/payments/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = z
      .object({
        razorpay_order_id: z.string().min(1),
        razorpay_payment_id: z.string().min(1),
        razorpay_signature: z.string().min(1),
      })
      .parse(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      res.status(400).json({ error: "Invalid payment signature" });
      return;
    }

    const result = await db.transaction((tx) =>
      finalizeSuccessfulBooking(tx, {
        razorpayOrderId,
        razorpayPaymentId,
        method: "razorpay",
      }),
    );

    setTenantSessionCookie(res, result.tenant.id);
    res.json({
      success: true,
      tenantId: result.tenant.id,
      email: result.tenant.email,
      password: result.password,
    });
  } catch (error) {
    logger.error({ err: error }, "Razorpay Verification Error");
    res.status(500).json({ error: "Failed to verify payment" });
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
        const result = await finalizeSuccessfulBooking(tx, {
          razorpayOrderId,
          razorpayPaymentId,
          method: req.body.payload.payment.entity.method,
        });
        logger.info({ tenantId: result.tenant.id }, "Tenant booking finalized");
      });
      res.json({ status: "ok" });
    } catch (e) {
      logger.error({ err: e }, "Webhook booking finalization error");
      res.status(500).end();
    }
  } else {
    res.json({ status: "ignored" });
  }
});

export default router;
