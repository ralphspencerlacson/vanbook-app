import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getOperator } from "@/lib/operators/portal";
import { OperatorWorkspace } from "@/components/operator-workspace";
import { LoginArrival } from "@/components/login-transition";
const sections = {
  requests: ["Requests", "New trip requests will appear here."],
  quoted: ["Quoted", "Your submitted quotes will appear here."],
  booked: ["Booked", "Confirmed bookings will appear here."],
  calendar: ["Calendar", "Your trip schedule will appear here."],
  earnings: ["Earnings", "Your earnings and payouts will appear here."],
};
async function Content({ params }: PageProps<"/operator/[section]">) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  const actor = await getOperator();
  const [title, description] = sections[section as keyof typeof sections];
  return (
    <OperatorWorkspace
      title={title}
      approved={actor.application.status === "approved"}
    >
      <LoginArrival />
      <section className="operator-empty">
        <span aria-hidden="true">◇</span>
        <h2>No {title.toLowerCase()} yet</h2>
        <p>{description}</p>
        <small>This section will be connected in a later phase.</small>
      </section>
    </OperatorWorkspace>
  );
}
export default function Page(props: PageProps<"/operator/[section]">) {
  return (
    <Suspense
      fallback={
        <p className="operator-loading" role="status">
          Loading section…
        </p>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
