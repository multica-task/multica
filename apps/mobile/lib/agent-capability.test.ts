import { describe, expect, it } from "vitest";
import type { Agent, AgentTask } from "@multica/core/types";
import {
  countAgentInHand,
  countAgentSkills,
  countAgentTools,
  listManagedMcpServers,
} from "./agent-capability";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    workspace_id: "ws-1",
    runtime_id: "runtime-1",
    name: "mika",
    description: "",
    instructions: "",
    avatar_url: null,
    runtime_mode: "local",
    runtime_config: {},
    custom_args: [],
    visibility: "workspace",
    permission_mode: "private",
    invocation_targets: [],
    status: "idle",
    max_concurrent_tasks: 1,
    model: "",
    owner_id: null,
    skills: [],
    created_at: "",
    updated_at: "",
    archived_at: null,
    archived_by: null,
    ...overrides,
  };
}

describe("listManagedMcpServers", () => {
  it("parses the mcpServers container", () => {
    const servers = listManagedMcpServers({
      mcpServers: {
        filesystem: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem"] },
        github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
      },
    });
    expect(servers.map((s) => s.name)).toEqual(["filesystem", "github"]);
  });

  it("accepts the legacy mcp container", () => {
    const servers = listManagedMcpServers({
      mcp: { weather: { command: "npx" } },
    });
    expect(servers.map((s) => s.name)).toEqual(["weather"]);
    expect(servers[0].transport).toBe("stdio");
  });

  it("returns [] for non-object or null", () => {
    expect(listManagedMcpServers(null)).toEqual([]);
    expect(listManagedMcpServers("nope")).toEqual([]);
    expect(listManagedMcpServers(undefined)).toEqual([]);
  });
});

describe("countAgentSkills", () => {
  it("counts skills array length", () => {
    const skills = [
      { id: "a", name: "skill-a", description: "" },
      { id: "b", name: "skill-b", description: "" },
    ];
    expect(countAgentSkills(makeAgent({ skills }))).toBe(2);
    expect(countAgentSkills(makeAgent())).toBe(0);
  });
});

describe("countAgentTools (redaction rules)", () => {
  it("shows configured state when either redaction flag is set", () => {
    expect(
      countAgentTools(makeAgent({ mcp_config: { mcpServers: {} }, mcp_config_redacted: true })),
    ).toEqual({ state: "configured" });
    expect(
      countAgentTools(makeAgent({
        composio_toolkit_allowlist: ["github"],
        composio_toolkit_allowlist_redacted: true,
      })),
    ).toEqual({ state: "configured" });
  });

  it("treats missing tool fields as unknown, not zero", () => {
    expect(countAgentTools(makeAgent())).toEqual({ state: "unknown" });
  });

  it("counts mcp servers + composio toolkits when not redacted", () => {
    expect(
      countAgentTools(makeAgent({
        mcp_config: { mcpServers: { a: { command: "x" }, b: { command: "y" } } },
        composio_toolkit_allowlist: ["github", "slack"],
      })),
    ).toEqual({ state: "count", count: 4 });
  });

  it("counts zero only when fields are genuinely empty", () => {
    expect(
      countAgentTools(makeAgent({
        mcp_config: null,
        composio_toolkit_allowlist: [],
      })),
    ).toEqual({ state: "count", count: 0 });
  });
});

describe("countAgentInHand", () => {
  const tasks: AgentTask[] = [
    { id: "t1", agent_id: "agent-1", runtime_id: "", issue_id: "", status: "running", priority: 0, dispatched_at: null, started_at: null, completed_at: null, result: null, error: null, created_at: "" },
    { id: "t2", agent_id: "agent-1", runtime_id: "", issue_id: "", status: "queued", priority: 0, dispatched_at: null, started_at: null, completed_at: null, result: null, error: null, created_at: "" },
    { id: "t3", agent_id: "agent-1", runtime_id: "", issue_id: "", status: "completed", priority: 0, dispatched_at: null, started_at: null, completed_at: null, result: null, error: null, created_at: "" },
    { id: "t4", agent_id: "agent-2", runtime_id: "", issue_id: "", status: "running", priority: 0, dispatched_at: null, started_at: null, completed_at: null, result: null, error: null, created_at: "" },
  ];

  it("counts active tasks per agent, excludes terminal", () => {
    expect(countAgentInHand(makeAgent({ id: "agent-1" }), tasks)).toBe(2);
  });

  it("returns 0 when no task list", () => {
    expect(countAgentInHand(makeAgent({ id: "agent-1" }), undefined)).toBe(0);
  });
});
