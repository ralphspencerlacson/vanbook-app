"use client";
import { useState } from "react";
export function LandingQuoteForm() {
  const [type, setType] = useState("Day trip");
  const [notice, setNotice] = useState(false);
  return (
    <section
      className="landing-quote"
      id="get-quotes"
      aria-label="Plan your group trip"
    >
      <div className="landing-trip-tabs" aria-label="Trip type">
        {["Day trip", "Round trip", "Multi-day", "Airport", "Pilgrimage"].map(
          (label) => (
            <button
              key={label}
              type="button"
              aria-pressed={type === label}
              onClick={() => setType(label)}
            >
              {label}
            </button>
          ),
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(true);
        }}
      >
        <label>
          Pickup
          <input placeholder="City or landmark" />
        </label>
        <label>
          Destination
          <input placeholder="Where to?" />
        </label>
        <label>
          Date
          <input type="date" />
        </label>
        <label>
          Passengers
          <input type="number" min={1} max={30} placeholder="15" />
        </label>
        <button className="site-button is-yellow">Get quotes</button>
      </form>
      {notice && (
        <p role="status" className="landing-quote-notice">
          Trip requests are coming soon. Operator registration is available now.
        </p>
      )}
    </section>
  );
}
