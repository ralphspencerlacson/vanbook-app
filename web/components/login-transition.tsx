"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { VanLoadingScreen } from "./van-loading-screen";

type LoginJourney = { destination: string; source?: DOMRect };
const LoginTransitionContext = createContext({
  enter: (destination: string) => {
    window.location.assign(destination);
  },
  arrived: () => {},
});

export function LoginTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [journey, setJourney] = useState<LoginJourney | null>(null);
  const enter = useCallback((destination: string) => {
    const source = document
      .querySelector(".auth-promo .welcome-hero")
      ?.getBoundingClientRect();
    setJourney({ destination, source });
  }, []);
  const arrived = useCallback(() => setJourney(null), []);

  return (
    <LoginTransitionContext.Provider value={{ enter, arrived }}>
      <div className="app-content" data-entering={!!journey} inert={!!journey}>
        {children}
      </div>
      {journey && (
        <LoginJourneyOverlay
          journey={journey}
          navigate={() => router.replace(journey.destination)}
        />
      )}
    </LoginTransitionContext.Provider>
  );
}

function LoginJourneyOverlay({
  journey,
  navigate,
}: {
  journey: LoginJourney;
  navigate: () => void;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  // Keep the animation independent of provider rerenders during streamed navigation.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    const scene = overlay.current?.querySelector<HTMLElement>(
      ".van-loading-scene",
    );
    if (!scene) return;
    const target = scene.getBoundingClientRect();
    const source = journey.source ?? target;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = scene.animate(
      [
        {
          transform: `translate(${source.x - target.x}px, ${source.y - target.y}px) scale(${source.width / target.width}, ${source.height / target.height})`,
        },
        { transform: "translate(0, 0) scale(1, 1)" },
      ],
      {
        duration: reduced ? 0 : 450,
        easing: "cubic-bezier(.22, 1, .36, 1)",
        fill: "both",
      },
    );
    let active = true;
    animation.finished
      .then(() => {
        if (active) navigateRef.current();
      })
      .catch(() => {});
    return () => {
      active = false;
      animation.cancel();
    };
  }, [journey]);
  return (
    <div ref={overlay} className="login-transition">
      <VanLoadingScreen label="Taking you to your dashboard" />
    </div>
  );
}

export function useLoginTransition() {
  return useContext(LoginTransitionContext);
}

// Mounted only once authenticated page content is ready, never by a loading fallback.
export function LoginArrival() {
  const { arrived } = useLoginTransition();
  useEffect(() => {
    arrived();
  }, [arrived]);
  return null;
}
