import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
