/**
 * 行业简报 mock 数据源（PRD §10.6 Mock 管理约定）。
 *
 * 对应后端需求：**PRD §10.2 B-2**（行业简报，已确认后续对接）。接口上线后
 * 删除本文件即可 —— 类型 `Brief` 定义在 `data/queries/briefs.ts`，与 B-2
 * 契约字段完全一致，切换时组件零改动。
 *
 * 数据级别：B 类内容型（§0.4）—— UI 必须带「示例数据」徽标。COD-55 后本文件
 * 是每日 JSON 链路（`data/briefs/daily-source.ts`）的最后兜底：远程拉取失败、
 * 且本地缓存为空时渲染，此时 `source: "mock"`，徽标显示「示例数据」。
 *
 * 内容要求（§4.6 Mock 数据设计）：
 *   - 6–8 条；AI Infra / 竞品 / 政策 / 融资 各 1–2 条
 *   - 含 `high` / `medium` / `low` 三档相关度（验证首页竖条样式）
 *   - 时间用 `Date.now()` 相对偏移生成（不写死绝对时间）
 *   - ≥2 条含完整 Markdown（标题 / 列表 / 引用 / 代码块 / 链接）
 *   - 含 1 条超长标题、1 条超短正文；内容用真实行业口吻撰写
 */
import type { Brief } from "@/data/queries/briefs";

