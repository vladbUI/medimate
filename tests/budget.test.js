import { describe, it, expect } from "vitest";
import { Budget, monthKey } from "../server/budget";
describe("server budget guard", () => {
  it("fails closed for invalid configured limits", () => {
    for (const n of [501, 0, -1, NaN, Infinity])
      expect(() => new Budget(":memory:", n)).toThrow();
  });
  it("blocks cumulative overrun and duplicate retries", () => {
    const b = new Budget(":memory:");
    b.reserve("a", 499.99, "2026-11");
    expect(() => b.reserve("b", 0.02, "2026-11")).toThrow("exhausted");
    b.reserve("b", 0.01, "2026-11");
    expect(b.status("2026-11").remainingPhp).toBe(0);
    expect(() => b.reserve("a", 1, "2026-12")).toThrow("Duplicate");
    expect(b.status("2026-12").usedPhp).toBe(0);
    b.close();
  });
  it("uses the Manila month at UTC month boundaries", () => {
    expect(monthKey(new Date("2026-10-31T16:01:00Z"))).toBe("2026-11");
  });
});
