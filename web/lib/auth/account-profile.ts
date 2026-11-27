import type { AccountAccess } from "./access";

export type AccountProfile = {
  name: string;
  email: string;
  role: AccountAccess["role"];
  confirmed: boolean;
  joinedAt: string;
  phone?: string;
  contactEmail?: string;
  version?: number;
};
export type AccountProfileResult = {
  profile?: AccountProfile;
  success?: boolean;
  message?: string;
  errors?: Partial<Record<"name" | "phone" | "contactEmail", string>>;
};

export function readContactProfile(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const contactEmail = String(form.get("contactEmail") ?? "").trim();
  const version = Number(form.get("version"));
  const errors: NonNullable<AccountProfileResult["errors"]> = {};
  if (!name || name.length > 150) errors.name = "Enter your name (up to 150 characters).";
  if (!/^[+0-9() -]{7,30}$/.test(phone)) errors.phone = "Enter a valid contact number.";
  if (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
    errors.contactEmail = "Enter a valid contact email.";
  return { name, phone, contactEmail, version, errors };
}
