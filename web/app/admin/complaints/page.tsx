import { AdminSectionPage } from "@/components/admin-section-page";
export default function Page({ searchParams }: PageProps<"/admin/complaints">) {
  return <AdminSectionPage section="complaints" searchParams={searchParams} />;
}
