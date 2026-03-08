## 项目：ai_info_practice

AI 知识管理系统 - 智能知识收集、处理与实践跟踪

### 项目上下文
- 技术栈：Next.js 16 + React 19 + Prisma + PostgreSQL + Vercel AI SDK
- 当前状态：Phase 1-4 已完成，Framework Refactor Phase 0-4 已完成，ReAct Agent Phase 1-3a 已完成
- 最新进展：CRS Provider 集成完成（SSE 流式响应支持）

### 核心特性
- ReAct Agent 两步推理引擎（支持 two-step 和 tool-calling 模式）
- Inngest 任务队列处理
- Jina Reader 网页解析
- Cloudflare R2 对象存储
- 评分 Agent 质量评估

### 项目规则
- 遵循已有代码风格，不做多余重构
- 组件使用 shadcn/ui，样式用 Tailwind CSS v4
- 数据库变更需同步 Prisma schema
- Docker 容器化执行（docker compose exec）
