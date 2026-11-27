"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveRequirement } from "@/app/admin/actions";
import type { DocumentRequirement } from "@/lib/operators/types";

function RequirementEditor({
  requirement,
}: {
  requirement?: DocumentRequirement;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const creationCode = useRef("");
  const fieldId = useId();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    if (!requirement) {
      if (!creationCode.current)
        creationCode.current = `document_${crypto.randomUUID().replaceAll("-", "")}`;
      data.set("code", creationCode.current);
    }
    data.set("required", data.get("required") === "on" ? "true" : "false");
    data.set("active", data.get("active") === "on" ? "true" : "false");
    busy.current = true;
    setPending(true);
    try {
      const result = await saveRequirement(data);
      setMessage(result.message ?? "");
      if (result.success) {
        if (!requirement) {
          form.reset();
          creationCode.current = "";
        }
        router.refresh();
      }
    } catch {
      setMessage("We couldn't save this requirement. Please try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="requirement-editor">
      <input type="hidden" name="code" value={requirement?.code ?? ""} />
      <div>
        <label className="field-label" htmlFor={`requirement-${fieldId}`}>
          Document label
        </label>
        <input
          id={`requirement-${fieldId}`}
          name="label"
          className="field-input"
          defaultValue={requirement?.label}
          required
          maxLength={150}
          disabled={pending}
        />
      </div>
      <div className="flex flex-wrap gap-5">
        <label className="workspace-checkbox">
          <input
            type="checkbox"
            name="required"
            defaultChecked={requirement?.required}
            disabled={pending}
          />
          Required to submit
        </label>
        <label className="workspace-checkbox">
          <input
            type="checkbox"
            name="active"
            defaultChecked={requirement?.active ?? true}
            disabled={pending}
          />
          Active
        </label>
      </div>
      <button className="workspace-secondary" type="submit" disabled={pending}>
        {pending
          ? "Saving…"
          : requirement
            ? "Save requirement"
            : "Add requirement"}
      </button>
      {message && (
        <p role="status" className="workspace-feedback">
          {message}
        </p>
      )}
    </form>
  );
}
export function DocumentRequirementsForm({
  requirements,
}: {
  requirements: DocumentRequirement[];
}) {
  return (
    <div className="space-y-5">
      <p className="workspace-feedback">
        Required documents are checked when an operator submits or resubmits.
        Mark documents required only after the review checklist has been agreed.
      </p>
      {requirements.map((r) => (
        <section className="workspace-panel" key={r.code}>
          <RequirementEditor requirement={r} />
        </section>
      ))}
      <section className="workspace-panel">
        <h2 className="workspace-section-title mb-5">
          Add a document requirement
        </h2>
        <RequirementEditor />
      </section>
    </div>
  );
}
