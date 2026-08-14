# 全局状态与降级组件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** COD-37 新增 2 个可复用组件 —— `stat-placeholder`（统计缺失显示 `——`）+ 统一空态/错误/离线组件 —— 覆盖 6 态矩阵，供首页骨架（COD-32）及后续里程碑复用。

**Architecture:** 两个纯展示组件放在 `components/ui/`（PRD §9.2 已列名，≥3 调用方），复用现有 `Text` / `Button` / `Ionicons` + `THEME` token；百分比分母约束（PRD §13.1）抽成 `lib/format-percent.ts` 纯函数以便 vitest 单测。Loading/Refreshing 沿用现有骨架屏与下拉刷新模式，不做通用 spinner 组件（PRD §9.4 禁止全屏 spinner）。

**Tech Stack:** Expo 55 / RN 0.83 / TypeScript strict / NativeWind 4 / Tailwind 3.4 / Ionicons。

## Global Constraints

- 全部展示文案中文（PRD §9.5）；不引入 i18n。
- 新组件零硬编码 hex，只用语义 token（`text-muted-foreground` / `text-foreground` 等）。
- 可点区域 ≥44×44pt；纯图标按钮有 `accessibilityLabel`（PRD §9.4 无障碍基线）。
- 不新增依赖、不改后端契约、不动其他屏面逻辑。
- 组件文件名与 PRD §9.2 表格一致：`components/ui/stat-placeholder.tsx`。
- `——` 是缺失，`0` 是真的零；`undefined` 与 `0` 必须区分（PRD §9.4）。

---

### Task 1: `lib/format-percent.ts` — 百分比样本约束纯函数

**Files:**
- Create: `apps/mobile/lib/format-percent.ts`
- Test: `apps/mobile/lib/format-percent.test.ts`

**Interfaces:**
- Produces: `formatPercent(part: number, total: number): string | null`
  - `total <= 0` → `null`（无观测 = 缺失，调用方渲染 `StatPlaceholder`）
  - `0 < total < 5` → `"${part}/${total}"`（样本量，不显示百分比）
  - `total >= 5` → `"${Math.round((part / total) * 100)}%"`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { formatPercent } from "./format-percent";

