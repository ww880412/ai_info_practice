# ai_info_practice 项目进度记录

> 里程碑级状态索引。会话级交接细节记录在 `PROGRESS.log`。

## 📍 当前状态（2026-03-13）

### 进行中
- 无活跃任务

### 最近完成
- ✅ **Trace / Summary / Tool-Calling 可观测性修复**（2026-03-07，已合并到 main）
  - ✅ tool-calling fallback metadata 修复（engine.ts）
  - ✅ ReasoningTraceView 升级（展示 intent/mode/fallback 信息）
  - ✅ DynamicSummary + TimelineEvolution 兼容新 shape
  - ✅ summary-structure 后端校验/normalize
  - ✅ sdk-tools + decision-schema 测试覆盖
  - ✅ 代码规模：18 个文件，771 行新增代码
- ✅ **Phase 2: Entry 详情页对比历史 Tab**（2026-03-11，已合并到 main）
  - ✅ Task 1-2: Schema Update & Batch Creation（entryIds 字段追踪）
    - ✅ 添加 entryIds String[] 字段到 ComparisonBatch
    - ✅ 添加 GIN 索引用于高效数组查询
    - ✅ 创建 migration 和 backfill 脚本
    - ✅ 更新批次创建逻辑填充 entryIds
    - ✅ Codex 评审：7/10 → 修复 4 个问题后通过
  - ✅ Task 3: API Route - GET /api/entries/[id]/comparisons
    - ✅ 支持查询参数：status, limit, offset, sort, order, from, to
    - ✅ 处理 in-progress 批次（nullable scores）
    - ✅ 从 QualityEvaluation JSON 提取 overallScore
    - ✅ 11 个测试用例覆盖所有场景
    - ✅ Codex 评审：6/10 → 修复 3 个问题后通过
  - ✅ Task 4-5: UI Components & Entry Page Integration
    - ✅ useComparisonHistory hook（React Query）
    - ✅ ComparisonCard 组件（状态/分数/winner badge）
    - ✅ ComparisonHistoryTab 组件（过滤器/分页/日期范围）
    - ✅ 集成到 Entry 详情页（新增 Comparison History tab）
    - ✅ 响应式设计 + 无障碍支持
  - ✅ Codex 最终评审：6/10 → 修复 5 个关键问题 → 8-9/10
    - ✅ 修复卡片链接路由（batch vs per-entry views）
    - ✅ 添加日期范围过滤器（from/to date inputs）
    - ✅ 添加 GIN 索引优化查询性能
    - ✅ 修复 tab 标签和测试类型
  - ✅ 代码规模：17 个文件，1392+ 行新增代码
  - ✅ 生产就绪：所有验收标准达成
- ✅ **Phase 3: Settings Multi-Provider Credential Management System**（2026-03-11，已合并到 main）
  - ✅ 所有 7 个任务完成并通过 Codex 评审
  - ✅ Task 1: Database Schema Extension（Prisma migration + backfill script）
  - ✅ Task 2: SSRF Protection Module（57 tests, Codex 10/10）
  - ✅ Task 3: CRUD API Endpoints（4 endpoints + validation, encryption fixes）
  - ✅ Task 4: AI Client Integration（isActive check + default credential helper）
  - ✅ Task 5: Frontend Components（3 components, 31+ tests, Codex fixes applied）
  - ✅ Task 6: Seeding & Auto-Repair（seed script + auto-repair function）
  - ✅ Task 7: Testing & Documentation（user guide + QA checklist）
  - ✅ TypeScript 编译通过，所有类型错误已修复
  - ✅ 代码规模：37 个文件，6496+ 行代码
- ✅ **Settings Multi-Provider Task 7: Testing & Documentation**（2026-03-11）
  - ✅ 测试验证：5 个测试套件（credentials API, SSRF, encryption, get-default-credential, components）
  - ✅ 用户文档：完整的 settings-user-guide.md（添加/编辑/删除/测试/安全最佳实践/故障排除）
  - ✅ QA 检查清单：10 个测试类别，100+ 测试项（settings-qa-checklist.md）
  - ✅ 环境变量文档：更新 .env.example（KEY_ENCRYPTION_SECRET, CRS_BASE_URL_PATTERN, OPENAI_COMPATIBLE_ALLOWLIST）
  - ✅ 文档覆盖：用户指南、环境变量参考、安全最佳实践、故障排除指南、FAQ
  - ✅ 准备就绪：所有 7 个任务完成，待 Codex 评审
- ✅ **Settings Multi-Provider Task 5: Frontend Components**（2026-03-11）
  - ✅ CredentialCard 组件：3-state 状态显示（Valid/Invalid/Not validated）
  - ✅ CredentialForm 组件：创建/编辑表单，客户端验证
  - ✅ CredentialList 组件：React Query 集成，CRUD 操作
  - ✅ Settings 页面：多 Provider 凭证管理 UI
  - ✅ 组件测试：CredentialCard.test.tsx + CredentialForm.test.tsx
  - ✅ 功能：Add/Edit/Delete/Test/Set Default，加载状态，错误处理，空状态
