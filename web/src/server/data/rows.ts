import { z } from "zod";
import { BRANDS, GRADES } from "@/lib/catalog/params";

// Runtime contracts for the public_site RPCs (supabase/migrations/004_public_read_model.sql).
// Every response is parsed, so a schema drift fails loudly instead of rendering bad data.

const price = z.number().int().positive();
const timestamp = z.string().datetime({ offset: true });
const optionalText = z.string().nullable();
const httpsOrPath = z.string().regex(/^(https:\/\/|\/)\S*$/).nullable();

export const brandRow = z.object({
  brand: z.enum(BRANDS),
  model_count: z.number().int().nonnegative(),
  top_price: price,
});

export const modelRow = z.object({
  model_slug: z.string(),
  brand: z.enum(BRANDS),
  display_name_he: z.string(),
  display_name_en: z.string(),
  release_year: z.number().int().nullable(),
  image_url: httpsOrPath,
  top_price: price,
  min_price: price,
  company_count: z.number().int().positive(),
  storage_options: z.array(z.number().int().positive()),
  last_updated_at: timestamp,
});

export const offerRow = z.object({
  offer_ref: z.string().regex(/^[0-9a-f]{24}$/),
  company_slug: z.string(),
  company_name_he: z.string(),
  company_name_en: z.string(),
  logo_url: httpsOrPath,
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
  policy_url: z.string().regex(/^https:\/\/\S+$/).nullable(),
});

export const gradeRow = z.object({
  grade: z.enum(GRADES),
  name_he: z.string(),
  name_en: z.string(),
  description_he: z.string(),
  description_en: z.string(),
});

export const companyRow = z.object({
  company_slug: z.string(),
  name_he: z.string(),
  name_en: z.string(),
  logo_url: httpsOrPath,
  website_url: z.string().regex(/^https:\/\/\S+$/).nullable(),
  payout_methods: z.array(z.string()),
  payout_time_he: optionalText,
  payout_time_en: optionalText,
  delivery_methods: z.array(z.string()),
  offer_count: z.number().int().nonnegative(),
  last_updated_at: timestamp.nullable(),
});

export const policyRow = z.object({
  company_slug: z.string(),
  grade: z.enum(GRADES),
  company_grade_label: optionalText,
  summary_he: optionalText,
  summary_en: optionalText,
  policy_url: z.string().regex(/^https:\/\/\S+$/).nullable(),
});

export const searchRow = z.object({
  model_slug: z.string(),
  brand: z.enum(BRANDS),
  display_name_he: z.string(),
  display_name_en: z.string(),
  top_price: price,
});

export type BrandRow = z.infer<typeof brandRow>;
export type ModelRow = z.infer<typeof modelRow>;
export type OfferRow = z.infer<typeof offerRow>;
export type GradeRow = z.infer<typeof gradeRow>;
export type CompanyRow = z.infer<typeof companyRow>;
export type PolicyRow = z.infer<typeof policyRow>;
export type SearchRow = z.infer<typeof searchRow>;
