import { AdminSectionPage } from "@/components/admin-section-page";
export default function Page({ searchParams }: PageProps<"/admin/reports">) {
  return <AdminSectionPage section="reports" searchParams={searchParams} />;
}