- ✅ **Settings Multi-Provider Task 3: CRUD API Endpoints**（2026-03-11）
  - ✅ 请求验证模块：provider allowlist, name/apiKey/baseUrl/config 验证
  - ✅ 加密模块：AES-256-GCM 加密/解密，keyHint 生成
  - ✅ 凭证验证：支持 gemini/crs/openai-compatible，5s 超时
  - ✅ GET /api/settings/credentials - 列出活跃凭证
  - ✅ POST /api/settings/credentials - 创建（含重名检查、SSRF 防护、事务）
  - ✅ PUT /api/settings/credentials/[id] - 更新（含事务）
  - ✅ DELETE /api/settings/credentials/[id] - 软删除
  - ✅ POST /api/settings/credentials/[id]/validate - 验证凭证
  - ✅ 综合测试套件：validation, encryption, SSRF integration
  - ✅ 安全特性：encryptedKey 永不返回，软删除，验证超时
- ✅ **Comparison History 批次列表页**（2026-03-11，已合并）
  - ✅ 数据库迁移：新增 ComparisonMode 和 BatchStatus 枚举
  - ✅ 批次历史列表页 `/comparison` 支持分页和状态过滤
  - ✅ API 端点 `/api/comparison/batches` 完整实现
  - ✅ 导航集成：Navbar 链接 + Toast 通知
  - ✅ 共享查询函数和完整测试覆盖
  - ✅ 7 个任务全部通过 Codex 评审（并行执行）
  - ✅ 代码规模：28 个文件，3721+ 行代码
- ✅ **Mode-Comparison 前端增强**（2026-03-10，已部署）
  - ✅ 规范化层：统一新旧字段格式，处理数据兼容性（normalize.ts + 12 个单元测试）
  - ✅ 6 个对比维度卡片：基础分类、核心摘要、关键要点、结构化内容、边界定义、元数据
  - ✅ 结构化内容动态渲染：支持 timeline-evolution，未知类型自动降级（GenericStructureRenderer）
  - ✅ 响应式布局：桌面端双列，移动端单列，完整边界测试（5 个场景）
  - ✅ 文档更新：用户指南 v2.0 + 边界测试报告
  - ✅ Codex 评审：发现并修复 3 个 HIGH 级别问题（StructureCard 渲染、类型路由、字段匹配）
  - ✅ 已合并到 main 并部署（28 个文件，4251+ 行代码）
- ✅ CRS Provider SSE 流式响应支持（修复集成问题）
- ✅ Agent 模式对比功能（完整实现，前后端，已上线）
  - ✅ 后端：Prisma Schema + API Routes + Inngest 任务（Codex Round 6 评审，8.9/10）
  - ✅ 前端：批量选择 + 对比弹窗 + 结果页面 + 详情页面（Task 7-11）
  - ✅ E2E 测试：6 个测试场景，覆盖完整流程
  - ✅ 单元测试：136 个测试全部通过
  - ✅ 文档：用户指南 + API 参考（Task 12）
- ✅ Phase 3a: 结果评分 Agent（经 3 轮 Codex 评审，9/10 分）

### 活跃分支
- `main`（主线，最新部署，包含 Phase 3 Settings 系统）

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

### 进行中
1. **Settings 多 Provider 凭证管理**（Phase 3，待 Codex 评审）
   - ✅ Task 1: Database Schema Extension（2026-03-11）
   - ✅ Task 2: SSRF Protection Module（2026-03-11）
   - ✅ Task 3: API Routes（2026-03-11）
   - ✅ Task 4: AI Client Integration（2026-03-11）
   - ✅ Task 5: Frontend Components（2026-03-11）
   - ✅ Task 6: Seeding & Migration（2026-03-11）
   - ✅ Task 7: Testing & Documentation（2026-03-11）
   - 📋 状态：所有 7 个任务完成，待提交 Codex 评审

### 当前待办
2. **Entry 详情页对比历史 Tab**（Phase 2，待规划）
   - 从 Entry 视角查看对比历史
   - 显示对比时间、模式、得分
3. **测试基础设施优化**（非阻塞）
   - DB 测试环境配置（12 个测试需要 Docker）
   - 异步测试稳定性改进（4 个测试）
   - Lint 规则优化（48 个 `any` 类型警告）

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

| 指标 | 状态 |
|------|------|
| **测试文件** | 42 passed (42) |
| **测试用例** | 306 passed (306) |
| **通过率** | 100% |

**最近测试**: 2026-03-13
- ✅ Type Check: 通过
- ✅ Lint: 0 errors, 0 warnings
- ✅ Unit Tests: 100% 通过率 (306/306)

详细报告: [TEST_REPORT.md](./TEST_REPORT.md)

---

## 🔜 项目待办

### 当前冲刺
- 无活跃任务（上一轮冲刺已全部完成）

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

### 已完成规划
- [mode-comparison 设计](docs/plans/2026-03-06-mode-comparison-design.md) - 模式对比功能设计 ✅
- [mode-comparison 实施](docs/plans/2026-03-06-mode-comparison-implementation.md) - 实施计划 ✅
- [trace-summary 修复](docs/plans/2026-03-07-trace-summary-tool-calling.md) - 详情页可观测性提升 ✅

### 归档
- [react-agent-iterations/](docs/archive/react-agent-iterations/) - v1-v2.12 迭代历史
- [react-agent-phase2/](docs/archive/2026-Q1/react-agent-phase2/) - Phase 2 子阶段实施计划
- [codex-reviews/](docs/archive/2026-Q1/codex-reviews/) - Codex 评审记录
- [completed-plans/](docs/archive/2026-Q1/completed-plans/) - 已完成规划文档

---

*最后更新: 2026-03-13*
