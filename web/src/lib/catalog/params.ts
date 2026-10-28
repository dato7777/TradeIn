import { z } from "zod";

export const BRANDS = ["apple", "samsung"] as const;
export const GRADES = ["A", "B", "C", "D"] as const;

export const brandSchema = z.enum(BRANDS);
export type Brand = z.infer<typeof brandSchema>;

export const gradeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(GRADES));
export type Grade = z.infer<typeof gradeSchema>;

export const modelSlugSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

// Storage in GB as used in URLs (?storage=256, 1TB = 1024).
export const storageGbSchema = z.coerce.number().int().min(1).max(16384);

export const searchQuerySchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(2).max(64));

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(60),
  offset: z.number().int().min(0).max(10000).default(0),
});

export const offerQuerySchema = z.object({
  modelSlug: modelSlugSchema,
  storageGb: storageGbSchema,
  grade: gradeSchema,
});
export type OfferQuery = z.infer<typeof offerQuerySchema>;
