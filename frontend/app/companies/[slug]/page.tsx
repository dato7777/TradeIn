import { redirect } from "next/navigation";

export default function LegacyCompanyRedirect({ params }: { params: { slug: string } }) {
  redirect(`/datadmin/companies/${params.slug}`);
}
