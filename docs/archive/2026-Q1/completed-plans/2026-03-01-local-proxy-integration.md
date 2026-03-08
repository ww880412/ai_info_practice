# 本地 AI 代理集成方案

**日期**: 2026-03-01
**状态**: Reviewed - Codex 评审完成，待实施

## 背景

当前系统直接调用远端 Gemini API，存在以下问题：
- **成本高**：API 调用费用容易超标
- **调试不便**：远端调用难以本地调试

用户本地已运行反向代理服务 (`http://127.0.0.1:8045/v1`)，兼容 OpenAI API 格式，支持多种模型（如 `gemini-3.1-pro-high`）。

## 目标

- 支持通过本地代理调用 AI 模型（OpenAI-compatible 格式）
- 提供独立开关控制，可随时切换远端/本地模式
- 不影响现有 Gemini API 调用逻辑
- 配置持久化到数据库或环境变量

## 技术方案

### 1. 新增配置项

**环境变量**（可选）:
```env
# 启用本地代理模式
USE_LOCAL_PROXY=true
LOCAL_PROXY_URL=http://127.0.0.1:8045/v1
LOCAL_PROXY_KEY=<YOUR_LOCAL_PROXY_KEY>
LOCAL_PROXY_MODEL=gemini-3.1-pro-high
```

**Settings 页面配置**（用户可在 UI 切换）:
- 开关：Use Local Proxy
- 代理 URL
- API Key（可选加密存储）
- 模型名称

### 2. AI Client 改造

当前 `src/lib/ai/client.ts` 使用 `@ai-sdk/google` 创建 Gemini 客户端。

改造方案：
```typescript
// 新增 OpenAI provider 支持
import { createOpenAI } from '@ai-sdk/openai';

interface LocalProxyConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

function getLocalProxyConfig(): LocalProxyConfig | null {
  const enabled = process.env.USE_LOCAL_PROXY === 'true';
  if (!enabled) return null;

  return {
    enabled: true,
    baseUrl: process.env.LOCAL_PROXY_URL || 'http://127.0.0.1:8045/v1',
    apiKey: process.env.LOCAL_PROXY_KEY || '',
    model: process.env.LOCAL_PROXY_MODEL || 'gemini-3.1-pro-high',
  };
}

export function getModel(): LanguageModel {
  const localProxy = getLocalProxyConfig();

  if (localProxy?.enabled && localProxy.apiKey) {
    // Use OpenAI-compatible local proxy
    const openai = createOpenAI({
      baseURL: localProxy.baseUrl,
      apiKey: localProxy.apiKey,
    });
    return openai(localProxy.model);
  }

  // Fallback to Gemini
  const google = getGoogleProvider();
  const modelName = getModelName();
  return google(modelName);
}
```

### 3. 受影响模块

需确保以下模块在代理模式下正常工作：
- `src/lib/ai/generate.ts` - generateJSON, generateText
- `src/lib/ai/classifier.ts`
- `src/lib/ai/smartSummary.ts`
- `src/lib/ai/associationDiscovery.ts`
- `src/lib/ai/practiceConverter.ts`
- `src/lib/ai/agent/engine.ts` - ReAct Agent
- `src/lib/parser/pdf.ts` - multimodal
- `src/lib/parser/image-multimodal.ts`

### 4. 兼容性考量

| 功能 | Gemini API | OpenAI-compatible |
|------|------------|-------------------|
| Text generation | ✅ | ✅ |
| JSON mode | ✅ (native) | ✅ (response_format) |
| Multimodal (image/PDF) | ✅ | ⚠️ 取决于代理支持 |
| Structured output | ✅ | ✅ |

**风险点**：
- 多模态调用（PDF、图片解析）需验证代理是否支持
- JSON schema 格式差异可能导致解析失败

### 5. 实现步骤

1. **安装依赖**: `npm install @ai-sdk/openai`
2. **修改 `client.ts`**: 添加 `getLocalProxyConfig()` 和条件分支
3. **更新 `.env.example`**: 添加代理配置项
4. **修改 `docker-compose.yml`**: 添加环境变量映射
5. **测试**: 验证本地代理模式下各模块正常工作
6. **（可选）UI 配置**: Settings 页面添加代理开关

