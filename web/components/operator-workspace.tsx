import Link from "next/link";
import { OperatorNavigation } from "./operator-navigation";
export function OperatorWorkspace({
  title,
  children,
  approved,
  toolbar,
}: {
  title: string;
  children: React.ReactNode;
  approved: boolean;
  toolbar?: React.ReactNode;
}) {
  return (
    <div className="site-container operator-workspace">
      <OperatorNavigation />
      <div className="operator-workspace-content">
        <header className="operator-workspace-heading">
          <h1>{title}</h1>
          {toolbar}
        </header>
        {!approved && (
          <p className="operator-pending-banner">
            Your application is still being reviewed. Your vans cannot receive
            requests until approval.{" "}
            <Link href="/operator">View application status</Link>
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
