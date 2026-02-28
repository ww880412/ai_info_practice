# AI Practice Hub - 项目规范

> AI 知识管理系统 - 智能知识收集、处理与实践跟踪

## 🧭 阶段治理定义（Phase Governance）
- **项目阶段**：Phase 1-4 已完成（知识库核心功能、AI 处理管道、练习系统、关联发现），当前处于系统性升级阶段
- **阶段状态单点真理**：以 `PROGRESS.md` 与 `docs/PROJECT_STATUS.md` 为准；`CLAUDE.md` 仅承载治理规则，不再作为动态阶段状态来源。

## 🐳 Docker 运行环境规范
- **强制容器化执行**：所有构建、测试、数据库迁移等命令**建议**通过 `docker compose exec` 执行。
- **环境自愈**：若发现服务未启动，Agent 应先运行 `docker compose up -d`。
- **常用指令集参考**：
  - 完整构建：`docker compose build`
  - 启动环境：`docker compose up -d`
  - 后端开发：`docker compose exec app npm run dev`
  - 前端类型检查：`docker compose exec app npm run type-check`
  - 前端 Lint：`docker compose exec app npm run lint`

## 🌿 Git & 多 Agent 协作流
- **分支驱动**：所有任务建议在 `codex/[feature-name]` 分支进行，严禁直接在 `main` 操作。
- **先分支后建档/建文件**：任何"新增文件"操作前，建议先创建并切换任务分支。
- **提交契约**：使用 Conventional Commits。
- **状态交接棒**：任务结束或切换前，建议在 `PROGRESS.log` 末尾追加会话级操作记录。开启新任务前，先读取 log 尾部获取断点。
- **PROGRESS.md 与 PROGRESS.log 职责分离**：
  - `PROGRESS.md`：里程碑级状态索引（阶段总览表 + 活跃分支 + 测试基线 + 下一步方向），保持精简（<80行有效内容），禁止写入会话级执行细节。
  - `PROGRESS.log`：会话级交接日志，记录每次操作的完整细节。

## 📋 Agent 接手标准流程
参考 [docs/guides/AGENT_ONBOARDING_CHECKLIST.md](./docs/guides/AGENT_ONBOARDING_CHECKLIST.md)（采用相同规范）：

### 快速开始（5 分钟）
1. **读取 PROGRESS.md** - 了解最近完成/进行中/待办事项
2. **检查 Git 状态** - `git status` / `git log --oneline -10`
3. **了解项目结构** - `ls -la` / `tree src/`

### 首次接手必读
- [ ] `PROGRESS.md` - 项目当前状态
- [ ] `PROGRESS.log` - 会话级交接记录
- [ ] `docs/guides/AGENT_COLLABORATION_GUIDE.md` - 协作规范
- [ ] `docs/PROJECT_STATUS.md` - 项目健康状态

### 标准工作流程
```bash
# 开始工作
git checkout -b codex/your-task-name

# 更新 PROGRESS.md（进行中部分）

# 完成任务
git add . && git commit -m "type: description"
# 更新 PROGRESS.md（已完成部分）
git status  # 应显示 "working tree clean"
```

## 🤝 深度一致性与对齐 (Context Guard)
- **方案先行**：在编写任何代码前，必须先简述设计思路并等待用户确认。若需求模糊，必须先提问。
- **契约定义优先**：涉及前后端、API 或数据库的改动，必须先更新/对齐 `types/` 或 API 文档。
- **API 响应规范**：统一使用 `{ data: T }` 或 `{ error: string }` 格式。
- **任务原子化**：若单个任务涉及超过 3 个文件的修改，建议先将其拆分为更小的子任务。
- **单点真理**：禁止分散创建 README。所有项目级、工程级规约必须统一收敛至本文件。

## 🧪 TDD 质量守卫 (Bug 修复协议)
- **复现测试先行**：遇到 Bug 时，严禁直接修改逻辑。必须先写一个能复现该 Bug 的失败测试，修复后再验证通过。
- **风险评估**：代码修改后，必须列出受影响的潜在模块，并建议相关测试覆盖。

## 🛠 自我进化规则
- **防错固化**：每当用户对 Agent 的行为进行纠正时，Agent 必须分析原因，并在本文件的本节下方增加一条新规则，以确保不再犯同类错误。
- 当用户要求阅读或确认 CLAUDE.md 时，必须立即读取并在回复中明确确认已理解，优先于任何其他操作。

