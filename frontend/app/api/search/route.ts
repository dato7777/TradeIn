import { NextResponse } from "next/server";
import { searchModels } from "@/lib/public/catalog";
import { allowSearch } from "@/lib/public/rateLimit";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowSearch(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchModels(query);
  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
