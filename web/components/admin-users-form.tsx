"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { inviteAdministrator } from "@/app/admin/users/actions";

export function AdminUsersForm() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    success?: boolean;
  }>();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      emailInput.current?.focus();
    }
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const form = event.currentTarget;
    setPending(true);
    setResult(undefined);
    try {
      const response = await inviteAdministrator(new FormData(form));
      setResult(response);
      if (response.success) form.reset();
    } catch {
      setResult({
        message:
          "We couldn't send the invitation. Your entry is still here. Try again.",
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <button
        className="requirements-button"
        onClick={() => {
          setResult(undefined);
          setOpen(true);
        }}
      >
        ＋ Add administrator
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="requirements-editor-panel users-invite-drawer"
          aria-labelledby="admin-invite-title"
          onClose={() => setOpen(false)}
          onCancel={(event) => {
            if (busy.current) event.preventDefault();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy.current)
              setOpen(false);
          }}
        >
          <div className="requirements-drawer-content">
            <header>
              <button
                className="requirements-drawer-close"
                aria-label="Close administrator invitation"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
              <span className="requirements-eyebrow">STAFF ACCOUNTS</span>
              <h2 id="admin-invite-title">Add an administrator</h2>
              <p>
                Send an invitation to verify their email and set a password.
              </p>
            </header>
            <form onSubmit={submit} aria-busy={pending}>
              <p className="requirements-notice">
                Administrators can manage all operators and vehicles. Only the
                super admin can add administrators. Agent access is reserved for
                a later phase.
              </p>
              <div>
                <label htmlFor="admin-email" className="field-label">
                  Administrator email
                </label>
                <input
                  ref={emailInput}
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  className="field-input"
                  disabled={pending}
                />
              </div>
              {result && (
                <p
                  role={result.success ? "status" : "alert"}
                  className={
                    result.success
                      ? "requirements-success"
                      : "requirements-error"
                  }
                >
                  {result.message}
                </p>
              )}
              <div className="requirements-editor-actions">
                <button
                  type="button"
                  className="requirements-button is-secondary"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="requirements-button"
                  disabled={pending}
                >
                  {pending ? "Sending…" : "Send admin invitation"}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}
    </>
  );
}
