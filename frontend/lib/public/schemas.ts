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
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const companySlugSchema = z
  .string()
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const storageGbSchema = z.coerce.number().int().min(1).max(16384);

export const searchQuerySchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(2).max(64));

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(100),
  offset: z.number().int().min(0).max(10000).default(0),
});

export const offerQuerySchema = z.object({
  modelSlug: modelSlugSchema,
  storageGb: storageGbSchema,
  grade: gradeSchema,
});

const price = z.number().int().positive();
const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "timestamp");
const optionalText = z.string().nullable();

export const brandRow = z.object({
  brand: z.string(),
  model_count: z.number().int().nonnegative(),
  top_price: price,
});

export const modelRow = z.object({
  model_slug: modelSlugSchema,
  brand: z.string(),
  display_name_he: z.string(),
  display_name_en: z.string(),
  release_year: z.number().int().nullable(),
  image_url: z.string().nullable(),
  top_price: price,
  min_price: price,
  company_count: z.number().int().positive(),
  storage_options: z.array(z.number().int().positive()),
  last_updated_at: timestamp,
});

export const offerRow = z.object({
  offer_ref: z.string().regex(/^[0-9a-f]{24}$/),
  company_slug: companySlugSchema,
  company_name_he: z.string(),
  company_name_en: z.string(),
  logo_url: z.string().nullable(),
  price,
  payout_methods: z.array(z.string()),
  payout_time_he: optionalText,
  payout_time_en: optionalText,
  delivery_methods: z.array(z.string()),
  last_updated_at: timestamp,
  is_stale: z.boolean(),
  company_grade_label: optionalText,
  policy_summary_he: optionalText,
  policy_summary_en: optionalText,
  policy_url: z.string().nullable(),
});

export const gradeRow = z.object({
  grade: z.enum(GRADES),
  name_he: z.string(),
  name_en: z.string(),
  description_he: z.string(),
  description_en: z.string(),
});

export const companyRow = z.object({
  company_slug: companySlugSchema,
  name_he: z.string(),
  name_en: z.string(),
  logo_url: z.string().nullable(),
  website_url: z.string().nullable(),
  payout_methods: z.array(z.string()),
  payout_time_he: optionalText,
  payout_time_en: optionalText,
  delivery_methods: z.array(z.string()),
  offer_count: z.number().int().nonnegative(),
  last_updated_at: timestamp.nullable(),
});

export const policyRow = z.object({
  company_slug: companySlugSchema,
  grade: z.enum(GRADES),
  company_grade_label: optionalText,
  summary_he: optionalText,
  summary_en: optionalText,
  policy_url: z.string().nullable(),
});

export const searchRow = z.object({
  model_slug: modelSlugSchema,
  brand: brandSchema,
  display_name_he: z.string(),
  display_name_en: z.string(),
  top_price: price,
});

export type ModelRow = z.infer<typeof modelRow>;
export type OfferRow = z.infer<typeof offerRow>;
export type GradeRow = z.infer<typeof gradeRow>;
export type CompanyRow = z.infer<typeof companyRow>;
export type PolicyRow = z.infer<typeof policyRow>;
export type SearchRow = z.infer<typeof searchRow>;
export type BrandRow = z.infer<typeof brandRow>;

/** What the browser is allowed to see from search. No prices before the user confirms. */
export const searchHit = searchRow.pick({
  model_slug: true,
  brand: true,
  display_name_he: true,
  display_name_en: true,
});
export type SearchHit = z.infer<typeof searchHit>;
