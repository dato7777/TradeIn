import { productionDeps } from "@/lib/alerts/wiring";
import { handleEmailWebhook } from "@/lib/alerts/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await handleEmailWebhook(request, productionDeps());
  } catch {
    return new Response(null, { status: 401 });
  }
}
