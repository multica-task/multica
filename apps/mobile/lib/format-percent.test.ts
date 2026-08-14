import { describe, expect, it } from "vitest";
import { formatPercent } from "./format-percent";

describe("formatPercent", () => {
  it("returns null when total is 0 (missing, not zero)", () => {
    expect(formatPercent(0, 0)).toBeNull();
    expect(formatPercent(3, 0)).toBeNull();
  });

  it("shows the raw sample instead of a percentage when denominator < 5", () => {
    expect(formatPercent(2, 4)).toBe("2/4");
    expect(formatPercent(1, 3)).toBe("1/3");
  });

  it("returns a rounded percentage when denominator >= 5", () => {
    expect(formatPercent(3, 5)).toBe("60%");
    expect(formatPercent(5, 10)).toBe("50%");
    expect(formatPercent(1, 6)).toBe("17%");
  });
});
