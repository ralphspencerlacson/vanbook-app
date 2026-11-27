import Link from "next/link";
import { getActor } from "@/lib/operators/server";
import { homeFor, isAdminRole } from "@/lib/auth/access";

export async function OperatorJoinActions() {
  const actor = await getActor();
  if (actor.user) {
    if (!actor.ready || !actor.access)
      return <Link className="site-outline-button" href="/account">Check your account</Link>;
    if (actor.access.role === "operator")
      return <Link className="site-button is-yellow" href={homeFor(actor.access)}>Go to operator dashboard</Link>;
    if (isAdminRole(actor.access))
      return <Link className="site-button is-yellow" href="/admin">Review operator applications</Link>;
    return (
      <p className="landing-operator-account-note">
        Operator registration uses a separate business account.
      </p>
    );
  }
  return (
    <>
      <Link className="site-button is-yellow" href="/register/operator">Register your vans</Link>
      <Link className="site-outline-button" href="/sign-in?next=%2Foperator">Already registered? Log in</Link>
    </>
  );
}
