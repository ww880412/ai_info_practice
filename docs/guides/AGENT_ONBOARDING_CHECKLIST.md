# 🚀 Agent 接手项目标准流程

## 📋 概述

本文档定义了 AI Agent 接手 ai_info_practice 项目时的标准操作流程，确保快速理解项目状态并开始工作。

---

## ⚡ 快速开始（5 分钟）

### 第 1 步：读取项目状态 📊

```bash
# 1.1 读取工作进度记录（最重要！）
cat PROGRESS.md
```

**目的**：
- ✅ 了解最近完成了什么工作
- ✅ 了解当前正在进行什么工作
- ✅ 了解接下来需要做什么
- ✅ 识别可能的阻塞问题

---

### 第 2 步：检查 Git 状态 🔍

```bash
# 2.1 查看当前分支和状态
git status

# 2.2 查看最近的提交历史
git log --oneline -10

# 2.3 查看当前分支
git branch

# 2.4 查看是否有未提交的变更
git diff
```

**判断标准**：
- ✅ **理想状态**：`working tree clean`，所有变更已提交
- ⚠️ **需要处理**：有未提交的变更，需要先理解这些变更的目的

---

### 第 3 步：了解项目结构 📁

```bash
# 3.1 查看项目根目录结构
ls -la

# 3.2 查看源码目录结构
tree src/ -L 2

# 3.3 查看文档目录结构
tree docs/ -L 2
```

---

## 📚 深入了解（根据任务需要）

### 第 4 步：阅读协作规范 🤝

```bash
# 阅读 Agent 协作指南
cat docs/guides/AGENT_COLLABORATION_GUIDE.md
```

---

### 第 5 步：检查环境配置 ⚙️

```bash
# 5.1 检查 Docker 环境
docker ps
docker compose ps

# 5.2 检查环境变量文件
ls -la .env*
```

---

## 🎯 开始工作前的检查清单

- [ ] ✅ 读取了 `PROGRESS.md`，了解项目当前状态
- [ ] ✅ 检查了 Git 状态，确认工作区干净
- [ ] ✅ 了解了项目的目录结构
- [ ] ✅ 阅读了 `docs/guides/AGENT_COLLABORATION_GUIDE.md`（首次接手时）
- [ ] ✅ 确认了开发环境正常运行
- [ ] ✅ 明确了当前任务的目标和范围

---

## 🔄 标准工作流程

### 开始工作

1. **创建或切换分支**（如果需要）
   ```bash
   git checkout -b codex/your-task-name
   ```

2. **更新 PROGRESS.md**
   ```markdown
   ## 🚧 进行中的工作

   ### [任务名称]
   **状态**: 进行中

   - 🚧 正在进行：[具体工作内容]
   ```

3. **开始实际工作**

### 完成工作

1. **提交所有变更**
   ```bash
   git add .
   git commit -m "type: description"
   ```

2. **更新 PROGRESS.md**

3. **验证工作区状态**
   ```bash
   git status  # 应该显示 "working tree clean"
   ```

---

## 📊 不同场景的接手流程

### 场景 1：接手全新项目

```bash
# 1. 读取项目状态
cat PROGRESS.md

# 2. 检查 Git 状态
git status
git log --oneline -10

# 3. 了解项目结构
ls -la
tree src/ -L 2

# 4. 阅读协作规范
cat docs/guides/AGENT_COLLABORATION_GUIDE.md
```

### 场景 2：接手进行中的任务

```bash
# 1. 读取项目状态（重点关注"进行中的工作"）
cat PROGRESS.md

# 2. 检查 Git 状态
git status
git diff

# 3. 查看最近的提交
git log --oneline -5
```

### 场景 3：紧急修复任务

```bash
# 1. 快速读取项目状态
cat PROGRESS.md | head -50

# 2. 检查当前分支
git status
git branch

# 3. 创建 hotfix 分支
git checkout -b codex/hotfix-urgent-fix
```

---

## 🎓 最佳实践

### 优先级原则

**必读**（每次都要读）：
1. `PROGRESS.md` - 了解项目状态
2. `git status` - 检查工作区状态
3. `git log` - 查看最近提交

**选读**（根据需要）：
4. `docs/guides/AGENT_COLLABORATION_GUIDE.md` - 了解协作规范

### 时间分配建议

- **快速接手**（5 分钟）：步骤 1-3
- **标准接手**（15 分钟）：步骤 1-5

---

## 🔗 相关资源

- [Agent 协作规范指南](./AGENT_COLLABORATION_GUIDE.md)
- [文档规范](../DOCUMENTATION_STANDARDS.md)
- [CLAUDE.md](../CLAUDE.md)

---

*最后更新: 2026-02-23*
