import { AlertTokenPage, alertMetadata } from "@/components/public/AlertTokenPage";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  return alertMetadata("he", "confirm");
}

export default function Page({ searchParams }: { searchParams: { token?: string | string[] } }) {
  return <AlertTokenPage locale="he" purpose="confirm" token={searchParams.token} />;
}
