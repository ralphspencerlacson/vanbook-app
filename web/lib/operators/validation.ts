import { type ApplicationDraft, type OperatorActionResult } from "./types";

export function parseDraft(form: FormData, submitting = false) {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const draft: ApplicationDraft = {
    business_name: text("business_name"),
    registration_number: text("registration_number"),
    contact_name: text("contact_name"),
    contact_email: text("contact_email"),
    contact_phone: text("contact_phone"),
    operating_base: text("operating_base"),
    service_areas: [
      ...new Set(
        text("service_areas")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ],
    notes: text("notes"),
  };
  const limits: Partial<Record<keyof ApplicationDraft, number>> = {
    business_name: 200,
    registration_number: 100,
    contact_name: 150,
    contact_email: 254,
    contact_phone: 30,
    operating_base: 200,
    notes: 3000,
  };
  const errors: NonNullable<OperatorActionResult["errors"]> = {};
  if (submitting) {
    for (const key of [
      "business_name",
      "contact_name",
      "contact_email",
      "contact_phone",
      "operating_base",
    ] as const)
      if (!draft[key]) errors[key] = "Complete this field before submitting.";
    if (!draft.service_areas.length)
      errors.service_areas = "Add at least one service area before submitting.";
  }
  for (const [field, limit] of Object.entries(limits))
    if (String(draft[field as keyof ApplicationDraft]).length > limit)
      errors[field as keyof ApplicationDraft] =
        `Use ${limit} characters or fewer.`;
  if (
    draft.contact_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contact_email)
  )
    errors.contact_email = "Enter a valid email address.";
  if (draft.contact_phone && !/^[+0-9() -]{7,30}$/.test(draft.contact_phone))
    errors.contact_phone = "Enter a valid contact number.";
  if (
    draft.service_areas.length > 30 ||
    draft.service_areas.some((s) => s.length > 100)
  )
    errors.service_areas =
      "Use up to 30 service areas, each up to 100 characters.";
  return { draft, errors };
}

export function operationError(error: { code?: string }) {
  if (error.code === "40001")
    return "This application changed while you were working. Refresh to see the latest version before trying again.";
  if (error.code === "42501")
    return "You don't have permission to make this change.";
  if (error.code === "P0001" || error.code === "23514")
    return "Check that all required fields and documents are complete and that the application is still eligible for this action.";
  if (["PGRST205", "42P01"].includes(error.code ?? ""))
    return "This workspace is not available yet. Please try again later.";
  return "We couldn't save this change. Check your connection and try again. Your entries are still here.";
}
