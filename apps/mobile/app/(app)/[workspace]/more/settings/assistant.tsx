/**
 * 秘书设置页 `/{slug}/more/settings/assistant`（PRD §8.4，M2-6 落地）。
 *
 * 项：
 *   - 默认数字员工：行 → `/{slug}/staff-picker?intent=default`；选中后经
 *     assistant-store 写 SecureStore（按 wsId）。配置失效（归档/不可见）自动
 *     清空并显示「未设置」（§8.5 验收）。
 *   - 长按录音时长阈值：Segmented 1s/2s/3s，默认 2s，本地持久化。
 *   - 松手后自动跳工作台：Switch，默认开，本地持久化。
 *   - 语音入口默认项：Segmented 录音/翻译/发语音，默认录音。
 *   - 简报推送偏好：占位（等后端 `/api/briefs` 契约，B-2）。
 *
 * `more/settings.tsx` 的 Appearance / Sign out 保持原位不动（PRD §8.4 注意）。
 *
 * 数据：agents / members 复用已有查询（0 新增请求）。SecureStore 读写异步，
 * 页面 mount 时 hydrate 一次。
 */
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useAuthStore } from "@/data/auth-store";
import { agentListOptions } from "@/data/queries/agents";
import { memberListOptions } from "@/data/queries/members";
import { useAssistantStore, type VoiceDefaultEntry } from "@/data/stores/assistant-store";
import { visibleStaffAgents } from "@/lib/staff-picker-rows";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";

const HOLD_OPTIONS = ["1s", "2s", "3s"];
const ENTRY_OPTIONS: { value: VoiceDefaultEntry; label: string }[] = [
  { value: "record", label: "录音" },
  { value: "translate", label: "翻译" },
  { value: "voice", label: "发语音" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-xs text-muted-foreground px-1">{title}</Text>
      <View className="rounded-md border border-border bg-card overflow-hidden">
        {children}
      </View>
    </View>
  );
}

export default function AssistantSettingsPage() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const userId = useAuthStore((s) => s.user?.id);

  const hydrate = useAssistantStore((s) => s.hydrate);
  const hydrated = useAssistantStore((s) => s.hydrated);
  const defaultAgentIds = useAssistantStore((s) => s.defaultAgentIds);
  const voicePrefs = useAssistantStore((s) => s.voicePrefs);
  const setDefaultAgent = useAssistantStore((s) => s.setDefaultAgent);
  const setHoldThreshold = useAssistantStore((s) => s.setHoldThreshold);
  const setAutoJumpWorkbench = useAssistantStore((s) => s.setAutoJumpWorkbench);
  const setVoiceDefaultEntry = useAssistantStore((s) => s.setVoiceDefaultEntry);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const { data: agents = [], isFetched: agentsFetched } = useQuery(
    agentListOptions(wsId),
  );
  const { data: members = [], isFetched: membersFetched } = useQuery(
    memberListOptions(wsId),
  );
  const memberRole = useMemo(
    () => members.find((m) => m.user_id === userId)?.role,
    [members, userId],
  );

  const configuredId = wsId ? defaultAgentIds[wsId] ?? null : null;

  // 可用员工口径与 voice-target / staff-picker 同源（§6.4 parity 点）：
  // 非归档 + `canAssignAgent` + runtime-bound。配置失效（归档 / 不可见 /
  // 无工位）→ 清空并显示「未设置」（§8.5 验收）。
  const visibleAgents = useMemo(
    () => visibleStaffAgents(agents, userId, memberRole),
    [agents, userId, memberRole],
  );

  // 评审修复（HIGH-1）：stale 判定必须在「store 已 hydrate + agents/members
  // 已拉取」之后进行 —— 否则 loading 期间 visibleAgents=[] 会把已配置的
  // 默认员工误判为失效并自动清空（写入 SecureStore 的 null）。
  const configReady = hydrated && agentsFetched && membersFetched;
  const staleConfigured =
    configReady &&
    Boolean(
      configuredId && !visibleAgents.some((a) => a.id === configuredId),
    );

  useEffect(() => {
    if (configReady && wsId && staleConfigured && configuredId) {
      void setDefaultAgent(wsId, null);
    }
  }, [configReady, wsId, staleConfigured, configuredId, setDefaultAgent]);

  const configuredAgent = !configReady
    ? null
    : staleConfigured
      ? null
      : agents.find((a) => a.id === configuredId) ?? null;

  const goPickDefault = () =>
    wsSlug &&
    router.push({
      pathname: "/[workspace]/staff-picker",
      params: { workspace: wsSlug, intent: "default" },
    });

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-4 gap-5"
    >
      <Section title="默认数字员工">
        <Pressable
          onPress={goPickDefault}
          className="flex-row items-center justify-between px-4 py-3.5 active:bg-secondary"
          accessibilityRole="button"
        >
          <Text className="text-base text-foreground">默认数字员工</Text>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-sm text-muted-foreground">
              {configuredAgent ? configuredAgent.name : "未设置"}
            </Text>
            <Text className="text-sm text-muted-foreground/60">›</Text>
          </View>
        </Pressable>
        <Text className="px-4 pb-3 text-xs text-muted-foreground/70">
          录音长按发送将发给该员工；未设置时使用第一位可用数字员工
        </Text>
      </Section>

      <Section title="语音">
        <View className="px-4 py-3 flex-row items-center justify-between">
          <Text className="text-base text-foreground flex-1">长按录音时长阈值</Text>
          <SegmentedControl
            values={HOLD_OPTIONS}
            selectedIndex={HOLD_OPTIONS.indexOf(`${voicePrefs.holdThresholdSeconds}s`)}
            onValueChange={(v) => {
              const sec = Number.parseInt(v, 10);
              if (Number.isFinite(sec)) void setHoldThreshold(sec);
            }}
            tintColor={t.brand}
            backgroundColor={t.secondary}
            style={{ width: 150, height: 28 }}
          />
        </View>
        <View className="px-4 py-3 flex-row items-center justify-between border-t border-border">
          <View className="flex-1 pr-3">
            <Text className="text-base text-foreground">松手后自动跳工作台</Text>
            <Text className="text-xs text-muted-foreground/70">发送后回到会话查看</Text>
          </View>
          <Switch
            checked={voicePrefs.autoJumpWorkbench}
            onCheckedChange={(c) => void setAutoJumpWorkbench(Boolean(c))}
          />
        </View>
        <View className="px-4 py-3 flex-row items-center justify-between border-t border-border">
          <Text className="text-base text-foreground flex-1">语音入口默认项</Text>
          <SegmentedControl
            values={ENTRY_OPTIONS.map((o) => o.label)}
            selectedIndex={ENTRY_OPTIONS.findIndex(
              (o) => o.value === voicePrefs.voiceDefaultEntry,
            )}
            onValueChange={(v) => {
              const match = ENTRY_OPTIONS.find((o) => o.label === v);
              if (match) void setVoiceDefaultEntry(match.value);
            }}
            tintColor={t.brand}
            backgroundColor={t.secondary}
            style={{ width: 150, height: 28 }}
          />
        </View>
      </Section>

      <Section title="简报">
        <View className="px-4 py-3.5">
          <Text className="text-sm text-muted-foreground">
            分类与推送时间 · 待后端简报接口上线（B-2）
          </Text>
        </View>
      </Section>
    </ScrollView>
  );
}
