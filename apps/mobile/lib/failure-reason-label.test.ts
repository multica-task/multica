/**
 * failureReasonLabel — Chinese failure reason copy for the voice / task
 * bubble (PRD §9.5). Unrecognised reasons degrade to 「失败」, never leak the
 * raw wire enum (deliberate divergence from web — see module doc).
 */
import { describe, expect, it } from "vitest";
import { failureReasonLabel } from "./failure-reason-label";

describe("failureReasonLabel", () => {
  it("labels known platform reasons in Chinese", () => {
    expect(failureReasonLabel("runtime_offline")).toBe("守护进程离线");
    expect(failureReasonLabel("timeout")).toBe("任务超时");
    expect(failureReasonLabel("queued_expired")).toBe("排队超时");
  });

  it("labels known agent_error reasons in Chinese", () => {
    expect(failureReasonLabel("agent_error.process_failure")).toBe("数字员工进程崩溃");
    expect(failureReasonLabel("agent_error.provider_quota_limit")).toBe(
      "模型账号额度用尽",
    );
  });

  it("falls back to 失败 for null/undefined/unknown reasons", () => {
    expect(failureReasonLabel(null)).toBe("失败");
    expect(failureReasonLabel(undefined)).toBe("失败");
    expect(failureReasonLabel("some_future_reason")).toBe("失败");
  });
});