### 6. 测试验证

```bash
# 启用代理模式
export USE_LOCAL_PROXY=true
export LOCAL_PROXY_URL=http://127.0.0.1:8045/v1
export LOCAL_PROXY_KEY=<YOUR_LOCAL_PROXY_KEY>
export LOCAL_PROXY_MODEL=gemini-3.1-pro-high

# 运行测试
npm run dev
# 手动测试入库功能
```

## 安全考量

- 代理 API Key 可复用现有 `crypto.ts` 加密存储
- 本地代理 URL 应限制为 localhost（防止 SSRF）
- 生产环境默认禁用代理模式

## 回滚方案

- 设置 `USE_LOCAL_PROXY=false` 即可恢复远端 Gemini 调用
- 代码层面为条件分支，不影响原有逻辑

---

## Codex 评审结果（2026-03-01）

### Critical ❌
| ID | 问题 | 状态 | 修复 |
|----|------|------|------|
| C1 | API Key 明文泄露 | ✅ Fixed | 已脱敏为占位符 |

### High 🔴
| ID | 问题 | 修复建议 |
|----|------|----------|
| H1 | SSRF 缺乏运行时验证 | 添加 allowlist 检查：限制 scheme(http/https)、host(loopback only)、block private CIDRs |
| H2 | SDK Provider 模式不匹配 | 使用 `@ai-sdk/openai-compatible` 替代 `@ai-sdk/openai` |
| H3 | 静默 fallback 到远端 | fail closed：启用代理但配置不完整时抛错而非 fallback |
| H4 | 未整合现有 credential 架构 | 扩展 `resolveCredential`、`getModelWithCredential`、validation API |

### Medium 🟡
| ID | 问题 | 修复建议 |
|----|------|----------|
| M1 | Structured output 兼容性 | fallback to text + JSON.parse |
| M2 | 多模态未明确 fallback | 定义具体降级路径（禁用 PDF/Image 或文本 OCR） |
| M3 | Docker `127.0.0.1` 不可达 | 使用 `host.docker.internal` 或 network alias |
| M4 | Schema 缺少 proxy 字段 | Prisma migration: `ApiCredential.baseUrl`, `ApiCredential.providerType` |

### Low 🟢
| ID | 问题 | 修复建议 |
|----|------|----------|
| L1 | 缺少 `.env.example` | 创建文件 |
| L2 | 测试计划不足 | 补充回归测试用例 |

---

## V2 修订版实现方案

基于 Codex 评审，修订关键实现：

### 1. 使用 `@ai-sdk/openai-compatible`

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

function getLocalProxyProvider() {
  const config = getLocalProxyConfig();
  if (!config?.enabled) return null;

  // H3: fail closed
  if (!config.apiKey || !config.baseUrl) {
    throw new Error('Local proxy enabled but not fully configured');
  }

  // H1: SSRF validation
  const url = new URL(config.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid proxy protocol');
  }
  if (!['localhost', '127.0.0.1', '::1', 'host.docker.internal'].includes(url.hostname)) {
    throw new Error('Proxy URL must be localhost');
  }

  return createOpenAICompatible({
    name: 'local-proxy',
    baseURL: config.baseUrl,
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
}
```

### 2. 整合 credential 架构 (H4)

扩展 `ApiCredential` schema:
```prisma
model ApiCredential {
  // existing fields...
  providerType   String   @default("gemini")  // "gemini" | "openai-compatible"
  baseUrl        String?  // for openai-compatible providers
}
```

修改 `resolveCredential()` 支持多 provider。

### 3. Docker 配置 (M3)

```yaml
# docker-compose.yml
services:
  app:
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - LOCAL_PROXY_URL=http://host.docker.internal:8045/v1
```

### 4. Multimodal fallback (M2)

代理模式下禁用多模态功能，返回明确错误：
```typescript
if (isLocalProxyMode() && requiresMultimodal(input)) {
  throw new Error('Multimodal not supported in local proxy mode');
}
```

---

## 下一步

1. ✅ C1 已修复
2. [ ] 用户确认是否继续实施
3. [ ] 按 V2 方案逐步实现
