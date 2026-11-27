import type { ReactNode } from "react";

function Fields({ count }: { count: number }) {
  return (
    <div className="operator-form-grid registration-skeleton-fields">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <span className="skeleton-block registration-skeleton-label" />
          <span className="skeleton-block registration-skeleton-input" />
        </div>
      ))}
    </div>
  );
}

export function OperatorRegistrationLoading({ heading }: { heading: ReactNode }) {
  return (
    <div className="operator-registration-layout registration-skeleton" aria-busy="true">
      <p className="sr-only" role="status">Loading your operator registration form…</p>
      {heading}
      <div className="operator-registration-main">
        <div className="operator-panel" aria-hidden="true">
          <h2>1 · Business details</h2>
          <Fields count={6} />
          <div className="registration-skeleton-service-areas">
            <span className="skeleton-block registration-skeleton-label" />
            <span className="skeleton-block registration-skeleton-input" />
            <div className="registration-skeleton-chips">
              {Array.from({ length: 8 }, (_, index) => (
                <span className="skeleton-block" key={index} />
              ))}
            </div>
          </div>
          <div className="operator-account-heading">
            <h3>Your operator account</h3>
            <span className="skeleton-block registration-skeleton-description" />
          </div>
          <Fields count={3} />
        </div>
        <div className="operator-panel" aria-hidden="true">
          <h2>2 · Documents</h2>
          <span className="skeleton-block registration-skeleton-progress" />
          {Array.from({ length: 6 }, (_, index) => (
            <div className="operator-registration-document" key={index}>
              <span className="skeleton-block registration-skeleton-document-name" />
              <span className="skeleton-block registration-skeleton-badge" />
              <span className="skeleton-block registration-skeleton-button" />
            </div>
          ))}
        </div>
        <div className="operator-panel" aria-hidden="true">
          <h2>3 · Vehicles</h2>
          <Fields count={6} />
          <div className="operator-photo-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <span className="skeleton-block registration-skeleton-photo" key={index} />
            ))}
          </div>
          <div className="registration-skeleton-chips">
            {Array.from({ length: 5 }, (_, index) => (
              <span className="skeleton-block" key={index} />
            ))}
          </div>
        </div>
        <div className="operator-panel" aria-hidden="true">
          <h2>4 · Agreement</h2>
          <span className="skeleton-block registration-skeleton-agreement" />
          <span className="skeleton-block registration-skeleton-agreement" />
          <span className="skeleton-block registration-skeleton-submit" />
        </div>
      </div>
      <aside className="operator-checklist" aria-hidden="true">
        <h2>Your checklist</h2>
        <ul>
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index}>
              <span className="operator-checklist-indicator" />
              <span className="skeleton-block registration-skeleton-checklist-line" />
            </li>
          ))}
        </ul>
        <span className="skeleton-block registration-skeleton-checklist-note" />
      </aside>
    </div>
  );
}
