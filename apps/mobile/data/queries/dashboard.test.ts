import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// dashboard.ts imports the native fetch client; mock it so the Node test
// never loads RN modules (same pattern as board.test.ts / chat-ws-updaters).
// The mock factory result is cached by Vitest across `vi.resetModules()`, so
// `api.probeDashboard` is a single shared vi.fn — we reset its call history
// per scenario inside `loadDashboard` (see below).
vi.mock("@/data/api", () => ({
  api: { probeDashboard: vi.fn() },
}));

/**
 * `probeDashboardAvailability` caches its verdict in module state
 * (`dashboardAvailability`) for the session. Each scenario needs a fresh
 * module instance so the cache starts empty — `vi.resetModules()` +
 * dynamic import gives us that (pattern mirrors how we'd reset a store).
 *
 * The api mock is NOT recreated by resetModules (Vitest caches the mocked
 * module), so we `mockReset()` the shared probe fn to drop the previous
 * scenario's call history and queued implementations.
 */
async function loadDashboard() {
  vi.resetModules();
  const mod = await import("./dashboard");
  const { api } = await import("@/data/api");
  const probe = api.probeDashboard as unknown as Mock;
  probe.mockReset();
  return { probeDashboardAvailability: mod.probeDashboardAvailability, probe };
}

describe("probeDashboardAvailability", () => {
  it("probes once and caches a success for the session", async () => {
    const { probeDashboardAvailability, probe } = await loadDashboard();

    probe.mockResolvedValueOnce(undefined);

    await expect(probeDashboardAvailability()).resolves.toBe(true);
    await expect(probeDashboardAvailability()).resolves.toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("caches a failure (404) as degraded for the session", async () => {
    const { probeDashboardAvailability, probe } = await loadDashboard();

    probe.mockRejectedValueOnce(new Error("404"));

    await expect(probeDashboardAvailability()).resolves.toBe(false);
    await expect(probeDashboardAvailability()).resolves.toBe(false);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("does not throw on network error", async () => {
    const { probeDashboardAvailability, probe } = await loadDashboard();

    probe.mockRejectedValueOnce(new TypeError("Network request failed"));

    await expect(probeDashboardAvailability()).resolves.toBe(false);
    expect(probe).toHaveBeenCalledTimes(1);
  });
});
