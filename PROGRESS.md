# ai_info_practice 项目进度记录

> 里程碑级状态索引。会话级交接细节记录在 `PROGRESS.log`。

## 📍 当前状态（2026-03-08）

### 最近完成
- ✅ CRS Provider SSE 流式响应支持（修复集成问题）
- ✅ Agent 模式对比功能（完整实现，前后端，已上线）
  - ✅ 后端：Prisma Schema + API Routes + Inngest 任务（Codex Round 6 评审，8.9/10）
  - ✅ 前端：批量选择 + 对比弹窗 + 结果页面 + 详情页面（Task 7-11）
  - ✅ E2E 测试：6 个测试场景，覆盖完整流程
  - ✅ 单元测试：136 个测试全部通过
  - ✅ 文档：用户指南 + API 参考（Task 12）
- ✅ Phase 3a: 结果评分 Agent（经 3 轮 Codex 评审，9/10 分）

### 活跃分支
- `main`（主线）

### 重构脉络总览

#### 1. Framework Refactor（框架统一）
| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 0 | 对象存储迁移（Cloudflare R2）| ✅ 已完成 |
| Phase 1 | Vercel AI SDK 统一 | ✅ 已完成 |
| Phase 2 | Inngest 任务队列 | ✅ 已完成 |
| Phase 3 | Jina Reader 网页解析 | ✅ 已完成 |
| Phase 4 | 清理与稳定化 | ✅ 已完成 |
| Phase 5+ | 条件触发型任务（见 Backlog）| ⏸ 待触发 |

#### 2. ReAct Agent 升级（功能增强）
| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 接口重构（v2.13）| ✅ 已完成 |
| Phase 2a | 工具激活 + 灰度监控 | ✅ 已完成 |
| Phase 2b-1 | 两步模式动态输出 | ✅ 已完成 |
| Phase 2b-2 | tool-calling 模式动态输出 | ✅ 已完成 |
| Phase 2c | 提示词优化（few-shot）| ✅ 已完成 |
| Phase 2d | 简单循环 | ⏸ 暂不实施 |
| **Phase 3a** | **结果评分 Agent** | ✅ 已完成 |

#### 3. Provider 扩展（多模型支持）
| Phase | 内容 | 状态 |
|-------|------|------|
| CRS Provider | CRS API 集成（SSE 流式响应）| ✅ 已完成 |

### 当前待办
1. **mode-comparison 评分优化**: 修复 CRS Provider 评分 schema 验证问题（已完成调试，待优化）
   - 问题：CRS 返回的 JSON 被 markdown 包裹，且 issues/suggestions 数组超限
   - 临时方案：放宽 schema 限制（20个），使用 generateText + 手动清理
   - 优化方向：改进 prompt 或切换评分模型
2. **trace-summary 修复**: 修复 entry 详情页 tool-calling 结果不可见（已规划）
3. **sdk-tools 单元测试**: 覆盖工具上下文传递（1-2h）
4. **Prompt Learning 流水线**: 将 Phase 2c 效果验证改造为自动化流水线（待规划）

### 已知问题
- CRS Provider 不支持结构化输出，tool-calling 模式已自动禁用
- Inngest worker 在某些情况下可能处理较慢（待优化）

---

## 阶段总览

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 1: 基础架构 | ✅ 已完成 | Next.js + Prisma + Gemini API |
| Phase 2: AI 处理管道 | ✅ 已完成 | L1/L2/L3 处理流程 |
| Phase 3: 前端界面 | ✅ 已完成 | 知识库、练习队列、详情页 |
| Phase 4: 工程规范 | ✅ 已完成 | 协作文档、测试覆盖、架构文档 |
| Framework Refactor | ✅ Phase 0-4 完成 | 框架统一、队列持久化 |
| ReAct Agent 升级 | ✅ Phase 2c 完成 | Phase 1-2c 完成 |

### 功能分支状态

| 方向 | 状态 |
|------|------|
| 前端层级管理 | ✅ 已合并 |
| Agent 透明化 | ✅ 已合并 |
| 系统性升级 Batch 1-3 | ✅ 已合并 |
| Framework Refactor Phase 0-4 | ✅ 已合并 |
| ReAct Agent Phase 1-2c | ✅ 已合并到 main |
| CRS Provider 集成 | ✅ 已合并到 main |

---

## 📊 测试覆盖

| 模块 | 测试数 |
|------|--------|
| parser | 8 |
| ai/agent | 18 |
| gemini | 5 |
| ingest | 7 |
| entries | 2 |
| sanitize | 10 |
| deduplication | 7 |
| **总计** | **57** |

---

## 🔜 项目待办

### 当前冲刺
1. **trace-summary 修复**: 修复 entry 详情页 tool-calling 结果不可见（已规划）
2. **sdk-tools 单元测试**: 覆盖工具上下文传递（1-2h）
3. **mode-comparison 回归测试**: process-entry 不可变基线测试（P2，非阻塞）

### Backlog（条件触发）
| 任务 | 触发条件 |
|------|----------|
| pgvector 向量检索 | 去重精度需求明确 |
| Entry 模型拆分 | 双写稳定 1 个月后 |
| Unstructured PDF 解析 | 复杂 PDF 需求出现 |
| OpenTelemetry 监控 | 性能问题出现 |

### 功能增强
- Prompt Learning 流水线（自动化提示词优化）
- E2E 测试补充

---

## 📚 规划文档索引

### 框架重构
- [Framework Refactor Plan](docs/archive/2026-Q1/completed-plans/2026-02-27-framework-refactor-plan.md) - Phase 0-4 + 后续 5-8

### ReAct Agent 升级
- [Phase 1 最终方案](docs/archive/2026-Q1/react-agent-phase2/2026-03-01-react-agent-upgrade-v2.13-final.md) - 接口重构
- [Phase 2 渐进式实施](docs/archive/2026-Q1/completed-plans/2026-03-02-react-agent-phase2-progressive.md) - Phase 2a-2d 规划
- [15 轮迭代复盘](docs/retrospectives/2026-03-02-react-agent-upgrade-15-iterations.md) - 经验总结

### 活跃规划
- [mode-comparison 设计](docs/plans/2026-03-06-mode-comparison-design.md) - 模式对比功能设计
- [mode-comparison 实施](docs/plans/2026-03-06-mode-comparison-implementation.md) - 实施计划（后端已完成）
- [trace-summary 修复](docs/plans/2026-03-07-trace-summary-tool-calling.md) - 详情页可观测性提升

### 归档
- [react-agent-iterations/](docs/archive/react-agent-iterations/) - v1-v2.12 迭代历史
- [react-agent-phase2/](docs/archive/2026-Q1/react-agent-phase2/) - Phase 2 子阶段实施计划
- [codex-reviews/](docs/archive/2026-Q1/codex-reviews/) - Codex 评审记录
- [completed-plans/](docs/archive/2026-Q1/completed-plans/) - 已完成规划文档

---

*最后更新: 2026-03-08*