## 📖 进度接力棒 (PROGRESS.log)
- 2026-02-23: 整合 AlphaBrain 大型项目规范至 CLAUDE.md

## 技术栈

- **前端**: Next.js 16, React 19, Tailwind CSS v4
- **后端**: Next.js App Router API Routes
- **数据库**: PostgreSQL 15 + Prisma 5.22.0
- **AI**: Vercel AI SDK + Google Gemini API
- **任务队列**: Inngest
- **对象存储**: Cloudflare R2
- **网页解析**: Jina Reader (fallback: cheerio)
- **部署**: Docker + docker-compose

## 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── ingest/       # 内容入库
│   │   ├── entries/      # 条目 CRUD
│   │   ├── practice/     # 练习任务
│   │   ├── groups/       # 分组管理
│   │   ├── agent/        # Agent 配置
│   │   ├── config/       # 配置验证
│   │   ├── upload/       # 文件上传
│   │   ├── dashboard/    # 仪表盘统计
│   │   ├── tags/         # 标签统计
│   │   └── ai/           # AI 处理 (smart-summary, related, process)
│   ├── library/          # 知识库页面
│   ├── practice/         # 练习队列页面
│   ├── entry/[id]/      # 条目详情页
│   └── settings/        # 设置页面
├── components/           # React 组件
│   ├── library/        # 知识库组件
│   ├── practice/       # 练习组件
│   ├── entry/          # 条目详情组件
│   ├── agent/          # Agent 组件
│   ├── ingest/         # 入库组件
│   └── common/         # 公共组件
├── hooks/               # 自定义 Hooks
│   ├── useEntries.ts   # 条目管理
│   ├── useIngest.ts    # 入库逻辑
│   ├── useGroups.ts    # 分组管理
│   ├── useEntryStatus.ts  # 条目状态
│   └── usePracticeQueue.ts
├── lib/                 # 核心库
│   ├── ai/             # AI 处理模块
│   │   ├── client.ts   # Vercel AI SDK 客户端
│   │   ├── generate.ts # 生成函数 (generateJSON, generateText, generateFromFile)
│   │   ├── agent/     # ReAct Agent 引擎
│   │   │   ├── engine.ts           # Agent 核心引擎
│   │   │   ├── builtin-tools.ts    # 内置工具集
│   │   │   ├── tools.ts            # 工具定义
│   │   │   ├── route-strategy.ts   # 路由策略
│   │   │   ├── schemas.ts          # Zod 验证模式
│   │   │   ├── types.ts            # Agent 类型定义
│   │   │   ├── ingest-contract.ts  # 入库契约
│   │   │   ├── config.ts           # Agent 配置
│   │   │   ├── get-config.ts       # 配置获取
│   │   │   ├── confidence.ts       # 置信度计算
│   │   │   └── decision-repair.ts  # 决策修复
│   │   ├── classifier.ts           # 内容分类（遗留）
│   │   ├── practiceConverter.ts    # 练习转换（遗留）
│   │   ├── deduplication.ts        # 去重检测
│   │   ├── smartSummary.ts         # 智能摘要
│   │   ├── associationDiscovery.ts # 关联发现
│   │   ├── fallback-policy.ts      # 降级策略
│   │   └── prompts.ts              # AI 提示词
│   ├── parser/         # 内容解析
│   │   ├── index.ts    # 统一解析入口
│   │   ├── github.ts   # GitHub 解析
│   │   ├── webpage.ts  # 网页解析 (Jina Reader + cheerio fallback)
│   │   ├── jina.ts     # Jina Reader 封装
│   │   ├── pdf.ts      # PDF 解析
│   │   ├── pdf-text.ts # PDF 文本提取
│   │   ├── text.ts     # 纯文本解析
│   │   ├── ocr.ts      # OCR 识别
│   │   ├── image-multimodal.ts  # 图片多模态
│   │   ├── strategy.ts # 解析策略
│   │   ├── registry.ts # 解析器注册
│   │   ├── logger.ts   # 解析日志
│   │   └── parse-with-log.ts  # 带日志解析
│   ├── entries/        # 条目处理
│   │   ├── bulk-delete.ts      # 批量删除
│   │   ├── delete.ts           # 删除逻辑
│   │   ├── tag-filter.ts       # 标签过滤
│   │   └── knowledge-status.ts # 知识状态
│   ├── entry/          # 单条目处理
│   │   └── metadata-display.ts # 元数据展示
│   ├── library/        # 知识库逻辑
│   │   ├── group-options.ts    # 分组选项
│   │   └── group-import.ts     # 分组导入
│   ├── ingest/         # 入库逻辑
│   │   └── retry.ts    # 重试机制
│   ├── inngest/        # Inngest 任务队列
│   │   ├── client.ts   # Inngest 客户端
│   │   └── functions/  # 任务函数
│   │       └── process-entry.ts  # 条目处理
│   ├── storage/        # 对象存储 (Cloudflare R2)
│   │   ├── client.ts   # R2 客户端
│   │   ├── upload.ts   # 上传功能
│   │   └── download.ts # 下载功能
│   ├── trace/          # 追踪系统
│   │   └── observation.ts      # 观察记录
│   ├── prisma.ts       # Prisma Client
│   ├── sanitize.ts     # 数据清洗
│   └── tag-aggregation.ts  # 标签聚合
└── types/              # TypeScript 类型
```

## AI 处理管道

```
输入 (LINK/TEXT/PDF)
    ↓
