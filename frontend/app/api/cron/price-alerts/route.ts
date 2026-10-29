import { productionDeps } from "@/lib/alerts/wiring";
import { handleCron } from "@/lib/alerts/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: Request) {
  try {
    return await handleCron(request, productionDeps());
  } catch {
    return new Response(null, { status: 401 });
  }
}