describe("formatPercent", () => {
  it("returns null when total is 0 (missing, not zero)", () => {
    expect(formatPercent(0, 0)).toBeNull();
    expect(formatPercent(3, 0)).toBeNull();
  });

  it("shows the raw sample instead of a percentage when denominator < 5", () => {
    expect(formatPercent(2, 4)).toBe("2/4");
    expect(formatPercent(1, 3)).toBe("1/3");
  });

  it("returns a rounded percentage when denominator >= 5", () => {
    expect(formatPercent(3, 4 + 1)).toBe("60%"); // 3/5
    expect(formatPercent(5, 10)).toBe("50%");
    expect(formatPercent(1, 6)).toBe("17%");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/format-percent.test.ts`
Expected: FAIL with "module not found".

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Format a percentage with the PRD §13.1 sample-size guard.
 *
 * - total <= 0: no observations → no percentage exists (missing, not zero,
 *   §9.4) → returns null; callers render <StatPlaceholder />.
 * - 0 < total < 5: too few samples for a meaningful percentage → show the
 *   raw sample (e.g. "2/4") instead of a misleading "%".
 * - total >= 5: rounded percentage, e.g. "60%".
 */
export function formatPercent(part: number, total: number): string | null {
  if (total <= 0) return null;
  if (total < 5) return `${part}/${total}`;
  return `${Math.round((part / total) * 100)}%`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/format-percent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/format-percent.ts apps/mobile/lib/format-percent.test.ts
git commit -m "feat(mobile): add formatPercent with PRD 13.1 sample-size guard"
```

---

### Task 2: `components/ui/stat-placeholder.tsx` — 统计缺失统一占位

**Files:**
- Create: `apps/mobile/components/ui/stat-placeholder.tsx`

**Interfaces:**
- Consumes: `Text` from `@/components/ui/text`, `cn` from `@/lib/utils`
- Produces: `StatPlaceholder({ note?, className?, compact? })`
  - 与 COD-32 分支已用 API 兼容：`note?: string`（默认「部分统计接口未上线」）
  - `className?: string`、`compact?: boolean`（紧凑尺寸，供 metric-ring 格位）
  - 无障碍：`accessibilityLabel` 默认取 note

- [ ] **Step 1: Create the component**

```tsx
/**
 * Unified "missing statistic" placeholder — PRD §9.4 / §9.2.
 *
 * Renders `——` (em dash) + a 12px muted explanation. The dash is a
 * deliberate "missing / not-yet-available" marker: it must NOT be confused
 * with a real zero (§9.4 "`——` 是缺失，`0` 是真的零"). A 类决策数据（§0.4）
 * 无数据源时一律渲染本组件，禁止用 0 或假数字冒充。
 *
 * Used by the home report-card / brief-list skeletons in M1; dashboard
 * endpoints not yet shipped (PRD §10.2 B-1) render through this too.
 */
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface Props {
  /** 12px 弱色说明，默认「部分统计接口未上线」。传空字符串可隐藏。 */
  note?: string;
  /** 紧凑尺寸（metric-ring 等小格位）。 */
  compact?: boolean;
  className?: string;
}

const DEFAULT_NOTE = "部分统计接口未上线";

export function StatPlaceholder({
  note = DEFAULT_NOTE,
  compact = false,
  className,
}: Props) {
  return (
    <View
      className={cn("items-center justify-center gap-1", compact ? "py-1" : "py-3", className)}
      accessible
      accessibilityLabel={note || "暂无数据"}
    >
      <Text
        className={cn(
          "text-muted-foreground",
          compact ? "text-base leading-6" : "text-2xl leading-8",
        )}
      >
        ——
      </Text>
      {note ? (
        <Text className="text-xs text-muted-foreground/70">{note}</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Verify with typecheck**

Run: `pnpm typecheck` (in `apps/mobile`)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/ui/stat-placeholder.tsx
git commit -m "feat(mobile): add StatPlaceholder for A-class missing stats"
```

---

### Task 3: `components/ui/state-view.tsx` — 统一空态 / 错误 / 离线组件

**Files:**
- Create: `apps/mobile/components/ui/state-view.tsx`

**Interfaces:**
- Consumes: `Text`, `Button`, `Ionicons` + `useColorScheme` + `THEME`, `cn`
- Produces: `StateView({ kind, title?, description?, actionLabel?, onAction?, icon?, className? })`
  - `kind: "empty" | "error" | "offline"`
  - 默认值：empty→icon `file-tray-outline`（title 必填）；error→icon `alert-circle-outline`，title「加载失败」+「重试」；offline→icon `cloud-offline-outline`，title「网络未连接」
  - `onAction` + `actionLabel` 同时提供才渲染 CTA（一屏只有一个主 CTA）
  - CTA 按钮 `min-h-11 min-w-11` 满足 ≥44×44pt

- [ ] **Step 1: Create the component**

```tsx
/**
 * Unified empty / error / offline surface — PRD §9.4 6-state matrix.
 *
 * One layout, three kinds:
 *   - empty: 图标 + 一句话说明 + 一个可执行 CTA（PRD §9.4 Empty）
 *   - error: 一句人话 + 「重试」（PRD §9.4 Error；区块级失败只坏那一块）
 *   - offline: 无缓存可渲染时的兜底（有缓存走 Query 缓存渲染，不加横幅）
 *
 * Loading / Refreshing 不在此组件内：Loading 用贴合内容的骨架屏（§9.4 禁止
 * 全屏 spinner），Refreshing 用列表下拉刷新，均沿用现有模式。
 *
 * 无障碍（§9.4）：图标 `accessible={false}` 避免被读成符号名；CTA 按钮
 * min-h-11/min-w-11 ≥44×44pt。
 */
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type StateViewKind = "empty" | "error" | "offline";

type IconName = ComponentProps<typeof Ionicons>["name"];

const KIND_DEFAULTS: Record<
  StateViewKind,
  { icon: IconName; title: string; description?: string; actionLabel?: string }
> = {
  empty: { icon: "file-tray-outline", title: "", actionLabel: "" },
  error: {
    icon: "alert-circle-outline",
    title: "加载失败",
    description: "请检查网络后重试",
    actionLabel: "重试",
  },
  offline: {
    icon: "cloud-offline-outline",
    title: "网络未连接",
    description: "无法加载最新内容，请检查网络后重试",
    actionLabel: "重试",
  },
};

interface Props {
  kind: StateViewKind;
  /** 主文案（人话）。empty 必填；error/offline 有默认值。 */
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IconName;
  className?: string;
}

export function StateView({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: Props) {
  const { colorScheme } = useColorScheme();
  const d = KIND_DEFAULTS[kind];
  const resolvedTitle = title ?? d.title;
  const resolvedDescription = description ?? d.description;
  const showAction = Boolean(onAction && (actionLabel ?? d.actionLabel));

  return (
    <View className={cn("items-center justify-center px-6 py-8 gap-2.5", className)}>
      <View accessible={false} className="mb-1">
        <Ionicons
          name={icon ?? d.icon}
          size={40}
          color={THEME[colorScheme].mutedForeground}
          accessible={false}
        />
      </View>
      <Text className="text-sm font-medium text-foreground text-center">
        {resolvedTitle}
      </Text>
      {resolvedDescription ? (
        <Text className="text-sm text-muted-foreground text-center">
          {resolvedDescription}
        </Text>
      ) : null}
      {showAction ? (
        <Button
          variant="outline"
          size="sm"
          onPress={onAction}
          className="mt-1 min-h-11 min-w-11"
        >
          <Text>{actionLabel ?? d.actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Verify with typecheck**

Run: `pnpm typecheck` (in `apps/mobile`)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/ui/state-view.tsx
git commit -m "feat(mobile): add unified StateView for empty/error/offline"
```

---

### Task 4: 全量验证 + 收尾

- [ ] **Step 1: Run full verification**

Run (in `apps/mobile`): `pnpm typecheck && pnpm lint && pnpm test`
Expected: 全绿（`pnpm test` 至少含新增 `format-percent` 3 个用例）。

- [ ] **Step 2: Confirm git tracking**

Run: `git ls-files apps/mobile/lib/format-percent.ts apps/mobile/components/ui/stat-placeholder.tsx apps/mobile/components/ui/state-view.tsx`
Expected: 三个文件均在跟踪列表（新子目录规则，Lesson 2）。

- [ ] **Step 3: Final commit (if any stragglers)**

```bash
git add -A
git commit -m "chore(mobile): finalize global state components" || true
```

## Self-Review

**1. Spec coverage:**
- 新增 2 组件 ✓（Task 2 `stat-placeholder`、Task 3 `state-view`）
- 6 态齐全 ✓（Empty/Error/Offline→StateView；Partial→StatPlaceholder；Loading→骨架屏既有模式；Refreshing→下拉刷新既有模式）
- A 类数据不显示 0 ✓（StatPlaceholder + `formatPercent` 对 total<=0 返回 null）
- 百分比分母 < 5 显示样本量 ✓（Task 1）

**2. Placeholder scan:** 无 TBD/TODO；所有代码块完整。

**3. Type consistency:** `formatPercent(part, total): string | null` 在 Task 1 定义，后续不再引用；`StatPlaceholder({ note, compact, className })` 与 COD-32 分支已用 `note` API 兼容；`StateView` props 在 Task 3 内自洽。
