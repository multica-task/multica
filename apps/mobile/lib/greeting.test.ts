import { describe, expect, it } from "vitest";
import { getGreeting } from "./greeting";

describe("getGreeting", () => {
  it("uses 早上好 for morning hours (5–11)", () => {
    expect(getGreeting(5)).toBe("早上好");
    expect(getGreeting(8)).toBe("早上好");
    expect(getGreeting(11)).toBe("早上好");
  });

  it("uses 下午好 for afternoon hours (12–17)", () => {
    expect(getGreeting(12)).toBe("下午好");
    expect(getGreeting(15)).toBe("下午好");
    expect(getGreeting(17)).toBe("下午好");
  });

  it("uses 晚上好 for evening / night hours", () => {
    expect(getGreeting(18)).toBe("晚上好");
    expect(getGreeting(0)).toBe("晚上好");
    expect(getGreeting(4)).toBe("晚上好");
    expect(getGreeting(23)).toBe("晚上好");
  });
});
