import { z } from "zod";

const httpsUrlInProduction = z
  .url()
  .refine(
    (value) =>
      process.env.NODE_ENV !== "production" || value.startsWith("https://"),
    "must use https in production",
  );

const optionalSecret = z.string().min(32).optional();

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: httpsUrlInProduction,
  NEXT_PUBLIC_SUPABASE_URL: httpsUrlInProduction.optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith("sb_publishable_")
    .optional(),
});

// Variables marked optional belong to later phases and become required there.
// Price freshness windows live in the database (catalog.settings), not here.
export const serverEnvSchema = clientEnvSchema.extend({
  NEXT_PUBLIC_SUPABASE_URL: httpsUrlInProduction,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_").optional(),
  TRACKING_UTM_SOURCE: z
    .string()
    .regex(/^[a-z0-9_-]{2,40}$/)
    .optional(),
  CLICK_HASH_SECRET: optionalSecret,
  REVALIDATE_SECRET: optionalSecret,
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.url().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

type RawEnv = Record<string, string | undefined>;

function withoutEmptyStrings(raw: RawEnv): RawEnv {
  return Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== undefined && value !== ""),
  );
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export function parseClientEnv(raw: RawEnv): ClientEnv {
  const result = clientEnvSchema.safeParse(withoutEmptyStrings(raw));
  if (!result.success) {
    throw new Error(`Invalid public environment: ${formatIssues(result.error)}`);
  }
  return result.data;
}

export function parseServerEnv(raw: RawEnv): ServerEnv {
  const result = serverEnvSchema.safeParse(withoutEmptyStrings(raw));
  if (!result.success) {
    throw new Error(`Invalid server environment: ${formatIssues(result.error)}`);
  }
  return result.data;
}
