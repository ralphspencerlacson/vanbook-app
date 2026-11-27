// Application record contracts for the versioned onboarding migration.
// Generated hosted schema types are in lib/supabase/database.types.ts.
export const applicationStatuses = [
  "draft",
  "submitted",
  "changes_requested",
  "approved",
  "rejected",
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];
export const statusLabels: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};
export type ApplicationDraft = {
  business_name: string;
  registration_number: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  operating_base: string;
  service_areas: string[];
  notes: string;
};
export type OperatorApplication = ApplicationDraft & {
  id: string;
  owner_id: string;
  status: ApplicationStatus;
  version: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string;
  created_at: string;
  updated_at: string;
};
export type ApplicationDocument = {
  id: string;
  application_id: string;
  storage_path: string;
  category: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};
export type ApplicationEvent = {
  id: string;
  application_id: string;
  actor_id: string;
  from_status: ApplicationStatus;
  to_status: ApplicationStatus;
  note: string;
  created_at: string;
};
export type DocumentRequirement = {
  code: string;
  label: string;
  required: boolean;
  active: boolean;
};
export type OperatorActionResult = {
  success?: boolean;
  message?: string;
  application?: OperatorApplication;
  errors?: Partial<Record<keyof ApplicationDraft, string>>;
};
export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export function canEdit(status: ApplicationStatus) {
  return status === "draft" || status === "changes_requested";
}
export function displayDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(value)) + " PHT"
    : "—";
}
