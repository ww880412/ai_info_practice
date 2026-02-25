# 系统架构总览

> AI Practice Hub 技术架构与模块设计

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Pages: /library | /practice | /entry/[id] | /dashboard     │
│  Components: Library, Practice, Entry, Common                │
│  State: TanStack React Query                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Routes: /api/entries | /api/ingest | /api/groups | ...     │
│  Auth: Session-based (Next.js built-in)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
├─────────────────────────────────────────────────────────────┤
│  ReAct Agent: Two-step reasoning (classify → extract)        │
│  Built-in Tools: deduplication | smartSummary | association  │
│  Legacy: classifier | practiceConverter                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer (Prisma)                      │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL 15 + Prisma 5.22.0                              │
│  Models: Entry, Tag, PracticeTask, Step, ReasoningTrace...   │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. AI 处理管道 (lib/ai/)

#### ReAct Agent 引擎 (lib/ai/agent/)

基于 ReAct (Reasoning + Acting) 模式的智能 Agent 系统，负责内容的智能分析与处理。

**核心模块**:

| 模块 | 职责 |
|------|------|
| `engine.ts` | Agent 核心引擎，实现两步推理流程 |
| `builtin-tools.ts` | 内置工具集（去重、关联、摘要） |
| `tools.ts` | 工具定义与注册 |
| `route-strategy.ts` | 路由策略，决定处理路径 |
| `schemas.ts` | Zod 验证模式，确保数据契约 |
| `types.ts` | Agent 类型定义 |
| `ingest-contract.ts` | 入库契约，统一输出格式 |
| `config.ts` | Agent 配置管理 |
| `get-config.ts` | 配置获取逻辑 |
| `confidence.ts` | 置信度计算与评估 |
| `decision-repair.ts` | 决策修复机制 |

**两步推理流程**:

```
Step 1: 快速分类
├── contentType (内容类型识别)
├── techDomain (技术领域判断)
├── aiTags (AI 标签生成)
└── summaryStructure (摘要结构选择)

Step 2: 深度提取
├── coreSummary (核心摘要)
├── keyPoints (关键要点)
├── boundaries (适用边界)
└── practiceTask (练习任务)
```

**核心特性**:
- 置信度评估：每个决策都有置信度分数
- 决策修复：低置信度决策自动触发修复流程
- 工具调用：支持去重检测、关联发现、智能摘要等工具
- 可观测性：完整的推理追踪 (ReasoningTrace)

#### 其他 AI 模块

| 模块 | 职责 |
|------|------|
| `classifier.ts` | L1 内容分类 + L2 要点提取（遗留） |
| `practiceConverter.ts` | L3 转换为可执行练习（遗留） |
| `deduplication.ts` | 入库去重检测 |
| `smartSummary.ts` | 智能摘要生成 |
| `associationDiscovery.ts` | 关联条目发现 |
| `fallback-policy.ts` | 降级策略 |
| `prompts.ts` | AI 提示词管理 |

### 2. 内容解析 (lib/parser/)

| 模块 | 职责 |
|------|------|
| `index.ts` | 统一解析入口 |
| `github.ts` | GitHub URL 解析 |
| `webpage.ts` | 网页解析 |
| `pdf.ts` | PDF 解析 |
| `pdf-text.ts` | PDF 文本提取 |
| `text.ts` | 纯文本解析 |
| `ocr.ts` | OCR 识别 |
| `image-multimodal.ts` | 图片多模态处理 |
| `strategy.ts` | 解析策略 |
| `registry.ts` | 解析器注册 |
| `logger.ts` | 解析日志 |
| `parse-with-log.ts` | 带日志的解析 |

### 3. 数据模型 (prisma/schema.prisma)

```
Entry
├── Tag (AI tags, User tags)
├── PracticeTask (1:1)
│   └── Step (1:many)
├── ReasoningTrace (1:many)
├── QualityRevision (1:many)
└── Group (many:many)
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16, React 19, Tailwind CSS v4 |
| 状态 | TanStack React Query |
| 后端 | Next.js App Router |
| 数据库 | PostgreSQL 15, Prisma 5.22.0 |
| AI | Google Gemini API |
| 部署 | Docker + docker-compose |

---

*最后更新: 2026-02-25*
