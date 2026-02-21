# AI Practice Hub - 项目规范

> AI 知识管理系统 - 智能知识收集、处理与实践跟踪

## 技术栈

- **前端**: Next.js 16, React 19, Tailwind CSS v4
- **后端**: Next.js App Router API Routes
- **数据库**: PostgreSQL 15 + Prisma 5.22.0
- **AI**: Google Gemini API
-**: Docker **部署 + docker-compose

## 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── ingest/       # 内容入库
│   │   ├── entries/      # 条目 CRUD
│   │   ├── practice/     # 练习任务
│   │   ├── config/       # 配置验证
│   │   └── ai/           # AI 处理 (smart-summary, related)
│   ├── library/          # 知识库页面
│   ├── practice/         # 练习队列页面
│   ├── entry/[id]/      # 条目详情页
│   └── settings/        # 设置页面
├── components/           # React 组件
│   ├── library/        # 知识库组件
│   ├── practice/        # 练习组件
│   └── common/          # 公共组件
├── hooks/               # 自定义 Hooks
│   ├── useEntries.ts   # 条目管理
│   ├── useIngest.ts    # 入库逻辑
│   └── usePracticeQueue.ts
├── lib/                 # 核心库
│   ├── ai/             # AI 处理模块
│   │   ├── classifier.ts     # L1 分类
│   │   ├── extractor.ts      # L2 提取
│   │   ├── practiceConverter.ts  # L3 练习转换
│   │   ├── deduplication.ts # 去重检测
│   │   ├── smartSummary.ts  # 智能摘要
│   │   └── associationDiscovery.ts # 关联发现
│   ├── parser/         # 内容解析
│   │   ├── github.ts
│   │   ├── webpage.ts
│   │   └── pdf.ts
│   ├── gemini.ts       # Gemini API 封装
│   └── prisma.ts       # Prisma Client
└── types/              # TypeScript 类型
```

## AI 处理管道

```
输入 (LINK/TEXT/PDF)
    ↓
L1 分类 (contentType, techDomain, aiTags)
    ↓
L2 提取 (coreSummary, keyPoints, practiceValue)
    ↓
L3 练习转换 (practiceTask → steps) [仅 ACTIONABLE 内容]
```

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

## 相关文档

- [迭代设计文档](./docs/plans/2026-02-21-iteration-design.md)
- [实现计划](./docs/plans/2026-02-21-phase1-implementation.md)
