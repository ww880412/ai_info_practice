# 🤖 Agent 协作规范指南

## 📋 概述

本文档定义了 ai_info_practice 项目中不同 AI Agent 之间的协作规范，确保多个 Agent 能够以标准化、可追溯的方式协同工作。

## 🎯 核心原则

### 1. 状态交接机制
每个 Agent 完成工作后，必须留下清晰的状态记录，供下一个 Agent 继续工作。

### 2. 规范化工作流程
所有 Agent 遵循统一的工作流程和命名规范。

### 3. 可追溯性
所有变更都通过 Git 提交记录，使用 Conventional Commits 规范。

## 📁 项目结构规范

### 目录组织
```
ai_info_practice/
├── src/                     # 源码
│   ├── app/                 # Next.js App Router
│   ├── components/          # React 组件
│   ├── hooks/               # 自定义 Hooks
│   ├── lib/                 # 核心库
│   │   ├── ai/              # AI 处理模块
│   │   └── parser/          # 内容解析
│   └── types/               # TypeScript 类型
├── prisma/                  # 数据库 Schema
├── docs/                    # 📚 文档中心
│   ├── architecture/        # 架构设计文档
│   ├── guides/              # 使用指南和教程
│   ├── plans/               # 实施计划
│   ├── operations/          # 运维文档
│   └── archive/             # 历史归档
├── scripts/                 # 脚本工具
├── PROGRESS.md              # 📝 工作进度记录
├── PROGRESS.log             # 📝 会话级交接日志
└── .claude/                 # Claude 配置
```

## 🔄 Agent 工作流程

### 阶段 1: 接手工作

1. **读取状态文件**
   ```bash
   # 检查是否存在 PROGRESS.md
   cat PROGRESS.md
   ```

2. **检查 Git 状态**
   ```bash
   git status
   git log --oneline -5
   ```

3. **理解当前上下文**
   - 阅读 PROGRESS.md 了解已完成的工作
   - 检查未完成的任务
   - 识别当前分支和工作状态

### 阶段 2: 执行工作

1. **遵循项目规范**
   - 文档放在 `docs/` 对应子目录
   - 代码放在 `src/` 对应子目录
   - 临时文件添加到 `.gitignore`

2. **使用规范的提交信息**
   ```bash
   # Conventional Commits 格式
   git commit -m "type(scope): description"

   # 类型：
   # - feat: 新功能
   # - fix: 修复 bug
   # - docs: 文档变更
   # - style: 代码格式（不影响功能）
   # - refactor: 重构
   # - test: 测试相关
   # - chore: 构建/配置相关
   ```

3. **保持工作区整洁**
   - 及时提交变更
   - 清理临时文件
   - 更新相关文档

### 阶段 3: 交接工作

1. **更新 PROGRESS.md**
   ```markdown
   ## ✅ 已完成的工作

   ### [任务名称] (日期)
   **提交**: `commit message` (commit hash)

   - ✅ 完成项 1
   - ✅ 完成项 2

   ## 🚧 进行中的工作

   ### [任务名称]
   - 当前状态描述
   - 遇到的问题
   - 下一步计划
   ```

2. **更新 PROGRESS.log**
   ```markdown
   ## YYYY-MM-DD

   - ✅ 完成任务 1
   - 🔜 下一步：任务 2
   ```

3. **提交所有变更**
   ```bash
   git add .
   git commit -m "chore: update progress"
   ```

4. **验证工作区状态**
   ```bash
   git status  # 应该显示 "working tree clean"
   ```

## 📝 文档规范

### 文档分类

| 目录 | 用途 | 示例 |
|------|------|------|
| `docs/architecture/` | 架构设计、技术选型 | 系统架构图 |
| `docs/guides/` | 使用指南、教程 | 开发指南、部署教程 |
| `docs/plans/` | 实施计划 | 功能规划 |
| `docs/operations/` | 运维相关 | 部署指南 |
| `docs/archive/` | 历史归档 | 过期文档 |

### 文档命名规范

- **总览文档**: `UPPERCASE.md`（如 README.md, ARCHITECTURE.md）
- **指南文档**: `lowercase-with-dash.md`（如 quickstart.md）
- **功能文档**: `FEATURE_NAME.md`（如 AI_PROCESSING.md）
- **规划文档**: `YYYY-MM-DD-description.md`

---

## 🔗 相关资源

- [Agent 接手清单](./AGENT_ONBOARDING_CHECKLIST.md)
- [文档规范](../DOCUMENTATION_STANDARDS.md)
- [CLAUDE.md](../CLAUDE.md)

---

*最后更新: 2026-02-23*
