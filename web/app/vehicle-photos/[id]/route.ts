import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/lib/operators/server";
import { isUuid } from "@/lib/operators/types";
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/vehicle-photos/[id]">,
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  const { id } = await params;
  if (!isUuid(id))
    return NextResponse.json(
      { message: "Photo not found." },
      { status: 404, headers },
    );
  try {
    const actor = await getActor();
    if (!actor.user)
      return NextResponse.json(
        { message: "Sign in to view this photo." },
        { status: 401, headers },
      );
    const photo = await actor.supabase
      .from("operator_vehicle_photos")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    if (photo.error || !photo.data)
      return NextResponse.json(
        { message: "Photo not found." },
        { status: 404, headers },
      );
    const signed = await actor.supabase.storage
      .from("operator-documents")
      .createSignedUrl(photo.data.storage_path, 60);
    if (signed.error || !signed.data)
      return NextResponse.json(
        { message: "Photo unavailable. Try again." },
        { status: 503, headers },
      );
    return NextResponse.redirect(signed.data.signedUrl, {
      status: 303,
      headers,
    });
  } catch {
    return NextResponse.json(
      { message: "Photo unavailable. Try again." },
      { status: 503, headers },
    );
  }
}
