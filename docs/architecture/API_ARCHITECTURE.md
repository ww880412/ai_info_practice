# API 架构设计

> AI Practice Hub API 端点与响应规范

## 基础信息

- **Base URL**: `/api`
- **Content-Type**: `application/json`
- **认证**: Session-based (Next.js built-in)

## 响应格式

### 成功响应

```json
{
  "data": { ... }
}
```

### 错误响应

```json
{
  "error": "Error message"
}
```

## API 端点

### Entries (条目管理)

| Method | Endpoint | 描述 |
|--------|----------|------|
| GET | `/api/entries` | 获取条目列表（支持筛选、分页、排序） |
| POST | `/api/entries` | 创建新条目 |
| GET | `/api/entries/[id]` | 获取单个条目 |
| DELETE | `/api/entries/[id]` | 删除条目 |
| GET | `/api/entries/[id]/trace` | 获取推理轨迹 |
| GET | `/api/entries/[id]/quality` | 获取质量评估 |
| POST | `/api/entries/[id]/quality` | 保存质量评估 |
| GET | `/api/entries/[id]/process-attempts` | 获取处理日志 |

### Groups (分组管理)

| Method | Endpoint | 描述 |
|--------|----------|------|
| GET | `/api/groups` | 获取分组列表 |
| POST | `/api/groups` | 创建分组 |
| PATCH | `/api/groups/[id]` | 更新分组 |
| DELETE | `/api/groups/[id]` | 删除分组 |
| GET | `/api/groups/[id]/entries` | 获取分组下的条目 |

### Ingest (内容入库)

| Method | Endpoint | 描述 |
|--------|----------|------|
| POST | `/api/ingest` | 入库内容（自动 AI 处理） |

### Practice (练习)

| Method | Endpoint | 描述 |
|--------|----------|------|
| GET | `/api/practice` | 获取练习队列 |
| GET | `/api/practice/steps/[id]` | 获取步骤详情 |
| PATCH | `/api/practice/steps/[id]` | 更新步骤状态 |

### Dashboard

| Method | Endpoint | 描述 |
|--------|----------|------|
| GET | `/api/dashboard/stats` | 获取统计数据 |

### AI Services

| Method | Endpoint | 描述 |
|--------|----------|------|
| POST | `/api/ai/smart-summary` | 生成智能摘要 |
| POST | `/api/ai/related` | 获取相关条目 |

## 查询参数

### Entries 筛选

| 参数 | 类型 | 描述 |
|------|------|------|
| `page` | number | 页码 |
| `pageSize` | number | 每页数量 |
| `q` | string | 搜索文本 |
| `contentType` | string | 内容类型 |
| `techDomain` | string | 技术领域 |
| `practiceValue` | string | 练习价值 |
| `processStatus` | string | 处理状态 |
| `aiTagsAll` | string | AI 标签（全部匹配） |
| `aiTagsAny` | string | AI 标签（任一匹配） |
| `userTagsAll` | string | 用户标签（全部匹配） |
| `userTagsAny` | string | 用户标签（任一匹配） |
| `sort` | string | 排序方式 |
| `groupId` | string | 分组筛选 |

---

*最后更新: 2026-02-24*
