import Link from "next/link";
import { LoginArrival } from "@/components/login-transition";
export default function NotFound() { return <main className="site-container operator-error"><LoginArrival /><h1>This operator page could not be found</h1><p>Use the portal navigation to open your requests, vans, or application.</p><Link href="/operator">Return to your operator portal</Link></main>; }
