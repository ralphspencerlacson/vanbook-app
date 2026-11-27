"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

// The shared layout keeps this card and the van mounted across both routes.
export function AuthAccessCard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = viewport.current!;
    const inner = content.current!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let previous = inner.getBoundingClientRect();
    let resize: Animation | undefined;

    const stop = () => resize?.cancel();
    motion.addEventListener("change", stop);
    const observer = new ResizeObserver(() => {
      const next = inner.getBoundingClientRect();
      const from = resize
        ? container.getBoundingClientRect().height
        : previous.height;
      const widthChanged = Math.abs(next.width - previous.width) > 1;
      const heightChanged = Math.abs(next.height - previous.height) > 0.5;
      previous = next;
      if (!heightChanged && !widthChanged) return;
      stop();
      resize = undefined;
      // Keep viewport resizing and text zoom immediate and fully accessible.
      if (motion.matches || widthChanged || !heightChanged) return;
      const animation = container.animate(
        [{ height: `${from}px` }, { height: `${next.height}px` }],
        { duration: 320, easing: "cubic-bezier(.22, 1, .36, 1)" },
      );
      resize = animation;
      void animation.finished
        .then(() => {
          if (resize === animation) resize = undefined;
        })
        .catch(() => {});
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", stop);
      stop();
    };
  }, []);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = panel.current?.animate(
      [
        { opacity: 0.35, transform: "translateY(5px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 240, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [pathname]);

  return (
    <section className="auth-form-card" aria-labelledby="auth-title">
      <div ref={viewport} className="auth-card-viewport">
        <div ref={content} className="auth-card-content">
          <nav className="auth-mode-tabs" aria-label="Account access">
            <Link
              href="/sign-in"
              scroll={false}
              aria-current={pathname === "/sign-in" ? "page" : undefined}
            >
              Log in
            </Link>
            <Link
              href="/register"
              scroll={false}
              aria-current={pathname === "/register" ? "page" : undefined}
            >
              Sign up
            </Link>
          </nav>
          <div ref={panel} className="auth-form-panel">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
