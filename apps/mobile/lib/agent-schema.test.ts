import { describe, expect, it } from "vitest";
import { AgentSchema } from "../data/schemas";

describe("AgentSchema invocation permissions", () => {
  it("defaults missing invocation permissions to private access", () => {
    const parsed = AgentSchema.parse({ id: "agent-1" });

    expect(parsed.permission_mode).toBe("private");
    expect(parsed.invocation_targets).toEqual([]);
  });

  it("parses public invocation grants", () => {
    const parsed = AgentSchema.parse({
      id: "agent-1",
      permission_mode: "public_to",
      invocation_targets: [
        { target_type: "workspace" },
        { target_type: "member", target_id: "member-1" },
      ],
    });

    expect(parsed.permission_mode).toBe("public_to");
    expect(parsed.invocation_targets).toEqual([
      { target_type: "workspace", target_id: null },
      { target_type: "member", target_id: "member-1" },
    ]);
  });

  it("fails closed for unknown permission values", () => {
    const parsed = AgentSchema.parse({
      id: "agent-1",
      permission_mode: "future_mode",
      invocation_targets: [{ target_type: "future_target", target_id: 123 }],
    });

    expect(parsed.permission_mode).toBe("private");
    expect(parsed.invocation_targets).toEqual([
      { target_type: "team", target_id: null },
    ]);
  });

  it("preserves the additive runtime binding signal", () => {
    const parsed = AgentSchema.parse({
      id: "agent-1",
      runtime_id: "",
      runtime_bound: false,
    });

    expect(parsed.runtime_id).toBe("");
    expect(parsed.runtime_bound).toBe(false);
  });

  it("defaults tool fields to undefined on legacy backends", () => {
    const parsed = AgentSchema.parse({ id: "agent-1" });

    expect(parsed.mcp_config).toBeUndefined();
    expect(parsed.mcp_config_redacted).toBeUndefined();
    expect(parsed.composio_toolkit_allowlist).toBeUndefined();
    expect(parsed.composio_toolkit_allowlist_redacted).toBeUndefined();
  });

  it("parses mcp_config as an opaque value", () => {
    const parsed = AgentSchema.parse({
      id: "agent-1",
      mcp_config: { mcpServers: { filesystem: { command: "npx" } } },
    });

    expect(parsed.mcp_config).toEqual({
      mcpServers: { filesystem: { command: "npx" } },
    });
    expect(parsed.mcp_config_redacted).toBeUndefined();
  });

  it("parses redaction flags and composio allowlist", () => {
    const parsed = AgentSchema.parse({
      id: "agent-1",
      mcp_config: null,
      mcp_config_redacted: true,
      composio_toolkit_allowlist: ["github", "slack"],
      composio_toolkit_allowlist_redacted: false,
    });

    expect(parsed.mcp_config).toBeNull();
    expect(parsed.mcp_config_redacted).toBe(true);
    expect(parsed.composio_toolkit_allowlist).toEqual(["github", "slack"]);
    expect(parsed.composio_toolkit_allowlist_redacted).toBe(false);
  });
});
