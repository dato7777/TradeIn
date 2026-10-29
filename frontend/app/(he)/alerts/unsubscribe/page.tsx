import { AlertTokenPage, alertMetadata } from "@/components/public/AlertTokenPage";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  return alertMetadata("he", "manage");
}

export default function Page({ searchParams }: { searchParams: { token?: string | string[] } }) {
  return <AlertTokenPage locale="he" purpose="manage" token={searchParams.token} />;
}
