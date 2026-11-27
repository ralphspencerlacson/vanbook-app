import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
type Admin = ReturnType<typeof createAdminClient>;
export function readUploads(form: FormData) {
  const files = [...form.entries()].filter(
    ([key, file]) =>
      /^(document:|photo:)/.test(key) && file instanceof File && file.size > 0,
  ) as [string, File][];
  if (
    files.length > 32 ||
    files.reduce((sum, [, file]) => sum + file.size, 0) > 3 * 1024 * 1024
  )
    throw new Error(
      "Keep all documents and photos within a combined 3 MB upload limit.",
    );
  if (new Set(files.map(([key]) => key)).size !== files.length)
    throw new Error("Choose one file per document or photo position.");
  return files;
}
export async function validateUploads(files: [string, File][]) {
  for (const [key, file] of files) {
    if (
      !(
        key.startsWith("photo:")
          ? ["image/png", "image/jpeg"]
          : ["application/pdf", "image/png", "image/jpeg"]
      ).includes(file.type) ||
      file.name.length > 255
    )
      throw new Error(
        "Documents must be PDF, PNG, or JPEG. Vehicle photos must be PNG or JPEG.",
      );
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const valid =
      file.type === "application/pdf"
        ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
        : file.type === "image/png"
          ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
          : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!valid)
      throw new Error(
        "A file does not match its format. Choose a valid PDF, PNG, or JPEG.",
      );
  }
}
export async function uploadOperatorFile(
  admin: Admin,
  owner: string,
  application: string,
  file: File,
) {
  const extension =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : "jpg";
  const storage_path = `${owner}/${application}/${randomUUID()}.${extension}`;
  const result = await admin.storage
    .from("operator-documents")
    .upload(storage_path, file, { contentType: file.type, upsert: false });
  if (result.error)
    throw new Error("We couldn't upload a file. Please try again.");
  return {
    storage_path,
    file_name: file.name,
    content_type: file.type,
    size_bytes: file.size,
  };
}
export async function cleanUnreferencedUploads(admin: Admin, paths: string[]) {
  if (!paths.length) return;
  const [documents, photos] = await Promise.all([
    admin
      .from("operator_documents")
      .select("storage_path")
      .in("storage_path", paths),
    admin
      .from("operator_vehicle_photos")
      .select("storage_path")
      .in("storage_path", paths),
  ]);
  if (documents.error || photos.error) return;
  const retained = new Set(
    [...documents.data, ...photos.data].map((row) => row.storage_path),
  );
  const unused = paths.filter((path) => !retained.has(path));
  if (unused.length)
    await admin.storage.from("operator-documents").remove(unused);
}
