# ai_info_practice 项目进度记录

> 里程碑级状态索引。会话级交接细节记录在 `PROGRESS.log`。

## 📍 当前状态（2026-03-06）

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

#### 3. Provider 扩展（多模型支持）
| Phase | 内容 | 状态 |
|-------|------|------|
| CRS Provider | CRS API 集成 | ✅ 已完成 |

### 当前待办
1. **扩大测试样本**: 测试 3-5 篇不同类型文章验证 Phase 2c 效果
2. **sdk-tools 单元测试**: 覆盖工具上下文传递（1-2h）
3. **Phase 2c 后续优化**: 根据测试结果决定是否继续优化

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
| ReAct Agent Phase 1-2b | 🚧 待合并 |

---

## 📊 测试覆盖

| 模块 | 测试数 |
|------|--------|
| parser | 8 |
| ai/agent | 17 |
| gemini | 5 |
| ingest | 7 |
| entries | 2 |
| sanitize | 10 |
| deduplication | 7 |
| **总计** | **56** |

---

## 🔜 项目待办

### 当前冲刺
1. **Phase 2c**: 提示词优化（few-shot 示例）
2. **sdk-tools 单元测试**: 覆盖工具上下文传递
3. **分支合并**: feature/iteration-upgrade → main

### Backlog（条件触发）
| 任务 | 触发条件 |
|------|----------|
| pgvector 向量检索 | 去重精度需求明确 |
| Entry 模型拆分 | 双写稳定 1 个月后 |
| Unstructured PDF 解析 | 复杂 PDF 需求出现 |
| OpenTelemetry 监控 | 性能问题出现 |

### 功能增强
- 双 Provider UI 切换（local-proxy / gemini）
- E2E 测试补充

---

## 📚 规划文档索引

### 框架重构
- [Framework Refactor Plan](docs/plans/2026-02-27-framework-refactor-plan.md) - Phase 0-4 + 后续 5-8

### ReAct Agent 升级
- [Phase 1 最终方案](docs/archive/2026-Q1/react-agent-phase2/2026-03-01-react-agent-upgrade-v2.13-final.md) - 接口重构
- [Phase 2 渐进式实施](docs/plans/2026-03-02-react-agent-phase2-progressive.md) - Phase 2a-2d 规划
- [15 轮迭代复盘](docs/retrospectives/2026-03-02-react-agent-upgrade-15-iterations.md) - 经验总结

### 归档
- [react-agent-iterations/](docs/archive/react-agent-iterations/) - v1-v2.12 迭代历史
- [react-agent-phase2/](docs/archive/2026-Q1/react-agent-phase2/) - Phase 2 子阶段实施计划

---

*最后更新: 2026-03-04*
