// Shape of the exposed `public_site` schema (supabase/migrations/004_public_read_model.sql),
// in the format produced by `supabase gen types`. Results are typed `unknown` on purpose:
// every response is validated at runtime by the Zod contracts in src/server/data/rows.ts.

type NoArgs = Record<PropertyKey, never>;

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public_site: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      list_brands: { Args: NoArgs; Returns: unknown };
      list_models: { Args: { p_brand: string; p_limit?: number; p_offset?: number }; Returns: unknown };
      get_model: { Args: { p_model_slug: string }; Returns: unknown };
      offers_for: {
        Args: { p_model_slug: string; p_storage_gb: number; p_grade: string };
        Returns: unknown;
      };
      list_condition_grades: { Args: NoArgs; Returns: unknown };
      list_companies: { Args: NoArgs; Returns: unknown };
      list_condition_policies: { Args: NoArgs; Returns: unknown };
      search_models: { Args: { p_query: string }; Returns: unknown };
    };
  };
};

export type PublicSiteFunctions = Database["public_site"]["Functions"];
export type PublicSiteFunction = keyof PublicSiteFunctions;
