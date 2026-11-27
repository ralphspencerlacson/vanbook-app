"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { loadAccountProfile, saveOperatorProfile } from "@/app/account/actions";
import type { AccountProfile, AccountProfileResult } from "@/lib/auth/account-profile";

const roleNames = {
  super_admin: "Super administrator", admin: "Administrator", operator: "Operator",
  customer: "Customer", agent: "Support agent",
};

function ProfileIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>;
}

export function AccountProfileButton({ variant, label }: { variant: "admin" | "operator"; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={variant === "admin" ? "admin-profile" : "operator-account-trigger"}
        aria-label="Manage your account" title="Manage your account" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {variant === "admin" ? (
          <><span className="admin-avatar">VB</span><span>Administrator<small>Manage your account</small></span></>
        ) : <><ProfileIcon /><span className="operator-account-label">{label || "My account"}</span></>}
      </button>
      {open && createPortal(<AccountProfileModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function AccountProfileModal({ onClose }: { onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AccountProfile>();
  const [fields, setFields] = useState({ name: "", phone: "", contactEmail: "" });
  const [result, setResult] = useState<AccountProfileResult>();
  const [pending, setPending] = useState(false);

  function applyProfile(value: AccountProfile) {
    setProfile(value);
    setFields({ name: value.name, phone: value.phone ?? "", contactEmail: value.contactEmail ?? "" });
  }
  useEffect(() => {
    const modal = dialog.current!;
    if (!modal.open) modal.showModal();
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let active = true;
    loadAccountProfile().then((response) => {
      if (!active) return;
      if (response.profile) applyProfile(response.profile);
      else setResult(response);
    }).catch(() => {
      if (active) setResult({ message: "We couldn't load your account. Close this window and try again." });
    }).finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setResult(undefined);
    try {
      const response = await saveOperatorProfile(new FormData(event.currentTarget));
      if (response.profile) applyProfile(response.profile);
      setResult(response);
    } catch {
      setResult({ message: "We couldn't save your changes. Your entries are still here. Please try again." });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <dialog ref={dialog} className="account-modal" aria-labelledby={`${id}-title`} onClose={onClose}
      onCancel={(event) => { if (busy.current) event.preventDefault(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
          event.currentTarget.close();
      }}>
      <header className="account-modal-heading">
        <span className="account-modal-avatar"><ProfileIcon /></span>
        <div><h2 id={`${id}-title`}>My account</h2><p>{profile?.role === "operator" ? "Manage your personal contact details." : "Your account details."}</p></div>
        <button ref={closeButton} type="button" aria-label="Close account details" className="account-modal-close" disabled={pending} onClick={() => dialog.current?.close()}>×</button>
      </header>
      <div className="account-modal-content" aria-busy={loading || pending}>
        {loading ? <div role="status"><span className="sr-only">Loading account details…</span><div aria-hidden="true" className="account-modal-skeleton">{[0, 1, 2].map((value) => <span key={value} className="skeleton-block" />)}</div></div> : profile && (
          <>
            <div className="account-modal-summary"><span>{roleNames[profile.role]}</span><span>{profile.confirmed ? "Email verified" : "Email unconfirmed"}</span></div>
            <dl className="account-modal-details">
              {profile.role !== "operator" && <div><dt>Name</dt><dd>{profile.name || "Not provided"}</dd></div>}
              <div><dt>Sign-in email</dt><dd>{profile.email}</dd></div>
              <div><dt>Account created</dt><dd>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(profile.joinedAt))}</dd></div>
            </dl>
            {profile.role === "operator" && (
              <form onSubmit={submit} aria-busy={pending}>
                <input type="hidden" name="version" value={profile.version ?? ""} />
                {([
                  ["name", "Full name", "text", 150, "name"],
                  ["phone", "Mobile number", "tel", 30, "tel"],
                  ["contactEmail", "Contact email", "email", 254, "email"],
                ] as const).map(([key, label, type, maxLength, autoComplete]) => (
                  <div key={key}>
                    <label htmlFor={`${id}-${key}`}>{label}</label>
                    <input id={`${id}-${key}`} name={key} type={type} maxLength={maxLength} autoComplete={autoComplete} required
                      value={fields[key]} disabled={pending} onChange={(event) => setFields((value) => ({ ...value, [key]: event.target.value }))}
                      aria-invalid={!!result?.errors?.[key]} aria-describedby={result?.errors?.[key] ? `${id}-${key}-error` : undefined} />
                    {result?.errors?.[key] && <p className="account-modal-error" id={`${id}-${key}-error`}>{result.errors[key]}</p>}
                  </div>
                ))}
                <p className="account-modal-help">Contact email is used for business correspondence. Your sign-in email stays the same.</p>
                <button className="account-modal-save" type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
              </form>
            )}
          </>
        )}
        {result?.message && <p className={result.success ? "account-modal-success" : "account-modal-error"} role={result.success ? "status" : "alert"}>{result.message}</p>}
      </div>
    </dialog>
  );
}
