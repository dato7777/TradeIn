import { AlertTokenPage, alertMetadata } from "@/components/public/AlertTokenPage";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  return alertMetadata("en", "confirm");
}

export default function Page({ searchParams }: { searchParams: { token?: string | string[] } }) {
  return <AlertTokenPage locale="en" purpose="confirm" token={searchParams.token} />;
}
