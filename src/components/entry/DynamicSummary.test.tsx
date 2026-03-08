import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DynamicSummary } from "./DynamicSummary";

describe("DynamicSummary", () => {
  it("renders stage-based timeline evolution events", () => {
    const html = renderToStaticMarkup(
      <DynamicSummary
        summaryStructure={{
          type: "timeline-evolution",
          reasoning: "内容描述的是多轮设计演进，适合按阶段展示。",
          fields: {
            events: [
              {
                stage: "征询能力设计",
                initialApproach: "在 ExitPlanTool 中加入计划与问题列表参数。",
                problem: "计划与提问耦合，用户回答后状态容易冲突。",
                iteration: "尝试改成 Markdown 输出格式约束。",
                finalChoice: "改为专门的 AskUserQuestion 工具。",
              },
            ],
            currentStatus: "当前方案更强调结构化提问与动态任务编排。",
            futureOutlook: "未来会继续朝更低认知负担和更高自治性演进。",
          },
        }}
        keyPoints={null}
        boundaries={null}
        difficulty="MEDIUM"
        confidence={0.95}
      />
    );

    expect(html).toContain("征询能力设计");
    expect(html).toContain("在 ExitPlanTool 中加入计划与问题列表参数。");
    expect(html).toContain("改为专门的 AskUserQuestion 工具。");
  });

  it("preserves legacy date-based timeline events", () => {
    const html = renderToStaticMarkup(
      <DynamicSummary
        summaryStructure={{
          type: "timeline-evolution",
          fields: {
            events: [
              {
                date: "2026-03-07",
                version: "v2.0",
                title: "结构重构",
                description: "统一了 summaryStructure 的动态展示逻辑。",
                significance: "major",
              },
            ],
          },
        }}
        keyPoints={null}
        boundaries={null}
        difficulty="MEDIUM"
        confidence={0.8}
      />
    );

    expect(html).toContain("2026-03-07");
    expect(html).toContain("结构重构");
    expect(html).toContain("统一了 summaryStructure 的动态展示逻辑。");
  });

  it("renders narrative timeline evolution fields from string-array payloads", () => {
    const html = renderToStaticMarkup(
      <DynamicSummary
        summaryStructure={{
          type: "timeline-evolution",
          reasoning: "内容是连续演进过程，适合用时间线总结。",
          fields: {
            events: [
              "团队先尝试把提问逻辑塞进 ExitPlanTool。",
              "随后改成专用 AskUserQuestion 工具。",
            ],
            stages: [
              "征询能力从输出格式约束演进到结构化提问。",
              "任务管理从 TodoWrite 演进到 Task 工具。",
            ],
            background: "文章围绕 Claude Code 的 Agent 工程实践展开。",
            currentStatus: "当前方案更强调主动搜索与结构化交互。",
            decisionLogic: "判断标准是模型是否真正会用、愿意用、且认知负担可控。",
            outcome: "形成了少加工具、更多复用和渐进式披露的设计哲学。",
            insight: "优秀 Agent 系统需要随着模型能力变化持续重构。",
            futureOutlook: "未来会继续向更高自治性演进。",
          },
        }}
        keyPoints={null}
        boundaries={null}
        difficulty="MEDIUM"
        confidence={0.94}
      />
    );

    expect(html).toContain("征询能力从输出格式约束演进到结构化提问。");
    expect(html).toContain("团队先尝试把提问逻辑塞进 ExitPlanTool。");
    expect(html).toContain("文章围绕 Claude Code 的 Agent 工程实践展开。");
    expect(html).toContain("判断标准是模型是否真正会用、愿意用、且认知负担可控。");
    expect(html).toContain("未来会继续向更高自治性演进。");
  });
});
