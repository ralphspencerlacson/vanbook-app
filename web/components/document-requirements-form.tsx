"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveRequirement } from "@/app/admin/actions";
import type { DocumentRequirement } from "@/lib/operators/types";

function RequirementEditor({
  requirement,
  nextOrder,
  onClose,
  onSaved,
}: {
  requirement?: DocumentRequirement;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const creationCode = useRef("");
  const labelInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const fieldId = useId();
  useEffect(() => {
    dialog.current?.showModal();
    labelInput.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const data = new FormData(event.currentTarget);
    if (!requirement) {
      creationCode.current ||= `document_${crypto.randomUUID().replaceAll("-", "")}`;
      data.set("code", creationCode.current);
    }
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await saveRequirement(data);
      if (result.success) onSaved();
      else setMessage(result.message ?? "We couldn't save this requirement.");
    } catch {
      setMessage(
        "We couldn't save this requirement. Your changes are still here. Please try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="requirements-editor-panel"
      aria-labelledby={`${fieldId}-title`}
      onClose={onClose}
      onCancel={(event) => {
        if (busy.current) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy.current) onClose();
      }}
    >
      <div className="requirements-drawer-content">
        <header>
          <button
            type="button"
            className="requirements-drawer-close"
            aria-label="Close requirement editor"
            disabled={pending}
            onClick={onClose}
          >
            ×
          </button>
          <span className="requirements-eyebrow">CHECKLIST SETTINGS</span>
          <h2 id={`${fieldId}-title`}>
            {requirement ? "Edit requirement" : "Add requirement"}
          </h2>
          <p>Define what operators see when they upload their documents.</p>
        </header>
        <form onSubmit={submit} aria-busy={pending}>
          <input type="hidden" name="code" value={requirement?.code ?? ""} />
          <div>
            <label className="field-label" htmlFor={`${fieldId}-label`}>
              Document name
            </label>
            <input
              ref={labelInput}
              id={`${fieldId}-label`}
              name="label"
              className="field-input"
              defaultValue={requirement?.label ?? ""}
              placeholder="e.g. Insurance (CTPL + passenger)"
              required
              maxLength={150}
              disabled={pending}
            />
          </div>
          <fieldset className="requirement-scope-field" disabled={pending}>
            <legend className="field-label">Applies to</legend>
            <div className="requirement-scope-options">
              {[
                {
                  value: "user",
                  label: "Per user",
                  description: "Upload once for the operator account.",
                },
                {
                  value: "van",
                  label: "Per van",
                  description: "Upload separately for every vehicle.",
                },
              ].map((option) => (
                <label key={option.value} className="requirement-scope-option">
                  <input
                    type="radio"
                    name="scope"
                    value={option.value}
                    aria-label={option.label}
                    aria-describedby={`${fieldId}-scope-${option.value}-help`}
                    defaultChecked={
                      (requirement?.scope ?? "user") === option.value
                    }
                    required
                  />
                  <span className="requirement-scope-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {option.value === "user" ? (
                        <>
                          <circle cx="12" cy="8" r="3.5" />
                          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                        </>
                      ) : (
                        <>
                          <path d="M3 17V7a2 2 0 0 1 2-2h12l4 6v6h-2m-12 0h8M3 17h1M3 11h18M10 5v6M17 5v6" />
                          <circle cx="6" cy="17" r="2" />
                          <circle cx="17" cy="17" r="2" />
                        </>
                      )}
                    </svg>
                  </span>
                  <strong>{option.label}</strong>
                  <small id={`${fieldId}-scope-${option.value}-help`}>
                    {option.description}
                  </small>
                </label>
              ))}
            </div>
            <p className="requirements-field-help">
              Existing uploads are not reassigned when this changes.
            </p>
          </fieldset>
          <div>
            <label className="field-label" htmlFor={`${fieldId}-description`}>
              Upload instructions <span>(optional)</span>
            </label>
            <textarea
              id={`${fieldId}-description`}
              name="description"
              className="field-input"
              defaultValue={requirement?.description ?? ""}
              placeholder="Explain what the document should include."
              rows={3}
              maxLength={1000}
              disabled={pending}
            />
            <p className="requirements-field-help">
              Shown beside this document during registration. Up to 1,000
              characters.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor={`${fieldId}-required`}>
              Submission rule
            </label>
            <select
              id={`${fieldId}-required`}
              name="required"
              className="field-input"
              defaultValue={String(requirement?.required ?? false)}
              disabled={pending}
            >
              <option value="true">Required</option>
              <option value="false">Optional</option>
            </select>
            <p className="requirements-field-help">
              Required documents must be uploaded before registration can be
              submitted.
            </p>
          </div>
          <div className="requirements-editor-pair">
            <div>
              <label className="field-label" htmlFor={`${fieldId}-active`}>
                Visibility
              </label>
              <select
                id={`${fieldId}-active`}
                name="active"
                className="field-input"
                defaultValue={String(requirement?.active ?? true)}
                disabled={pending}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor={`${fieldId}-order`}>
                Display order
              </label>
              <input
                id={`${fieldId}-order`}
                name="sort_order"
                type="number"
                className="field-input"
                defaultValue={requirement?.sort_order ?? nextOrder}
                min={0}
                max={9999}
                step={1}
                required
                disabled={pending}
              />
            </div>
          </div>
          <p className="requirements-field-help">
            Lower numbers appear first. Inactive items are hidden from new
            registrations; existing files are kept.
          </p>
          {message && (
            <p role="alert" className="requirements-error">
              {message}
            </p>
          )}
          <div className="requirements-editor-actions">
            <button
              type="button"
              className="requirements-button is-secondary"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="requirements-button"
              disabled={pending}
            >
              {pending
                ? "Saving…"
                : requirement
                  ? "Save changes"
                  : "Add requirement"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

export function DocumentRequirementsForm({
  requirements,
}: {
  requirements: DocumentRequirement[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [rule, setRule] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [scope, setScope] = useState("all");
  const [sort, setSort] = useState("order");
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const lastTrigger = useRef<HTMLElement>(null);
  const active = requirements.filter((item) => item.active);
  const rows = requirements
    .filter((item) => {
      const matches = `${item.label} ${item.description}`
        .toLowerCase()
        .includes(search.toLowerCase().trim());
      return (
        matches &&
        (scope === "all" || item.scope === scope) &&
        (rule === "all" || item.required === (rule === "required")) &&
        (visibility === "all" || item.active === (visibility === "active"))
      );
    })
    .sort((a, b) => {
      const comparison =
        sort === "name"
          ? a.label.localeCompare(b.label)
          : sort === "name_desc"
            ? b.label.localeCompare(a.label)
            : sort === "scope_user"
              ? a.scope.localeCompare(b.scope)
              : sort === "scope_van"
                ? b.scope.localeCompare(a.scope)
                : sort === "order_desc"
                  ? b.sort_order - a.sort_order
                  : a.sort_order - b.sort_order;
      return (
        comparison ||
        a.sort_order - b.sort_order ||
        a.label.localeCompare(b.label) ||
        a.code.localeCompare(b.code)
      );
    });
  const filtered =
    !!search ||
    scope !== "all" ||
    rule !== "all" ||
    visibility !== "all" ||
    sort !== "order";
  const selected = requirements.find((item) => item.code === editing);
  const close = () => {
    setEditing(null);
    lastTrigger.current?.focus();
  };
  const open = (code: string, button: HTMLElement) => {
    lastTrigger.current = button;
    setMessage("");
    setEditing(code);
  };

  return (
    <div className="requirements-manager">
      <div className="admin-metrics requirements-metrics">
        {[
          [
            "All requirements",
            requirements.length,
            "Documents in your checklist",
          ],
          [
            "Required",
            active.filter((item) => item.required).length,
            "Must be uploaded to submit",
          ],
          [
            "Optional",
            active.filter((item) => !item.required).length,
            "Operators may skip these",
          ],
          [
            "Inactive",
            requirements.length - active.length,
            "Hidden from registration",
          ],
        ].map(([label, count, detail]) => (
          <div className="admin-metric" key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
            <small>{detail}</small>
          </div>
        ))}
      </div>
      <p className="requirements-notice">
        Only active requirements appear during operator registration. Changes
        apply to future submissions; previously uploaded files are kept.
      </p>
      {message && (
        <p role="status" className="requirements-success">
          {message}
        </p>
      )}
      <div className="requirements-layout">
        <section
          className="requirements-list"
          aria-labelledby="requirements-list-title"
        >
          <header className="requirements-list-heading">
            <div>
              <h2 id="requirements-list-title">
                Document requirements ({rows.length})
              </h2>
              <p>Manage the documents operators need to provide.</p>
            </div>
            <button
              className="requirements-button"
              onClick={(event) => open("new", event.currentTarget)}
            >
              <span aria-hidden="true">＋</span> Add requirement
            </button>
          </header>
          <div className="requirements-filters requirements-expanded-filters">
            <label className="requirements-search">
              <span className="sr-only">Search requirements</span>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" />
              </svg>
              <input
                type="search"
                placeholder="Search documents…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              <span className="filter-control-label">Applies to</span>
              <select
                aria-label="Filter by document scope"
                value={scope}
                onChange={(event) => setScope(event.target.value)}
              >
                <option value="all">All documents</option>
                <option value="user">Per user</option>
                <option value="van">Per van</option>
              </select>
            </label>
            <label>
              <span className="filter-control-label">Submission rule</span>
              <select
                aria-label="Filter by submission rule"
                value={rule}
                onChange={(event) => setRule(event.target.value)}
              >
                <option value="all">All submission rules</option>
                <option value="required">Required</option>
                <option value="optional">Optional</option>
              </select>
            </label>
            <label>
              <span className="filter-control-label">Visibility</span>
              <select
                aria-label="Filter by visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
              >
                <option value="all">All visibility</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>
              <span className="filter-control-label">Sort documents</span>
              <select
                aria-label="Sort documents"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="order">Display order</option>
                <option value="order_desc">Display order: highest first</option>
                <option value="name">Name: A–Z</option>
                <option value="name_desc">Name: Z–A</option>
                <option value="scope_user">Applies to: per user first</option>
                <option value="scope_van">Applies to: per van first</option>
              </select>
            </label>
            {filtered && (
              <button
                className="filter-clear-button"
                onClick={() => {
                  setSearch("");
                  setScope("all");
                  setRule("all");
                  setVisibility("all");
                  setSort("order");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <table className="requirements-table">
            <caption className="sr-only">
              Configured operator documents with their scope, submission rules,
              and visibility
            </caption>
            <thead>
              <tr>
                {[
                  {
                    label: "Order",
                    ascending: "order",
                    descending: "order_desc",
                  },
                  {
                    label: "Document",
                    ascending: "name",
                    descending: "name_desc",
                  },
                  {
                    label: "Applies to",
                    ascending: "scope_user",
                    descending: "scope_van",
                  },
                ].map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    aria-sort={
                      sort === column.ascending
                        ? "ascending"
                        : sort === column.descending
                          ? "descending"
                          : undefined
                    }
                  >
                    <button
                      type="button"
                      className="requirements-sort-button"
                      onClick={() =>
                        setSort(
                          sort === column.ascending
                            ? column.descending
                            : column.ascending,
                        )
                      }
                    >
                      {column.label}
                      <span aria-hidden="true">
                        {sort === column.ascending
                          ? "↑"
                          : sort === column.descending
                            ? "↓"
                            : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col">Submission</th>
                <th scope="col">Visibility</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr
                  key={item.code}
                  data-selected={editing === item.code}
                  tabIndex={0}
                  onClick={(event) => open(item.code, event.currentTarget)}
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      ["Enter", " "].includes(event.key)
                    ) {
                      event.preventDefault();
                      open(item.code, event.currentTarget);
                    }
                  }}
                >
                  <td className="requirements-order" data-label="Order">
                    {item.sort_order}
                  </td>
                  <th scope="row" className="requirements-document">
                    <span className="requirements-document-name">
                      {item.label}
                    </span>
                    {item.description && <p>{item.description}</p>}
                  </th>
                  <td className="requirements-scope" data-label="Applies to">
                    <span className={`requirement-badge is-${item.scope}`}>
                      {item.scope === "van" ? "Per van" : "Per user"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`requirement-badge ${item.required ? "is-required" : "is-optional"}`}
                    >
                      {item.required ? "Required" : "Optional"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`requirement-badge ${item.active ? "is-active" : "is-inactive"}`}
                    >
                      <span aria-hidden="true">●</span>{" "}
                      {item.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="requirements-row-action">
                    <button
                      aria-label={`Edit ${item.label}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        open(item.code, event.currentTarget);
                      }}
                    >
                      Edit <span aria-hidden="true">↗</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="requirements-empty">
              <h3>
                {requirements.length
                  ? "No matching requirements"
                  : "Build your document checklist"}
              </h3>
              <p>
                {requirements.length
                  ? "Try a different search or filter."
                  : "Add your first requirement and choose whether it is required or optional."}
              </p>
            </div>
          )}
          <footer className="requirements-list-footer">
            {rows.length} of {requirements.length} requirements · PDF, PNG, and
            JPEG uploads
          </footer>
        </section>
        {editing !== null && (
          <RequirementEditor
            key={editing}
            requirement={selected}
            nextOrder={Math.min(
              9999,
              Math.max(0, ...requirements.map((item) => item.sort_order)) + 10,
            )}
            onClose={close}
            onSaved={() => {
              setMessage(
                selected
                  ? "Requirement updated. The checklist is ready for new submissions."
                  : "Requirement added to your checklist.",
              );
              close();
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
