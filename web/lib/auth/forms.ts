export type AuthResult = {
  message?: string;
  errors?: Partial<Record<"email" | "password" | "confirmPassword", string>>;
  success?: boolean;
  redirectTo?: string;
};

export function readEmail(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const error =
    email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? "Enter a valid email address."
      : undefined;
  return { email, error };
}

export function readCredentials(form: FormData, registering = false) {
  const { email, error: emailError } = readEmail(form);
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  const errors: NonNullable<AuthResult["errors"]> = {};
  if (emailError) errors.email = emailError;
  if (!password || password.length > 128) {
    errors.password = "Enter your password (up to 128 characters).";
  } else if (registering && password.length < 8) {
    errors.password = "Use at least 8 characters.";
  }
  if (registering && password !== confirmPassword) {
    errors.confirmPassword = "The passwords do not match.";
  }
  return { email, password, errors };
}

// Only local paths are accepted, including after URL decoding. Auth endpoints
// are excluded to prevent callback/redirect loops.
export function safeNext(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return "/account";
  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      [...decoded].some(
        (char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
      ) ||
      /^\/(?:auth(?:\/|$)|sign-in(?:[/?#]|$)|register(?:[/?#]|$))/.test(decoded)
    )
      return "/account";
    const parsed = new URL(value, "https://vanbook.invalid");
    const normalized = new URL(decoded, "https://vanbook.invalid");
    if (
      parsed.origin !== "https://vanbook.invalid" ||
      normalized.origin !== "https://vanbook.invalid" ||
      parsed.pathname.startsWith("//") ||
      normalized.pathname.startsWith("//") ||
      /^\/(?:auth(?:\/|$)|sign-in(?:[/?#]|$)|register(?:[/?#]|$))/.test(
        normalized.pathname,
      )
    )
      return "/account";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/account";
  }
}

export function authErrorMessage(error: { code?: string; status?: number }) {
  if (error.status === 429 || error.code?.includes("rate_limit")) {
    return "Too many attempts. Please wait a few minutes before trying again.";
  }
  switch (error.code) {
    case "invalid_credentials":
      return "The email or password is incorrect.";
    case "email_not_confirmed":
      return "Confirm your email before signing in. You can resend the confirmation below.";
    case "weak_password":
      return "Choose a stronger password with a mix of letters, numbers, and symbols.";
    case "signup_disabled":
      return "Registration is currently unavailable. Please try again later.";
    case "email_address_not_authorized":
      return "Confirmation email could not be sent to this address. Please contact VANBOOK PH support.";
    default:
      return "We couldn't complete that request. Check your connection and try again.";
  }
}
