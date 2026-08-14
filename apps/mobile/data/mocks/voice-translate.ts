/**
 * 语音 → 翻译子页的 Mock 示例文本（PRD §6.3 / §10.6）。
 *
 * 对应后端需求：B-2（翻译链路，本期未对接）。
 * B 类 mock 数据——界面必须带「原型 · 功能开发中」标识，标识与 `USE_MOCK_*`
 * 常量同源（PRD §13.3）。示例文本为相对生成，不绑定具体日期。
 */
export const VOICE_TRANSLATE_MOCK_PAIRS: readonly {
  lang: string;
  said: string;
  translated: string;
}[] = [
  {
    lang: "中 → 英",
    said: "请把这份合同今天下午寄出去。",
    translated: "Please send this contract out this afternoon.",
  },
  {
    lang: "英 → 中",
    said: "Could you confirm the delivery date?",
    translated: "你能确认一下交货日期吗？",
  },
  {
    lang: "中 → 日",
    said: "价格还能再优惠一点吗？",
    translated: "価格をもう少し値引きしていただけますか。",
  },
];

/** 语言对选择 chips（翻译子页顶部）。 */
export const VOICE_TRANSLATE_LANG_CHIPS: readonly string[] = [
  "中 → 英",
  "英 → 中",
  "中 → 日",
  "日 → 中",
];
