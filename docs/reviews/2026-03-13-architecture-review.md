# AI Practice Hub 架构评审报告

> 评审日期：2026-03-13 | 评审工具：everything-claude-code:architect | 综合评分：7/10

## 一、整体评价

功能丰富、迭代速度快的 AI 知识管理系统。经过 Phase 1-4 和多轮重构，系统具备完整的内容入库、AI 处理、练习管理、模式对比等能力。整体架构思路清晰，技术选型合理。但快速迭代留下了可观的架构债务。

## 二、各维度详细评审

### 1. 整体架构设计

**优点：**
- Next.js App Router 全栈方案适合单人/小团队快速迭代
- Inngest 任务队列实现了 AI 处理的异步化和持久化
- Parser 模块的 Strategy Pattern 设计良好，可扩展性强
- ReAct Agent 两步推理 + tool-calling 双模式，带回退机制
- 统一的 `NormalizedAgentIngestDecision` 契约层

**问题：**
- **全局可变状态泄露风险**：`client.ts` 中 `setServerConfig()` 使用模块级变量。并发场景下会产生竞态条件（P0 级）
- `client.ts` 混合了客户端和服务端逻辑，职责不清

**建议：**
- 改为参数传递模式（dependency injection）
- 拆分为 `server-client.ts` 和 `client-config.ts`

### 2. 目录结构和模块划分

**优点：**
- `src/lib/` 按功能域划分，高内聚
- `src/components/` 按页面功能域组织，清晰
- `src/hooks/` 封装了所有 React Query 逻辑

**问题：**
- `classifier.ts` 和 `practiceConverter.ts` 标注遗留但仍被 fallback 使用
- `agent/` 子目录 16+ 文件，模块边界模糊
- 测试文件与路由文件混放

**建议：**
- `agent/` 分层：`core/`、`normalization/`、`tools/`
- 测试文件统一放在 `__tests__/` 子目录

### 3. API 设计质量

**优点：**
- RESTful 风格一致，资源路径清晰
- 入库 API 有 SSRF 防护
- 分页、筛选、排序参数完整

**问题：**
- 认证/鉴权完全缺失
- 排序同时支持新旧两套参数
- 列表查询 include 过多，N+1 风险
- API 响应格式不完全一致

**建议：**
- 添加 API key 中间件
- 统一 API 响应包装器
- 列表接口用 `select` 精简返回字段

### 4. 数据模型设计（最大问题）

**Entry God Object 反模式：** 30+ 字段，涵盖原始输入、AI 分类、动态摘要、评估维度、智能摘要、知识管理状态、处理状态、元数据等。拆分表已建但主表字段未清理，形成"双写"状态。

**其他问题：**
- `keyPoints` 和 `keyPointsNew` 新旧格式并存
- `difficulty` 枚举在 Entry 和 PracticeTask 中有歧义
- `ComparisonBatch.entryIds` 用 String[] 做数组查询，大数据量性能差
- 搜索用 `contains` 模糊匹配，缺全文搜索索引

**建议：**
- 优先推进 Entry 模型拆分迁移
- 搜索引入 PostgreSQL full-text search
- `ComparisonBatch.entryIds` 考虑改为关联表

### 5. AI 处理管道架构

**优点：**
- `ingest-contract.ts` 标准化层设计精良（800+ 行）
- 语义截断策略对不同长度文档分别处理
- decision-repair 机制保障 AI 输出质量
- 工具调用失败自动回退

**问题：**
- prompt 硬编码在 engine.ts 方法中
- `toObject()` 在两个文件中各有一份实现
- `processWithMode()` 通过修改 `this.config` 切换模式，并发不安全
- Inngest function 中 `parse-content` step 职责过重

**建议：**
- prompt 提取为独立模板
- 统一 `toObject()`
- `processWithMode()` 创建新实例而非修改现有实例
- Inngest step 拆分为更细粒度

### 6. 可扩展性和可维护性

**可扩展性好：** Parser Strategy + Registry、Agent tool-calling、多 Provider 凭证管理、Group 层级关系

**可维护性问题：**
- `console.log/error/warn` 散布 30+ 文件，无统一日志框架
- `ingest-contract.ts` 缺专门测试
- 55 个 lint error、16 个 warning 未修复
- 13 个测试持续失败（92.4% 通过率）

### 7. 架构债务清单

| 优先级 | 问题 | 影响 | 建议 |
|--------|------|------|------|
| P0 | setServerConfig 全局状态竞态 | 并发凭证泄露 | 改为参数注入 |
| P0 | API 无认证 | 安全风险 | 添加中间件 |
| P1 | Entry God Object + 双写 | 维护复杂度 | 推进拆分迁移 |
| P1 | 55 个 lint error | 质量下滑 | 集中修复 |
| P2 | prompt 硬编码 | 难维护 | 提取为模板 |
| P2 | 遗留 classifier/practiceConverter | 维护负担 | 评估移除 |
| P2 | 缺乏结构化日志 | 排查困难 | 引入 pino |
| P3 | 列表接口全量 include | 性能隐患 | 精简查询 |
| P3 | 搜索用 contains | 性能差 | pg full-text search |
| P3 | 13 个失败测试 | CI 信号失真 | 修复或移除 |
