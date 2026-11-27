import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { VanIllustration } from "@/components/van-illustration";
import { LandingQuoteForm } from "@/components/landing-quote-form";
export default function Home() {
  return (
    <PublicShell>
      <main>
        <section className="landing-hero">
          <div className="site-container landing-hero-grid">
            <div>
              <span className="site-eyebrow">FRANCHISED OPERATORS ONLY</span>
              <h1>Legal, verified vans for group trips</h1>
              <p>
                Tell us where your group is going. Find the right van and travel
                together with confidence.
              </p>
              <div className="landing-trust">
                <span>✓ Verified operators</span>
                <span>✓ Group travel</span>
                <span>✓ Across the Philippines</span>
              </div>
            </div>
            <div className="landing-hero-art">
              <VanIllustration animated />
            </div>
          </div>
        </section>
        <div className="site-container landing-content">
          <LandingQuoteForm />
          <section className="landing-benefits" aria-label="Why VANBOOK">
            {[
              [
                "Franchised and insured",
                "Operator credentials and documents are reviewed before approval.",
              ],
              [
                "One trip, one group",
                "Keep everyone together, from pickup to your last stop.",
              ],
              [
                "Clear trip details",
                "Plan your route, passenger count, and travel dates in one place.",
              ],
              [
                "People behind your trip",
                "A better way for groups and verified operators to connect.",
              ],
            ].map(([title, text]) => (
              <article key={title}>
                <h2>{title}</h2>
                <p>{text}</p>
              </article>
            ))}
          </section>
          <section className="landing-section" id="popular-routes">
            <div className="landing-section-heading">
              <h2>Popular routes</h2>
              <p>A little inspiration for your next trip together.</p>
            </div>
            <div className="landing-route-grid">
              {[
                ["Manila → Tagaytay", "Day trips · City escapes", "tagaytay"],
                [
                  "NAIA airport transfer",
                  "Airport pickup · Group transfers",
                  "airport",
                ],
                [
                  "Manila → Batangas beaches",
                  "Beach days · Weekend trips",
                  "beach",
                ],
                [
                  "Visita Iglesia loop",
                  "Church visits · Family journeys",
                  "church",
                ],
              ].map(([title, text, theme]) => (
                <article className="landing-route" key={title}>
                  <div
                    className={`landing-route-art route-${theme}`}
                    aria-hidden="true"
                  >
                    <span>☀</span>
                    <div />
                    <div />
                  </div>
                  <div className="landing-route-copy">
                    <h3>{title}</h3>
                    <p>{text}</p>
                    <Link href="#get-quotes">
                      Plan this trip <span aria-hidden="true">↗</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="landing-section" id="how-it-works">
            <h2>How it works</h2>
            <div className="landing-how-grid">
              {[
                [
                  "1",
                  "Tell us your plan",
                  "Choose your stops, travel dates, and how many people are coming.",
                ],
                [
                  "2",
                  "Connect with operators",
                  "Find verified transport businesses for your group’s journey.",
                ],
                [
                  "3",
                  "Travel with confidence",
                  "Keep your group together and make the most of the trip.",
                ],
              ].map(([number, title, text]) => (
                <article key={number}>
                  <span>{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="landing-callouts" id="corporate">
            <article>
              <span className="site-small-label">FOR YOUR NEXT JOURNEY</span>
              <h2>Build your group’s perfect route</h2>
              <p>
                Family outings, church visits, and a weekend away. Start with a
                plan that fits your group.
              </p>
              <Link className="site-button is-yellow" href="#get-quotes">
                Plan the route
              </Link>
            </article>
            <article>
              <span className="site-small-label">
                COMPANIES, SCHOOLS AND GROUPS
              </span>
              <h2>Bring the whole team along</h2>
              <p>
                From company trips to school outings, plan group transport
                together.
              </p>
              <Link className="site-button" href="/register">
                Explore group travel
              </Link>
            </article>
          </section>
          <section className="landing-operator-cta">
            <div>
              <h2>Own franchised vans? Join VANBOOK.</h2>
              <p>Register your business and vehicles for verification.</p>
            </div>
            <div>
              <Link className="site-button is-yellow" href="/register/operator">
                Register your vans
              </Link>
              <Link
                className="site-outline-button"
                href="/sign-in?next=%2Foperator"
              >
                Operator log in
              </Link>
            </div>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