const h = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const MOCK_BRIEFS: Brief[] = [
  {
    id: "brief-ai-infra-01",
    workspace_id: "",
    category: "AI Infra",
    title: "xAI 发布 Grok-4，推理成本下降 40%，长上下文窗口翻倍",
    summary:
      "Grok-4 在多项基准上刷新纪录，API 定价下调 40%，对推理场景的性价比影响显著。",
    content: [
      "# Grok-4 发布：推理成本下降 40%",
      "",
      "xAI 今日发布 Grok-4，官方称在同等质量下推理成本较 Grok-3 下降 **40%**，上下文窗口从 256K 提升至 512K。",
      "",
      "## 关键变化",
      "",
      "- 定价：`$2 / 1M input tokens`，`$8 / 1M output tokens`",
      "- 上下文：512K tokens，支持更长代码库与文档",
      "- 多模态：原生图像输入，OCR 能力对齐 GPT-4o",
      "",
      "> 官方表示：『成本下降主要来自新的稀疏注意力架构与推理时量化，不是靠牺牲质量换来的。』",
      "",
      "## 对工程团队的影响",
      "",
      "如果你的 Agent 链路大量使用长文档摘要，Grok-4 的单次调用成本可能下降近一半。迁移前建议先跑自己的评测集：",
      "",
      "```bash",
      "curl -X POST https://api.x.ai/v1/chat/completions \\",
      "  -H \"Authorization: Bearer $XAI_KEY\" \\",
      "  -d '{\"model\":\"grok-4\",\"messages\":[{\"role\":\"user\",\"content\":\"用三句话总结仓库里的 CHANGELOG\"}]}'",
      "```",
      "",
      "详细基准见[官方公告](https://x.ai/blog/grok-4)。",
    ].join("\n"),
    source_url: "https://x.ai/blog/grok-4",
    source_name: "xAI 官方博客",
    published_at: h(2),
    read: false,
    relevance: "high",
  },
  {
    id: "brief-ai-infra-02",
    workspace_id: "",
    category: "AI Infra",
    title: "vLLM 发布 0.9，Prefix Caching 默认开启，推理吞吐提升 30%",
    summary:
      "vLLM 0.9 将 Prefix Caching 设为默认，多轮对话与 Agent 工具调用场景的吞吐明显提升。",
    content:
      "vLLM 0.9 发布，Prefix Caching 改为默认开启，官方测得的吞吐提升约 30%，多轮对话与 Agent 工具调用场景收益最大。",
    source_url: "https://github.com/vllm-project/vllm/releases",
    source_name: "GitHub Releases",
    published_at: h(9),
    read: false,
    relevance: "medium",
  },
  {
    id: "brief-competitor-01",
    workspace_id: "",
    category: "竞品",
    title: "Linear 上线 AI Triage 2.0：按工作流自动分派 Issue",
    summary:
      "Linear 的 AI Triage 现在能按团队自定义工作流自动分派 Issue，并给出置信度与原因。",
    content:
      "Linear 上线 AI Triage 2.0，可按团队自定义工作流自动分派 Issue，并在派单前给出置信度与简短原因。这与「数字员工自动接单」方向直接相关，值得持续跟进其采纳率与误派率。",
    source_url: "https://linear.app/changelog",
    source_name: "Linear Changelog",
    published_at: h(5),
    read: false,
    relevance: "high",
  },
  {
    id: "brief-competitor-02",
    workspace_id: "",
    category: "竞品",
    title: "Notion 发布 AI Q&A，可直接检索团队知识库并给出带引用的答案",
    summary: "Notion 的 AI Q&A 打通知识库检索，答案带引用来源，瞄准企业内部知识管理场景。",
    content: "Notion 发布 AI Q&A，可直接检索团队知识库并给出带引用的答案。",
    source_url: "https://www.notion.so/blog",
    source_name: "Notion Blog",
    published_at: h(30),
    read: false,
    relevance: "low",
  },
  {
    id: "brief-policy-01",
    workspace_id: "",
    category: "政策",
    title: "欧盟《AI 法案》高风险分类细则生效：企业内部自动化工具须登记透明度信息",
    summary:
      "欧盟 AI 法案的高风险分类细则本周生效，涉及企业内部自动化与任务分派系统的登记要求。",
    content: [
      "# 欧盟《AI 法案》高风险分类细则生效",
      "",
      "本周起，被归为「高风险」的 AI 系统需在欧盟数据库中登记透明度信息。细则明确把**就业场景的自动化决策**（包括任务分派、绩效评估）列入高风险。",
      "",
      "## 需要关注的条款",
      "",
      "1. 对员工产生重大影响的自动化决策系统须登记；",
      "2. 必须提供「人工复核」入口（与 HITL 原则一致）；",
      "3. 过渡期 24 个月，逾期未登记可能面临营业额 2% 的罚款。",
      "",
      "> 对我们的启示：把「人类可介入」做进产品设计，不只是合规要求，也是差异化。",
    ].join("\n"),
    source_url: "https://artificialintelligenceact.eu",
    source_name: "AI Act Tracker",
    published_at: h(26),
    read: false,
    relevance: "medium",
  },
  {
    id: "brief-policy-02",
    workspace_id: "",
    category: "政策",
    title: "中国发布生成式 AI 服务备案指引更新，明确 Agent 类产品需标注输出来源",
    summary:
      "备案指引更新：Agent 类产品在向用户提供自动化输出时须标注生成来源，并保留 30 天日志。",
    content: "备案指引更新，Agent 类产品须在输出中标注来源并保留 30 天日志。",
    source_url: null,
    source_name: "网信办",
    published_at: h(50),
    read: false,
    relevance: "medium",
  },
  {
    id: "brief-funding-01",
    workspace_id: "",
    category: "融资",
    title: "AI Agent 平台 CrewAI 完成 1.2 亿美元 B 轮，估值 30 亿美元",
    summary: "CrewAI 完成 B 轮融资，聚焦多智能体协作框架的工程化与托管服务。",
    content: "AI Agent 平台 CrewAI 完成 1.2 亿美元 B 轮融资，估值 30 亿美元，资金将投入多智能体协作框架的工程化与托管服务。",
    source_url: "https://www.crewai.com",
    source_name: "CrewAI",
    published_at: h(12),
    read: false,
    relevance: "low",
  },
  {
    id: "brief-funding-02",
    workspace_id: "",
    category: "融资",
    title: "开源推理框架 vLLM 背后的公司融资 4000 万美元，加速企业级推理优化",
    summary: "vLLM 背后的公司完成 4000 万美元融资，加速企业级推理优化与模型服务产品化。",
    content: "vLLM 背后的公司完成 4000 万美元融资，加速企业级推理优化与模型服务产品化。",
    source_url: null,
    source_name: "TechCrunch",
    published_at: h(72),
    read: false,
    relevance: "low",
  },
];
