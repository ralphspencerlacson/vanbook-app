import { BrandMark } from "./brand-mark";
import { VanIllustration } from "./van-illustration";

export function VanLoadingScreen({
  label = "Getting your workspace ready",
}: {
  label?: string;
}) {
  return (
    <div
      className="van-loading-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="van-loading-content">
        <BrandMark />
        <div className="van-loading-scene" aria-hidden="true">
          <VanIllustration animated />
        </div>
        <div className="van-loading-copy">
          <h1>{label}</h1>
          <p>
            Just a moment. We&apos;re getting things ready for your journey.
          </p>
        </div>
        <div className="van-loading-track" aria-hidden="true">
          <span />
        </div>
        <span className="sr-only">Loading, please wait.</span>
      </div>
    </div>
  );
}
