/**
 * Board 视图 A — horizontal pager of status columns (PRD §5.2).
 *
 * Page width = screen width − 32 so the next column peeks 16px on each side
 * as a swipe affordance. `snapToInterval` snaps each page to a whole column
 * (acceptance: "横向分页每次停在整列，不出现半列"). The dot indicator + the
 * "‹ 2/6 ›" page label in the current column's header stay in sync via the
 * onMomentumScrollEnd-derived index.
 *
 * No drag-to-reorder: mobile's three gestures (horizontal page + vertical
 * scroll + cross-page drag) would swallow each other. Status changes go
 * through the long-press ActionSheet on each card (PRD §5.2 rationale).
 */
import { useRef, useState } from "react";
import { FlatList, View, useWindowDimensions } from "react-native";
import type { Issue, Project } from "@multica/core/types";
import { BoardColumn } from "./board-column";
import type { BoardStatusSection } from "@/data/queries/board";
import { cn } from "@/lib/utils";

/** 露出下一列的边缘宽度 = 屏宽 − 页宽。 */
const PAGE_PEEK = 32;

interface Props {
  sections: BoardStatusSection[];
  projects: Project[];
  onPressIssue: (issue: Issue) => void;
  onReassignIssue: (issue: Issue) => void;
}

export function BoardColumns({
  sections,
  projects,
  onPressIssue,
  onReassignIssue,
}: Props) {
  const { width } = useWindowDimensions();
  const pageWidth = width - PAGE_PEEK;
  const listRef = useRef<FlatList<BoardStatusSection>>(null);
  const [page, setPage] = useState(0);

  const onMomentumScrollEnd = ({
    nativeEvent,
  }: {
    nativeEvent: { contentOffset: { x: number } };
  }) => {
    const index = Math.round(nativeEvent.contentOffset.x / pageWidth);
    setPage(Math.max(0, Math.min(index, sections.length - 1)));
  };

  return (
    <View className="flex-1">
      <FlatList
        ref={listRef}
        horizontal
        data={sections}
        keyExtractor={(s) => s.status}
        renderItem={({ item, index }) => (
          <BoardColumn
            status={item.status}
            issues={item.data}
            projects={projects}
            width={pageWidth}
            pageLabel={
              index === page ? `‹ ${page + 1}/${sections.length} ›` : undefined
            }
            onPressIssue={onPressIssue}
            onReassignIssue={onReassignIssue}
          />
        )}
        snapToInterval={pageWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: pageWidth,
          offset: pageWidth * index,
          index,
        })}
      />
      <View className="flex-row justify-center gap-1.5 py-2.5">
        {sections.map((s, i) => (
          <View
            key={s.status}
            className={cn(
              "size-1.5 rounded-full",
              i === page ? "bg-foreground" : "bg-muted-foreground/30",
            )}
          />
        ))}
      </View>
    </View>
  );
}
