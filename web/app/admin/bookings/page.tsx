import { AdminSectionPage } from "@/components/admin-section-page";
export default function Page({ searchParams }: PageProps<"/admin/bookings">) {
  return <AdminSectionPage section="bookings" searchParams={searchParams} />;
}
