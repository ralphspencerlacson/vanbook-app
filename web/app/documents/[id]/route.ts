import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/lib/operators/server";
import { isUuid } from "@/lib/operators/types";

export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/documents/[id]">,
) {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
  };
  const { id } = await params;
  if (!isUuid(id))
    return NextResponse.json(
      { message: "Document not found." },
      { status: 404, headers },
    );
  try {
    const actor = await getActor();
    if (!actor.user)
      return NextResponse.json(
        { message: "Please sign in to view this document." },
        { status: 401, headers },
      );
    const document = await actor.supabase
      .from("operator_documents")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    if (document.error || !document.data)
      return NextResponse.json(
        { message: "Document not found or access denied." },
        { status: 404, headers },
      );
    const signed = await actor.supabase.storage
      .from("operator-documents")
      .createSignedUrl(document.data.storage_path, 60);
    if (signed.error || !signed.data)
      return NextResponse.json(
        {
          message:
            "We couldn't open the document. Return to the application and try again.",
        },
        { status: 503, headers },
      );
    return NextResponse.redirect(signed.data.signedUrl, {
      status: 303,
      headers,
    });
  } catch {
    return NextResponse.json(
      { message: "We couldn't open the document. Please try again." },
      { status: 503, headers },
    );
  }
}
