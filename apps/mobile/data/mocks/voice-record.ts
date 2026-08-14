/**
 * 语音 → 录音子页的 Mock 示例文本（PRD §6.3 / §10.6）。
 *
 * 对应后端需求：B-2（语音链路：录音 → ASR → 文本，本期未对接）。
 * B 类 mock 数据——界面必须带「原型 · 功能开发中」标识，标识与 `USE_MOCK_*`
 * 常量同源（PRD §13.3）。示例文本为相对生成，不绑定具体日期。
 */
export const VOICE_RECORD_MOCK_TRANSCRIPT: readonly string[] = [
  "帮我查一下这周有哪些待办事项还没完成。",
  "顺便把下周一的项目评审会安排到日程里。",
  "今天下午三点有一个客户电话，记得提前提醒我。",
  "把产品需求文档里第三章的接口说明补充完整。",
  "周五之前需要提交季度总结报告。",
];

/** 录音 Dock 的等宽计时初值（<1h 用 MM:SS，≥1h 用 HH:MM:SS）。 */
export const VOICE_RECORD_TIMER_INIT = "00:00";
