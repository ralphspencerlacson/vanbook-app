import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseDraft } from "@/lib/operators/validation";
const { getActor, rpc, revalidatePath } = vi.hoisted(() => ({
  getActor: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/operators/server", () => ({ getActor }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { reviewApplication } from "@/app/admin/actions";
const id = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  getActor.mockResolvedValue({
    user: { id },
    isAdmin: false,
    ready: true,
    supabase: { rpc },
  });
});
describe("review action authorization", () => {
  it("rejects non-administrators before calling the review RPC", async () => {
    expect(
      (await reviewApplication(id, 2, "approved", "")).success,
    ).toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires a note for corrections or rejection", async () => {
    expect(
      (await reviewApplication(id, 2, "changes_requested", "")).message,
    ).toContain("Explain");
    expect(getActor).not.toHaveBeenCalled();
  });
  it("normalizes returned database rows and refreshes affected workspaces", async () => {
    getActor.mockResolvedValue({
      user: { id },
      isAdmin: true,
      ready: true,
      supabase: { rpc },
    });
    rpc.mockResolvedValue({ data: [{ id, status: "approved" }], error: null });
    const result = await reviewApplication(id, 2, "approved", "Reviewed");
    expect(result.application?.id).toBe(id);
    expect(revalidatePath).toHaveBeenCalledWith("/operator");
  });
  it("reports stale reviews rather than overwriting another administrator", async () => {
    getActor.mockResolvedValue({
      user: { id },
      isAdmin: true,
      ready: true,
      supabase: { rpc },
    });
    rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
    expect((await reviewApplication(id, 2, "approved", "")).message).toContain(
      "changed",
    );
  });
});
describe("application validation", () => {
  it("allows incomplete drafts but requires fields for submission", () => {
    expect(parseDraft(new FormData()).errors).toEqual({});
    expect(parseDraft(new FormData(), true).errors).toHaveProperty(
      "business_name",
    );
    expect(parseDraft(new FormData(), true).errors).toHaveProperty(
      "service_areas",
    );
  });
  it("normalizes service coverage and validates contact information", () => {
    const form = new FormData();
    form.set("service_areas", " Manila, Laguna, Manila, ");
    form.set("contact_email", "bad");
    const result = parseDraft(form);
    expect(result.draft.service_areas).toEqual(["Manila", "Laguna"]);
    expect(result.errors.contact_email).toBeTruthy();
  });
});
