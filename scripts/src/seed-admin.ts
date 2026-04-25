import bcrypt from "bcryptjs";
import { db, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

async function main() {
  const email = getRequiredEnv("ADMIN_SEED_EMAIL").toLowerCase();
  const password = getRequiredEnv("ADMIN_SEED_PASSWORD");
  const role = (process.env["ADMIN_SEED_ROLE"]?.trim().toLowerCase() || "super_admin") as
    | "super_admin"
    | "staff";

  if (password.length < 12) {
    throw new Error("ADMIN_SEED_PASSWORD must be at least 12 characters");
  }

  if (!["super_admin", "staff"].includes(role)) {
    throw new Error("ADMIN_SEED_ROLE must be either super_admin or staff");
  }

  const [existingAdmin] = await db.select().from(adminsTable).limit(1);
  if (existingAdmin) {
    throw new Error("Admin bootstrap aborted: at least one admin already exists");
  }

  const [duplicate] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email))
    .limit(1);
  if (duplicate) {
    throw new Error(`Admin with email "${email}" already exists`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [admin] = await db
    .insert(adminsTable)
    .values({
      email,
      passwordHash,
      role,
    })
    .returning({
      id: adminsTable.id,
      email: adminsTable.email,
      role: adminsTable.role,
      createdAt: adminsTable.createdAt,
    });

  console.log(
    JSON.stringify(
      {
        message: "Seeded initial admin successfully",
        admin,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
