import { describe, expect, it } from "vitest";
import {
  formatCompactNumber,
  formatDuration,
  formatRate,
  formatTokens,
} from "./format";

describe("formatCompactNumber", () => {
  it("renders plain numbers with locale separators", () => {
    expect(formatCompactNumber(0)).toBe("0");
    expect(formatCompactNumber(999)).toBe("999");
  });

  it("uses K / M / B / T suffixes", () => {
    expect(formatCompactNumber(1_234)).toBe("1.2K");
    expect(formatCompactNumber(3_400_000)).toBe("3.4M");
    expect(formatCompactNumber(5_000_000_000)).toBe("5B");
    expect(formatCompactNumber(1_200_000_000_000)).toBe("1.2T");
  });

  it("promotes values that round across a unit boundary", () => {
    expect(formatCompactNumber(999_999)).toBe("1M");
    expect(formatCompactNumber(999_999_999)).toBe("1B");
    expect(formatCompactNumber(999_500)).toBe("999.5K");
  });

  it("handles non-finite input as zero", () => {
    expect(formatCompactNumber(NaN)).toBe("0");
    expect(formatCompactNumber(Infinity)).toBe("0");
    expect(formatCompactNumber(-Infinity)).toBe("0");
  });
});

describe("formatTokens", () => {
  it("aliases the compact magnitude scale", () => {
    expect(formatTokens(1_500)).toBe("1.5K");
    expect(formatTokens(0)).toBe("0");
  });
});

describe("formatDuration", () => {
  it("returns the less-than-minute label for missing / negative input", () => {
    expect(formatDuration(-1)).toBe("<1 分钟");
    expect(formatDuration(NaN)).toBe("<1 分钟");
    expect(formatDuration(Infinity)).toBe("<1 分钟");
  });

  it("renders seconds under a minute", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(0.5)).toBe("<1 分钟");
  });

  it("renders minutes with a seconds remainder", () => {
    expect(formatDuration(750)).toBe("12m 30s");
    expect(formatDuration(120)).toBe("2m");
  });

  it("renders hours + minutes, two segments max", () => {
    expect(formatDuration(5_000)).toBe("1h 23m");
    expect(formatDuration(7_200)).toBe("2h");
  });

  it("renders days when the run spans them", () => {
    expect(formatDuration(180_000)).toBe("2d 2h");
    expect(formatDuration(172_800)).toBe("2d");
  });
});

describe("formatRate", () => {
  it("returns an em dash when there is no denominator (missing, not zero)", () => {
    expect(formatRate(0, 0)).toBe("—");
    expect(formatRate(3, 0)).toBe("—");
  });

  it("keeps one decimal under 10%", () => {
    expect(formatRate(1, 20)).toBe("5.0%");
  });

  it("rounds at or above 10%", () => {
    expect(formatRate(4, 10)).toBe("40%");
    expect(formatRate(9, 20)).toBe("45%");
  });
});
