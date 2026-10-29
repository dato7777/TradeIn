import { productionDeps } from "@/lib/alerts/wiring";
import { handleOneClick } from "@/lib/alerts/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function respond(request: Request) {
  try {
    return await handleOneClick(request, productionDeps());
  } catch {
    return new Response(null, { status: 200 });
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export function POST(request: Request) {
  return respond(request);
}
