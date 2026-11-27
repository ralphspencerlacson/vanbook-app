import "server-only";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/operators/server";
import { destinationFor } from "./access";
import { safeNext } from "./forms";

// Check each guest page, rather than only its persistent shared layout.
export async function redirectSignedIn(next?: unknown) {
  const actor = await getActor();
  if (!actor.user) return;
  if (!actor.ready || !actor.access)
    throw new Error("Account permissions are unavailable. Please contact support.");
  redirect(destinationFor(actor.access, safeNext(next)));
}
