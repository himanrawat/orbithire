import CompanyDetailPageClient from "@/components/companies/CompanyDetailPageClient";

export default function CompanyDetailPage({ params }: Readonly<{ params: { companyId: string } }>) {
	return <CompanyDetailPageClient params={params} />;
}
