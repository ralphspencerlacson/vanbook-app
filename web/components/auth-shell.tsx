import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { VanIllustration } from "./van-illustration";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-promo" aria-label="Welcome to VANBOOK PH">
          <BrandMark />
          <VanIllustration animated />
          <h2>Legal, verified vans for group trips</h2>
          <p>
            Find the right van for your group. Travel together with confidence.
          </p>
        </section>
        <div className="auth-form-area">
          {children}
          <footer className="auth-footer">
            <Link href="/register/operator">
              Van operator? Create your account
            </Link>
            <p>One account for your next journey.</p>
          </footer>
        </div>
      </div>
    </main>
  );
}

export function AuthCardContent({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <h1 id="auth-title">{title}</h1>
      <p className="auth-form-description">{description}</p>
      {children}
    </>
  );
}

export function AuthShell(props: Parameters<typeof AuthCardContent>[0]) {
  return (
    <AuthFrame>
      <section className="auth-form-card" aria-labelledby="auth-title">
        <AuthCardContent {...props} />
      </section>
    </AuthFrame>
  );
}
