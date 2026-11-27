import "server-only";
import { parseSiteUrl } from "./site-origin";

export function getSiteUrl() {
  const configured =
    process.env.SITE_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  return parseSiteUrl(configured, { allowLocal: process.env.VERCEL !== "1" });
}
