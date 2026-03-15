# ai_info_practice 项目进度记录

> 里程碑级状态索引。会话级交接细节记录在 `PROGRESS.log`。

## 📍 当前状态（2026-03-15）

### 进行中
- 无活跃任务

### 最近完成
- ✅ **CRS disableStorage 清理**（2026-03-15，已合并推送）
  - 移除 CRSConfig.disableStorage 字段，硬编码 store: false
  - CRS API 不再支持存储，彻底清理遗留开关
- ✅ **/comparison 页面重设计：批次视图→条目级视图**（2026-03-14，已部署）
  - 7 文件（6 新建 + 1 修改），经 Codex 三层评审
  - 修复全部 P1 类型安全问题 + useGlobalComparisons 竞态条件
- ✅ **Phase 2: Entry 详情页对比历史 Tab**（2026-03-11）
- ✅ **Phase 3: Settings Multi-Provider Credential Management**（2026-03-11，37 文件，6496+ 行）
- ✅ **Comparison History 批次列表页**（2026-03-11，28 文件，3721+ 行）
- ✅ **Mode-Comparison 前端增强**（2026-03-10，28 文件，4251+ 行）
- ✅ **Trace / Summary / Tool-Calling 可观测性修复**（2026-03-07，18 文件）
- ✅ **CRS Provider SSE 流式响应**、**Agent 模式对比**、**Phase 3a 评分 Agent** — 均已合并

### 活跃分支
- `main`（主线，最新部署 adaeac0）

### 已知问题
- CRS Provider 不支持结构化输出，tool-calling 模式已自动禁用
- Inngest worker 在某些情况下可能处理较慢（待优化）

---

## 阶段总览

所有基础阶段（Phase 1-4）、Framework Refactor（Phase 0-4）、ReAct Agent 升级（Phase 1-3a）、CRS Provider 集成均已完成并合并到 main。详见重构脉络总览（上方"最近完成"）。

---

## 📊 测试覆盖

| 指标 | 状态 |
|------|------|
| **测试文件** | 42 passed |
| **测试用例** | 306 passed |
| **通过率** | 100% |

**最近验证**: 2026-03-13 — Type Check ✅ / Lint ✅ / Unit Tests 306/306 ✅

---

## 🔜 项目待办

### 当前冲刺
- 无活跃任务

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

### 归档（含已完成规划）
- [react-agent-iterations/](docs/archive/react-agent-iterations/) - v1-v2.12 迭代历史
- [react-agent-phase2/](docs/archive/2026-Q1/react-agent-phase2/) - Phase 2 子阶段实施计划
- [codex-reviews/](docs/archive/2026-Q1/codex-reviews/) - Codex 评审记录
- [completed-plans/](docs/archive/2026-Q1/completed-plans/) - 已完成规划文档

---

*最后更新: 2026-03-15*
