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
│  AI Pipeline: classifier | extractor | practiceConverter     │
│  Services: deduplication | smartSummary | association       │
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

| 模块 | 职责 |
|------|------|
| `classifier.ts` | L1 内容分类 + L2 要点提取 |
| `practiceConverter.ts` | L3 转换为可执行练习 |
| `deduplication.ts` | 入库去重检测 |
| `smartSummary.ts` | 智能摘要生成 |
| `associationDiscovery.ts` | 关联条目发现 |

### 2. 内容解析 (lib/parser/)

| 模块 | 职责 |
|------|------|
| `index.ts` | 统一解析入口 |
| `github.ts` | GitHub URL 解析 |
| `webpage.ts` | 网页解析 |
| `pdf.ts` | PDF 解析 |

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

*最后更新: 2026-02-24*
