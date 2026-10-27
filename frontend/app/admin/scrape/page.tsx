import { redirect } from "next/navigation";

export default function LegacyScrapeRedirect() {
  redirect("/datadmin/scrape");
}
