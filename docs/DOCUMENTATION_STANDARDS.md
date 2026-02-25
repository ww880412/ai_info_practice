# 文档规范 (Documentation Standards)

> 版本: v1.1
> 更新日期: 2026-02-25
> 状态: 生效中

---

## 文档组织结构

```
docs/
├── README.md                    # 文档索引 (必读)
├── DOCUMENTATION_STANDARDS.md   # 本文档
├── CLAUDE.md                    # Claude Code 行为准则
│
├── architecture/                # 架构设计文档
│   └── ARCHITECTURE.md          # 系统架构总览
│
├── guides/                      # 使用指南
│   ├── AGENT_ONBOARDING_CHECKLIST.md  # Agent 接手清单
│   └── AGENT_COLLABORATION_GUIDE.md   # 协作规范
│
├── plans/                       # 规划文档
│   └── YYYY-MM-DD-*.md          # 实施计划
│
└── archive/                     # 历史文档归档
    └── 2026-Q1/                 # 按季度归档
```

---

## 文档命名规范

### 文件命名规则

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| **总览文档** | `UPPERCASE.md` | `README.md`, `ARCHITECTURE.md` |
| **指南文档** | `lowercase-with-dash.md` | `quickstart.md`, `deployment.md` |
| **功能文档** | `FEATURE_NAME.md` | `AI_PROCESSING.md` |
| **规划文档** | `YYYY-MM-DD-description.md` | `2026-02-21-iteration-design.md` |

---

## 文档分类说明

### architecture/ - 架构设计文档
**用途**: 系统架构、技术选型、设计决策
**更新频率**: 架构变更时更新

### guides/ - 使用指南
**用途**: 面向开发者/Agent 的操作指南
**更新频率**: 流程变更时更新

### plans/ - 规划文档
**用途**: 项目规划、路线图、技术方案
**更新频率**: 规划变更时更新

### archive/ - 历史文档归档
**用途**: 保存已完成或过时的文档
**更新频率**: 不再更新

---

## 文档质量标准

### 内容质量
- ✅ **准确性** - 信息准确无误
- ✅ **完整性** - 覆盖所有必要信息
- ✅ **清晰性** - 表达清晰易懂
- ✅ **时效性** - 内容保持最新

### 格式规范
- ✅ **Markdown 规范** - 遵循 CommonMark 规范
- ✅ **标题层级** - 合理使用 H1-H6
- ✅ **代码块** - 使用语法高亮

---

## 相关资源

- [CLAUDE.md](../CLAUDE.md)
- [Agent 协作规范](./AGENT_COLLABORATION_GUIDE.md)
- [Agent 接手清单](./AGENT_ONBOARDING_CHECKLIST.md)

---

**文档版本**: v1.1
**最后更新**: 2026-02-25
**状态**: 生效中
