import cron from "node-cron";
import { db } from "@workspace/db";
import { paymentsTable, tenantsTable, bedsTable, roomsTable, propertiesTable } from "@workspace/db";
import { eq, and, lte, isNull, or, lt } from "drizzle-orm";
import nodemailer from "nodemailer";
import { logger } from "./logger";

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

export const sendRentReminders = async () => {
  logger.info("Starting automated rent reminder job...");

  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD for due_date comparison

    // 24 hours ago
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    // Fetch pending payments due today or overdue, 
    // where no reminder was sent in the last 24 hours
    const pendingPayments = await db
      .select({
        paymentId: paymentsTable.id,
        amount: paymentsTable.amount,
        dueDate: paymentsTable.dueDate,
        tenantId: tenantsTable.id,
        tenantName: tenantsTable.fullName,
        tenantEmail: tenantsTable.email,
        roomNumber: roomsTable.roomNumber,
        propertyName: propertiesTable.name,
      })
      .from(paymentsTable)
      .innerJoin(tenantsTable, eq(paymentsTable.tenantId, tenantsTable.id))
      .leftJoin(bedsTable, eq(bedsTable.tenantId, tenantsTable.id))
      .leftJoin(roomsTable, eq(roomsTable.id, bedsTable.roomId))
      .leftJoin(propertiesTable, eq(propertiesTable.id, roomsTable.propertyId))
      .where(
        and(
          eq(paymentsTable.status, "pending"),
          lte(paymentsTable.dueDate, todayStr),
          or(
            isNull(paymentsTable.lastReminderSentAt),
            lt(paymentsTable.lastReminderSentAt, yesterday)
          )
        )
      );

    if (pendingPayments.length === 0) {
      logger.info("No pending rent payments require a reminder today.");
      return { success: true, count: 0 };
    }

    logger.info(`Found ${pendingPayments.length} tenants with pending rent.`);

    let sentCount = 0;
    let errorCount = 0;

    for (const record of pendingPayments) {
      if (!record.tenantEmail) {
        logger.warn(`Tenant ${record.tenantName} has no email, skipping.`);
        errorCount++;
        continue;
      }

      try {
        const propertyInfo = record.propertyName ? ` at ${record.propertyName}` : "";
        const roomInfo = record.roomNumber ? ` (Room ${record.roomNumber})` : "";
        
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #000;">Rent Payment Reminder</h2>
            <p>Dear ${record.tenantName},</p>
            <p>This is a friendly reminder that your rent payment${roomInfo}${propertyInfo} is currently <strong>pending</strong>.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Amount Due:</strong> ₹${record.amount}</p>
              <p style="margin: 5px 0;"><strong>Due Date:</strong> ${record.dueDate}</p>
            </div>
            
            <p>Please log in to your tenant dashboard to complete the payment as soon as possible to avoid any late fees.</p>
            
            <p>If you have already paid, please ignore this email.</p>
            
            <p>Thank you,<br>Hostel Management Team</p>
          </div>
        `;

        // Send email
        if (
          process.env.SMTP_USER &&
          process.env.SMTP_PASS &&
          process.env.SMTP_USER !== "your-email@gmail.com"
        ) {
          await transporter.sendMail({
            from: `"Hostel Manager" <${process.env.SMTP_USER}>`,
            to: record.tenantEmail,
            subject: "Action Required: Rent Payment Reminder",
            html: htmlContent,
          });
        } else {
          logger.warn(`SMTP credentials missing or using placeholders. Would have sent reminder to ${record.tenantEmail}`);
          console.log(`[TEST MODE] Reminder for ${record.tenantEmail}:\nAmount: ${record.amount}, Due: ${record.dueDate}`);
        }

        // Update the lastReminderSentAt field to prevent duplicate emails
        await db
          .update(paymentsTable)
          .set({ lastReminderSentAt: new Date() })
          .where(eq(paymentsTable.id, record.paymentId));

        sentCount++;
      } catch (err) {
        logger.error({ err, paymentId: record.paymentId }, `Failed to send reminder to ${record.tenantEmail}`);
        errorCount++;
      }
    }

    logger.info(`Rent reminder job completed. Sent: ${sentCount}, Errors: ${errorCount}`);
    return { success: true, count: sentCount, errors: errorCount };

  } catch (error) {
    logger.error({ error }, "Error running automated rent reminder job");
    return { success: false, error };
  }
};

// Schedule job to run every day at 09:00 AM
export const initCronJobs = () => {
  logger.info("Initializing cron jobs...");
  cron.schedule("0 9 * * *", () => {
    sendRentReminders();
  });
};
