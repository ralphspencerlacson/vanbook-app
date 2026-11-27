import { AdminSectionPage } from "@/components/admin-section-page";
export default function Page({ searchParams }: PageProps<"/admin/fees">) {
  return <AdminSectionPage section="fees" searchParams={searchParams} />;
}
