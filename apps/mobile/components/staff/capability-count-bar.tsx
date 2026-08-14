/**
 * 能力计数条（PRD §7.5 / §7.6）——名册卡片与档案页头共用。
 *
 * 三个计数：技能 / 工具 / 在手。排版沿用 StaffDeck「大数字上、小标签下」，
 * 三等分；数字 `text-lg font-semibold`，标签 `text-[10px] text-muted-foreground`。
 *
 * 数据口径（§7.5 约定）：
 *   - 技能数与在手数属于 A 类数据（§0.4），取不到时显示 `——`，不显示 0。
 *   - 工具配置脱敏（`*_redacted=true`）时只显示「已配置」或 `——`，禁止计数。
 *   - 旧后端未返回工具字段按「未知」处理，不假定为空。
 *   - 第 4 格「定时」是结构预留，本期恒显示 `——` 且置灰（tooltip 说明见
 *     档案页；此处由 `showScheduleSlot` 控制开关）。
 */
import { View } from "react-native";
import type { Agent, AgentTask } from "@multica/core/types";
import {
  countAgentInHand,
  countAgentSkills,
  countAgentTools,
} from "@/lib/agent-capability";
import { Text } from "@/components/ui/text";

interface Props {
  agent: Agent;
  /** 该员工全部活跃任务（/api/agent-task-snapshot）。未加载时传 undefined。 */
  tasks?: readonly AgentTask[] | undefined;
  /** 名册卡片不显示「定时」占位格（§7.5 只有技能/工具/在手三格）。 */
  showScheduleSlot?: boolean;
}

export function CapabilityCountBar({
  agent,
  tasks,
  showScheduleSlot = false,
}: Props) {
  const skills = countAgentSkills(agent);
  const tools = countAgentTools(agent);
  const inHand = tasks ? countAgentInHand(agent, tasks) : null;

  return (
    <View className="flex-row items-stretch">
      <CountCell value={String(skills)} label="技能" />
      <Divider />
      <CountCell
        value={tools.state === "count" ? String(tools.count) : "——"}
        label="工具"
        muted={tools.state !== "count"}
      />
      <Divider />
      <CountCell value={inHand === null ? "——" : String(inHand)} label="在手" />
      {showScheduleSlot ? (
        <>
          <Divider />
          <CountCell value="——" label="定时" muted />
        </>
      ) : null}
    </View>
  );
}

function CountCell({
  value,
  label,
  muted = false,
}: {
  value: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <View className="flex-1 items-center gap-0.5 py-1">
      <Text
        className={`text-lg font-semibold leading-6 ${
          muted ? "text-muted-foreground/50" : "text-foreground"
        }`}
      >
        {value}
      </Text>
      <Text className="text-[10px] text-muted-foreground">{label}</Text>
    </View>
  );
}

function Divider() {
  return <View className="w-px bg-border" />;
}
