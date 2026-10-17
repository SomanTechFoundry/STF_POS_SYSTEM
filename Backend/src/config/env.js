import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DB_SSL: booleanFromEnv.default(false),
  JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 chars"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  FRONTEND_BASE_URL: z.string().default("http://localhost:5173"),
  BACKEND_PUBLIC_URL: z.string().default("http://localhost:5000"),
  APPROVAL_TO_EMAIL: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: booleanFromEnv.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  BREVO_API_KEY: z.string().optional(),
  BREVO_API_URL: z.string().url().default("https://api.brevo.com/v3/smtp/email"),
  ADMIN_EMAIL: z.string().email().default("somandeepak14@gmail.com")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

export default parsed.data;
