import { Suspense } from "react";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/forms";

async function PasswordContent({
  searchParams,
}: PageProps<"/sign-in/password">) {
  const params = await searchParams;
  return redirect(`/sign-in?next=${encodeURIComponent(safeNext(params.next))}`);
}

export default function PasswordPage(props: PageProps<"/sign-in/password">) {
  return (
    <Suspense fallback={<p role="status">Loading sign-in…</p>}>
      <PasswordContent {...props} />
    </Suspense>
  );
}
