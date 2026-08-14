/**
 * New issue creation modal — manual only.
 *
 * Layout follows Apple Reminders / Linear iOS / Things 3: one vertical
 * scrolling form (title → description → property chips), no sticky bottom
 * toolbar. Property chips are part of the form, not pinned above keyboard.
 * MentionSuggestionBar floats above keyboard only when the user is mid-@.
 *
 * No markdown toolbar / upload buttons in v1: mobile users creating an
 * issue rarely format markdown, and attachment upload is deferred to a
 * later release (see plan-issue-majestic-rabin.md "skip uploads").
 *
 * Mention pipeline shares `useMentionInput` with `issue/[id]/new-comment.tsx`
 * — both surfaces produce canonical `[@name](mention://type/id)` markdown
 * recognised by util.ParseMentions on the server.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SubmitIssueButton } from "@/components/issue/submit-issue-button";
import { CreateFormAttributeRow } from "@/components/issue/create-form-attribute-row";
import { MentionSuggestionBar } from "@/components/issue/mention-suggestion-bar";
import { DescriptionField } from "@/components/issue/description-field";
import { MOBILE_PLACEHOLDER_COLOR } from "@/components/ui/input-tokens";
import { useCreateIssue } from "@/data/mutations/issues";
import { useNewIssueDraftStore } from "@/data/stores/new-issue-draft-store";
import { useMentionInput } from "@/lib/use-mention-input";

export default function NewIssueModal() {
  // 简报「让员工深挖」（M2-7）经 staff-picker?intent=dispatch 透传 title /
  // description 一次性预填：标题「调研：{简报标题}」+ 摘要引用块。仅 mount 时
  // 生效（seed 参数不参与受控回写）。
  const [title, setTitle] = useState("");
  const description = useMentionInput();
  // Attribute chips (status / priority / assignee / due date / project)
  // live in `useNewIssueDraftStore` so the new-issue-picker/* formSheet
  // routes can read and write the same values without a parent-child
  // React relationship. The store is reset on mount + on unmount so
  // re-opening the new-issue modal starts clean.
  const status = useNewIssueDraftStore((s) => s.status);
  const priority = useNewIssueDraftStore((s) => s.priority);
  const assignee = useNewIssueDraftStore((s) => s.assignee);
  const dueDate = useNewIssueDraftStore((s) => s.dueDate);
  const project = useNewIssueDraftStore((s) => s.project);
  const setAssignee = useNewIssueDraftStore((s) => s.setAssignee);
  const resetDraft = useNewIssueDraftStore((s) => s.reset);

  // Dispatch flow (staff-picker `?intent=dispatch`) hands the picked
  // employee over via URL params — the draft store can't carry it across
  // this transition because it's reset on mount below. Applied AFTER the
  // reset so a fresh open (or an open with stale params) never keeps a
  // previous selection. Only `agent` is produced today; the union check
  // keeps the seed safe if a future caller passes member/squad.
  const {
    assignee_type,
    assignee_id,
    title: seedTitle,
    description: seedDescription,
  } = useLocalSearchParams<{
    assignee_type?: string;
    assignee_id?: string;
    title?: string;
    description?: string;
  }>();

  useEffect(() => {
    resetDraft();
    if (
      (assignee_type === "member" ||
        assignee_type === "agent" ||
        assignee_type === "squad") &&
      typeof assignee_id === "string" &&
      assignee_id.length > 0
    ) {
      setAssignee({ type: assignee_type, id: assignee_id });
    }
    if (typeof seedTitle === "string" && seedTitle.length > 0) {
      setTitle(seedTitle);
    }
    if (typeof seedDescription === "string" && seedDescription.length > 0) {
      description.setText(seedDescription);
    }
    return () => {
      resetDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed 仅在 mount 时生效
  }, [resetDraft, setAssignee, assignee_type, assignee_id]);

  const createIssue = useCreateIssue();
  const isSubmitting = createIssue.isPending;

  const canSubmit = !isSubmitting && title.trim().length > 0;

  const onSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) return;
    const finalDescription = description.serialize().trim();
    try {
      await createIssue.mutateAsync({
        title: trimmedTitle,
        description: finalDescription || undefined,
        status,
        priority,
        ...(assignee
          ? { assignee_type: assignee.type, assignee_id: assignee.id }
          : {}),
        ...(dueDate ? { due_date: dueDate } : {}),
        ...(project ? { project_id: project.id } : {}),
      });
      router.back();
    } catch (err) {
      Alert.alert(
        "创建事项失败",
        err instanceof Error ? err.message : "未知错误",
      );
    }
  }, [
    title,
    description,
    status,
    priority,
    assignee,
    dueDate,
    project,
    createIssue,
  ]);

  const headerRight = useCallback(
    () => (
      <SubmitIssueButton
        disabled={!canSubmit}
        loading={isSubmitting}
        onPress={onSubmit}
      />
    ),
    [canSubmit, isSubmitting, onSubmit],
  );

  return (
    <>
      <Stack.Screen options={{ headerRight }} />
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pt-4 pb-6 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="事项标题"
            placeholderTextColor={MOBILE_PLACEHOLDER_COLOR}
            className="text-2xl font-semibold text-foreground py-2"
            autoFocus
            returnKeyType="next"
            editable={!isSubmitting}
          />
          <DescriptionField
            description={description}
            disabled={isSubmitting}
          />
          <CreateFormAttributeRow />
        </ScrollView>

        {/* Mention suggestions float above the keyboard only when the user
            types `@`. Self-hides via `if (!visible) return null` so it
            doesn't take space at rest. */}
        <MentionSuggestionBar {...description.suggestionBar} />
      </KeyboardAvoidingView>
    </>
  );
}
