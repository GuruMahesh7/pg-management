import { Router } from "express";
import { db, otpVerifications } from "@workspace/db";
import { eq, desc, and, gt } from "drizzle-orm";
import { z } from "zod";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { logger } from "../lib/logger";

const verificationRouter = Router();

// Nodemailer config
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
});

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

verificationRouter.post("/verification/send-email-otp", async (req, res) => {
  try {
    const { email } = sendOtpSchema.parse(req.body);

    // Rate limiting: max 3 attempts per 10 mins
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentRequests = await db.query.otpVerifications.findMany({
      where: and(
        eq(otpVerifications.email, email),
        gt(otpVerifications.createdAt, tenMinsAgo)
      )
    });

    if (recentRequests.length >= 3) {
      res.status(429).json({ message: "Too many requests. Please try again later." });
      return;
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    await db.insert(otpVerifications).values({
      email,
      otpHash,
      expiresAt,
    });

    // Send email
    if (
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_USER !== "your-email@gmail.com"
    ) {
      await transporter.sendMail({
        from: `"Hostel Manager" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Your Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Email Verification</h2>
            <p>Your verification code is: <strong>${otp}</strong></p>
            <p>This code will expire in 5 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      });
    } else {
      logger.warn(`SMTP credentials missing or using placeholders. Would have sent OTP ${otp} to ${email}`);
      // For testing purposes, we return the OTP in the console when SMTP is not configured
      console.log(`[TEST MODE] OTP for ${email} is: ${otp}`);
    }

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    logger.error({ error }, "Error sending OTP");
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

verificationRouter.post("/verification/verify-email-otp", async (req, res) => {
  try {
    const { email, otp } = verifyOtpSchema.parse(req.body);

    const latestOtpRecord = await db.query.otpVerifications.findFirst({
      where: eq(otpVerifications.email, email),
      orderBy: [desc(otpVerifications.createdAt)],
    });

    if (!latestOtpRecord) {
      res.status(400).json({ message: "No OTP request found for this email" });
      return;
    }

    if (latestOtpRecord.verified) {
      res.status(400).json({ message: "Email is already verified" });
      return;
    }

    if (latestOtpRecord.attempts >= 5) {
      res.status(400).json({ message: "Too many failed attempts. Please request a new OTP." });
      return;
    }

    if (new Date() > latestOtpRecord.expiresAt) {
      res.status(400).json({ message: "OTP has expired. Please request a new one." });
      return;
    }

    const hashedInput = hashOtp(otp);

    if (hashedInput !== latestOtpRecord.otpHash) {
      await db.update(otpVerifications)
        .set({ attempts: latestOtpRecord.attempts + 1 })
        .where(eq(otpVerifications.id, latestOtpRecord.id));
      
      res.status(400).json({ message: "Invalid OTP" });
      return;
    }

    await db.update(otpVerifications)
      .set({ verified: true, attempts: latestOtpRecord.attempts + 1 })
      .where(eq(otpVerifications.id, latestOtpRecord.id));

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    logger.error({ error }, "Error verifying OTP");
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    res.status(500).json({ message: "Failed to verify OTP" });
  }
});

export default verificationRouter;
