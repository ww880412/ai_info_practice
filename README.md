# AI Practice Hub

> AI 知识管理系统 - 智能知识收集、处理与实践跟踪

## 简介

AI Practice Hub 是一个帮助你系统化管理 AI 相关学习知识的工具。通过 AI 自动处理，将散落在各处的知识整合成可执行的学习实践。

## 功能特性

### 核心功能

- **智能入库** - 支持链接、PDF、文本多种输入方式
- **AI 自动处理**
  - L1: 内容分类（教程、工具推荐、技术原理、案例研究、观点）
  - L2: 核心要点提取
  - L3: 转换为可执行的练习任务
- **知识库** - 按内容类型、技术领域、标签筛选
- **批量管理** - 知识库支持多选并批量删除
- **练习队列** - 跟踪练习进度，记录笔记

### V2 智能功能

- **去重检测** - 入库时自动检测相似内容
- **智能摘要** - 一键生成 TL;DR + 关键洞察
- **关联发现** - 自动推荐相关条目

### 前端配置

- 无需修改 .env，UI 界面直接配置 API Key

## 快速开始

### 1. 启动数据库

```bash
docker-compose up -d
```

### 2. 安装依赖

```bash
npm install
```

### 3. 初始化 Prisma

```bash
npx prisma generate
npx prisma db push
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3001

### 5. 配置 API Key

1. 点击导航栏 **Settings**
2. 输入 Gemini API Key
3. 点击 Save

获取 API Key: [Google AI Studio](https://aistudio.google.com/app/apikey)

## 使用流程

### 入库知识

1. 点击知识库页面右上角 **+ Add**
2. 选择输入类型（链接 / PDF / 文本）
3. 填写内容或上传文件
4. 提交后 AI 自动处理

### 批量删除条目

1. 在 **Library** 页面使用卡片左侧复选框选择条目
2. 可点击 **Select all on this page** 快速全选当前页
3. 点击 **Delete selected** 并确认后执行批量删除

> 删除会同时清理关联的解析日志（ParseLog），避免外键约束导致删除失败。

### 管理练习

1. 在 **Practice** 页面查看待完成任务
2. 点击任务进入详情
3. 按步骤执行，记录笔记
4. 标记完成

### 查看详情

- Entry 详情页可查看完整 AI 分析结果
- 可生成智能摘要
- 可查看相关条目推荐

## 技术栈

- Next.js 16
- React 19
- Tailwind CSS v4
- Prisma + PostgreSQL
- Google Gemini API
- TanStack React Query

## 项目结构

```
src/
├── app/           # Next.js App Router
├── components/    # React 组件
├── hooks/         # 业务逻辑
├── lib/           # 核心库 (AI, Parser, DB)
└── types/         # TypeScript 类型
```

## 相关文档

- [CLAUDE.md](./CLAUDE.md) - 开发规范
- [docs/plans/](./docs/plans/) - 设计文档

## License

MIT
