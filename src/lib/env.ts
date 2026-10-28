import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Neon pooled URL — Prisma Client runtime */
  DATABASE_URL: z.string().min(1),
  /** Neon direct URL — Prisma Migrate (falls back to DATABASE_URL if omitted) */
  DIRECT_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default("8h"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3002"),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  APPROVAL_TO_EMAIL: z.string().email().optional(),
  SMTP_FROM_EMAIL: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  BREVO_API_URL: z.string().default("https://api.brevo.com/v3/smtp/email"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

export type AppEnv = z.infer<typeof schema> & { DIRECT_URL: string };

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  cached = {
    ...parsed.data,
    DIRECT_URL: parsed.data.DIRECT_URL || parsed.data.DATABASE_URL,
  };
  return cached;
}

export function appUrl(): string {
  return getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}
