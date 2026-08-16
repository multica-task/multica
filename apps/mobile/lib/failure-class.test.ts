import { describe, expect, it } from "vitest";
import {
  FAILURE_CLASSES,
  FAILURE_CLASS_LABEL,
  failureClassOf,
} from "./failure-class";

describe("failureClassOf", () => {
  it("maps canonical backend reasons to their display class", () => {
    expect(failureClassOf("agent_error.provider_auth_or_access")).toBe("auth");
    expect(failureClassOf("agent_error.missing_config")).toBe("auth");
    expect(failureClassOf("agent_error.provider_capacity_or_rate_limit")).toBe(
      "rate_limit",
    );
    expect(failureClassOf("agent_error.agent_timeout")).toBe("timeout");
    expect(failureClassOf("agent_error.provider_server_error")).toBe("provider");
    expect(failureClassOf("runtime_offline")).toBe("runtime");
    expect(failureClassOf("agent_error.process_failure")).toBe("agent");
  });

  it("folds legacy coarse values into the catchall", () => {
    expect(failureClassOf("manual")).toBe("other");
    expect(failureClassOf("unclassified")).toBe("other");
    expect(failureClassOf("agent_error")).toBe("other");
  });

  it("falls back to other for a reason a newer backend introduced", () => {
    expect(failureClassOf("brand_new_reason")).toBe("other");
  });

  it("leaks the empty string into other (callers must not pass the succeeded bucket)", () => {
    expect(failureClassOf("")).toBe("other");
  });
});

describe("FAILURE_CLASSES", () => {
  it("has seven classes, catchall last, in render order", () => {
    expect(FAILURE_CLASSES).toEqual([
      "auth",
      "rate_limit",
      "timeout",
      "provider",
      "runtime",
      "agent",
      "other",
    ]);
  });

  it("has a Chinese display label for every class", () => {
    for (const cls of FAILURE_CLASSES) {
      expect(FAILURE_CLASS_LABEL[cls]).toBeTruthy();
    }
  });
});
