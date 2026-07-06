import { describe, it, expect } from "vitest";
import { uploadCatPhoto } from "./catPhotos";

describe("uploadCatPhoto", () => {
  it("rejects path traversal payloads in uploaderId", async () => {
    const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const mockBytes = new Uint8Array([1, 2, 3]);

    const result = await uploadCatPhoto({} as any, {
      uploaderId: "../../../etc/passwd",
      file: mockFile,
      bytes: mockBytes,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Invalid uploader ID/i);
    }
  });

  it("rejects non-uuid strings in uploaderId", async () => {
    const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const mockBytes = new Uint8Array([1, 2, 3]);

    const result = await uploadCatPhoto({} as any, {
      uploaderId: "invalid-uuid",
      file: mockFile,
      bytes: mockBytes,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Invalid uploader ID/i);
    }
  });
});