/api/ingest (创建 Entry)
    ↓
Inngest 任务队列 (entry/ingest 事件)
    ↓
Parser 解析
    ├── LINK → Jina Reader (fallback: cheerio)
    ├── PDF → 多模态 AI 提取
    └── TEXT → 直接处理
    ↓
ReAct Agent 两步推理 (Vercel AI SDK + Gemini)
    ├── Step 1: 快速分类 (contentType, techDomain, aiTags, summaryStructure)
    └── Step 2: 深度分析 (coreSummary, keyPoints, boundaries, practiceTask)
    ↓
输出: NormalizedAgentIngestDecision (统一契约)
```

核心特性：
- 基于 ReAct 模式的 Agent 引擎 (src/lib/ai/agent/engine.ts)
- 两步推理：Step 1 快速分类 + Step 2 深度提取
- 内置工具集：去重检测、关联发现、智能摘要
- 置信度评估与决策修复机制

## 开发规范

### API 设计

- RESTful 风格
- 返回格式: `{ data: T }` 或 `{ error: string }`
- 使用 Prisma transaction 保证数据一致性

### 组件规范

- 使用 `"use client"` 标记客户端组件
- 组件放在对应功能目录下
- 使用 Tailwind CSS 进行样式

###  使用 TanStack React状态管理

- Query 进行服务端状态
- useIngest / useEntries / usePracticeQueue 封装业务逻辑

### Git 提交

```
feat:     新功能
fix:      Bug 修复
refactor: 代码重构
docs:     文档更新
chore:    构建/依赖更新
```

## 环境变量

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5433/ai_practice"

# Gemini AI
GEMINI_API_KEY="your-api-key"
GEMINI_MODEL="gemini-2.0-flash-exp"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3001"
```

## 常用命令

```bash
# 开发
npm run dev

# 构建
npm run build

# Prisma
npx prisma generate    # 生成 Client
npx prisma db push     # 同步 Schema
npx prisma studio      # 数据库可视化

# Docker
docker-compose up -d   # 启动服务
```

## 测试命令

```bash
# 单元测试 / 集成测试
docker compose exec app npm run test

# TypeScript 类型检查
docker compose exec app npm run type-check

# ESLint 检查
docker compose exec app npm run lint
```

## 📚 文档规范
参考 [docs/guides/AGENT_COLLABORATION_GUIDE.md](./docs/guides/AGENT_COLLABORATION_GUIDE.md)（采用相同规范）：

| 目录 | 用途 |
|------|------|
| `docs/architecture/` | 架构设计文档 |
| `docs/guides/` | 使用指南和教程 |
| `docs/plans/` | 实施计划 |
| `docs/archive/` | 历史归档 |

**命名规范**：
- 总览文档：`UPPERCASE.md`（如 README.md, ARCHITECTURE.md）
- 指南文档：`lowercase-with-dash.md`（如 quickstart.md）
- 功能文档：`FEATURE_NAME.md`（如 AI_PROCESSING.md）

**更新流程**：更新版本号 → 更新日期 → 更新 docs/README.md 索引

## 相关文档

- [迭代设计文档](./docs/plans/2026-02-21-iteration-design.md)
- [实现计划](./docs/plans/2026-02-21-phase1-implementation.md)
