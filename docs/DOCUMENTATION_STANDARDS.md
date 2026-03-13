# 文档规范 (Documentation Standards)

> 版本: v2.0
> 更新日期: 2026-03-13
> 状态: 生效中

---

## 文档组织结构

```
docs/
├── README.md                    # 文档索引 (必读)
├── DOCUMENTATION_STANDARDS.md   # 本文档
├── PROGRESS.md                  # 里程碑级状态索引
├── PROGRESS.log                 # 会话级交接日志
├── PROJECT_STATUS.md            # 项目健康状态
│
├── architecture/                # 架构设计文档
│   └── ARCHITECTURE.md          # 系统架构总览
│
├── guides/                      # 使用指南
│   ├── AGENT_ONBOARDING_CHECKLIST.md  # Agent 接手清单
│   └── AGENT_COLLABORATION_GUIDE.md   # 协作规范
│
├── plans/                       # 活跃规划文档
│   └── YYYY-MM-DD-*.md          # 实施计划（完成后归档）
│
├── reviews/                     # 评审报告
│   └── YYYY-MM-DD-*-review.md   # 架构/代码/UX 评审
│
└── archive/                     # 历史文档归档
    └── 2026-Q1/                 # 按季度归档
```

---

## 文档命名规范

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| **总览文档** | `UPPERCASE.md` | `README.md`, `ARCHITECTURE.md` |
| **指南文档** | `UPPERCASE_WITH_UNDERSCORE.md` | `AGENT_ONBOARDING_CHECKLIST.md` |
| **规划文档** | `YYYY-MM-DD-description.md` | `2026-02-21-iteration-design.md` |
| **评审文档** | `YYYY-MM-DD-*-review.md` | `2026-03-13-architecture-review.md` |

---

## 目录说明

### architecture/ — 架构设计文档
**用途**: 系统架构、技术选型、设计决策
**更新频率**: 架构变更时更新

### guides/ — 使用指南
**用途**: 面向开发者/Agent 的操作指南
**更新频率**: 流程变更时更新

### plans/ — 活跃规划文档
**用途**: 当前活跃的实施计划和技术方案
**更新频率**: 规划创建/变更时更新
**归档规则**: 计划完成后移入 `archive/YYYY-QN/plans/`

### reviews/ — 评审报告
**用途**: 架构评审、代码质量评审、UX 评审
**更新频率**: 评审时创建

### archive/ — 历史文档归档
**用途**: 保存已完成或过时的文档
**组织方式**: 按季度 + 原目录类型归档
**更新频率**: 不再更新

---

## 根目录文件规范

根目录仅保留工具链强制要求的配置文件和入口文件：

| 保留 | 说明 |
|------|------|
| `README.md` | 项目入口 |
| `CLAUDE.md`, `AGENTS.md` | AI Agent 配置 |
| `package.json`, `tsconfig.json` | Node.js/TS 配置 |
| `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs` | 框架配置 |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | 容器配置 |
| `playwright.config.ts` | 测试配置 |
| `.gitignore`, `.env.example` | 项目配置 |

**禁止在根目录放置**：进度文件、报告文件、临时脚本、分析文档。

---

## 文档质量标准

- **准确性** — 信息准确无误
- **完整性** — 覆盖所有必要信息
- **清晰性** — 表达清晰易懂
- **时效性** — 内容保持最新，过期文档及时归档

---

**文档版本**: v2.0
**最后更新**: 2026-03-13
**状态**: 生效中
