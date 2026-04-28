import { Router } from "express";
import { db, otpVerifications } from "@workspace/db";
import { eq, desc, and, gt } from "drizzle-orm";
import { z } from "zod";
import { Resend } from "resend";
import crypto from "crypto";
import { logger } from "../lib/logger";

const verificationRouter = Router();

// Resend config
const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER_EMAIL = (process.env.SENDER_EMAIL || "onboarding@resend.dev").split('#')[0].trim();

if (process.env.RESEND_API_KEY) {
  const maskedKey = process.env.RESEND_API_KEY.substring(0, 7) + "..." + process.env.RESEND_API_KEY.substring(process.env.RESEND_API_KEY.length - 4);
  logger.info(`Resend initialized with API Key: ${maskedKey} and Sender: ${SENDER_EMAIL}`);
} else {
  logger.warn("RESEND_API_KEY is missing from environment variables!");
}

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
    if (process.env.RESEND_API_KEY) {
      const fromEmail = `"Hostel Manager" <${SENDER_EMAIL}>`;
      logger.info({ fromEmail, to: email }, "Sending email via Resend");
      const { data, error } = await resend.emails.send({
        from: fromEmail,
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

      if (error) {
        logger.error({ error }, "Resend error");
        res.status(400).json({ message: error.message || "Failed to send email via Resend" });
        return;
      }
      logger.info({ data }, "Email sent via Resend");
    } else {
      logger.warn(`RESEND_API_KEY missing. Would have sent OTP ${otp} to ${email}`);
      // For testing purposes, we return the OTP in the console when SMTP is not configured
      logger.info(`[TEST MODE] OTP for ${email} is: ${otp}`);
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
