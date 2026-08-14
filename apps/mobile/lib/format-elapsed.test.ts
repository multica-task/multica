/**
 * formatElapsed — Chinese duration captions (PRD §9.5), mirrored from web's
 * chat format helper. Locked here so the「38 秒 / 1 分 39 秒」captions can't
 * drift back to English.
 */
import { describe, expect, it } from "vitest";
import { formatElapsedMs, formatElapsedSecs } from "./format-elapsed";

describe("formatElapsedSecs", () => {
  it("renders seconds under a minute", () => {
    expect(formatElapsedSecs(0)).toBe("0 秒");
    expect(formatElapsedSecs(38)).toBe("38 秒");
    expect(formatElapsedSecs(59)).toBe("59 秒");
  });

  it("renders whole minutes without seconds", () => {
    expect(formatElapsedSecs(60)).toBe("1 分");
    expect(formatElapsedSecs(120)).toBe("2 分");
  });

  it("renders minutes and seconds together", () => {
    expect(formatElapsedSecs(99)).toBe("1 分 39 秒");
    expect(formatElapsedSecs(125)).toBe("2 分 5 秒");
  });
});

describe("formatElapsedMs", () => {
  it("converts milliseconds and clamps negatives", () => {
    expect(formatElapsedMs(38_000)).toBe("38 秒");
    expect(formatElapsedMs(99_400)).toBe("1 分 39 秒");
    expect(formatElapsedMs(-500)).toBe("0 秒");
  });
});
