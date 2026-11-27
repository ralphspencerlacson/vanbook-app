import Link from "next/link";
import { LoginArrival } from "@/components/login-transition";

export default function AdminNotFound() {
  return (
    <section className="workspace-panel">
      <LoginArrival />
      <h1 className="workspace-section-title">This record could not be found</h1>
      <p>It may have been removed or the link may be incorrect.</p>
      <Link href="/admin" className="workspace-link">Return to verification</Link>
    </section>
  );
}
