import { describe, expect, it, vi } from "vitest";
import { esUuid, nuevoUuid } from "./uuid";

describe("nuevoUuid", () => {
  it("genera UUID v4 válidos y distintos", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => nuevoUuid()));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(esUuid(id)).toBe(true);
  });
  it("funciona sin crypto.randomUUID (respaldo con getRandomValues)", () => {
    const original = crypto.randomUUID;
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    try {
      const id = nuevoUuid();
      expect(esUuid(id)).toBe(true);
      expect(id[14]).toBe("4");
    } finally {
      vi.unstubAllGlobals();
    }
    expect(crypto.randomUUID).toBe(original);
  });
});
