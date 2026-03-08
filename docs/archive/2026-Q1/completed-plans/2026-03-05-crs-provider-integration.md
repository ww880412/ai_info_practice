# CRS Provider 集成方案

**版本**: v1.1 (Codex 评审后修订)
**日期**: 2026-03-05
**状态**: 修订中
**任务类型**: new（全新功能）

## 修订记录

### v1.1 (2026-03-05)
- 修复 P1 问题：添加 Provider 互斥验证
- 修复 P1 问题：强化 URL 验证（强制白名单）
- 修复 P1 问题：补充凭证系统集成步骤
- 修复 P0 问题：明确 Vercel AI SDK 适配器规范
- 修复 P2 问题：补充风险评估和发布门槛
- 澄清：CRS 支持多模态和工具调用（Phase 2 实现）

---

## 一、背景

当前项目支持两种 AI Provider：
1. **Gemini** (Google) - 默认生产环境
2. **LocalProxy** (OpenAI-compatible) - 本地开发环境

现需添加第三个 Provider：**CRS (Codex Response Service)**，用于成本优化。

### CRS 特性
- **API 端点**: `/v1/responses`（非标准 Chat Completions）
- **Base URL**: `https://ls.xingchentech.asia/openai`
- **模型**: `gpt-5.3-codex`
- **特殊参数**:
  - `reasoning_effort`: `low` | `medium` | `high` | `xhigh`
  - `store`: `true` | `false`（对应 `disable_response_storage`）

---

## 二、技术方案

### 2.1 架构设计

```
当前架构：
getModel() → isLocalProxyMode() ? LocalProxy : Gemini

新架构（互斥验证）：
启动时检查：
  ├─ 如果 USE_CRS_PROVIDER && USE_LOCAL_PROXY 同时为 true → throw Error
  └─ 如果 USE_CRS_PROVIDER && USE_LOCAL_PROXY 同时为 false → 使用 Gemini

运行时路由：
getModel() →
  ├─ isCRSMode() ? CRS
  ├─ isLocalProxyMode() ? LocalProxy
  └─ Gemini (默认)
```

**互斥验证**：
```typescript
// 在 client.ts 模块加载时执行
if (process.env.USE_CRS_PROVIDER === 'true' && process.env.USE_LOCAL_PROXY === 'true') {
  throw new Error(
    'Cannot enable both CRS and LocalProxy providers. ' +
    'Set only one of USE_CRS_PROVIDER or USE_LOCAL_PROXY to true.'
  );
}
```

### 2.2 实施 Phase

#### Phase 1: CRS Provider 封装（3-4h）

**新建文件**: `src/lib/ai/providers/crs.ts`

```typescript
import type { LanguageModelV3, LanguageModelV3CallOptions, LanguageModelV3GenerateResult, LanguageModelV3StreamResult } from '@ai-sdk/provider';

export interface CRSConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  disableStorage?: boolean;
}

export interface CRSResponsesRequest {
  model: string;
  input: string | Array<{ role: string; content: string }>;
  reasoning_effort?: string;
  store?: boolean;
  temperature?: number;
  max_output_tokens?: number;
}

export interface CRSResponsesOutput {
  id: string;
  model: string;
  output_text: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

// Vercel AI SDK v3 适配器实现
class CRSLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'crs';
  readonly modelId: string;
  readonly supportedUrls = {}; // Phase 1: 不支持 URL 输入

  constructor(private config: CRSConfig) {
    this.modelId = config.model;
  }

  // 必须实现：生成文本
  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    // 1. 转换 options 为 CRS Responses API 格式
    const request: CRSResponsesRequest = {
      model: this.config.model,
      input: convertPromptToCRSInput(options.prompt),
      reasoning_effort: this.config.reasoningEffort,
      store: !this.config.disableStorage,
      temperature: options.temperature,
      max_output_tokens: options.maxTokens,
    };

    // 2. 调用 CRS API
    const response = await callCRSResponses(this.config, request);

    // 3. 转换响应为 V3 格式
    return {
      text: response.output_text,
      finishReason: 'stop',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      },
      rawCall: { rawPrompt: request, rawSettings: {} },
      rawResponse: { headers: {} },
      warnings: [],
      request: { body: JSON.stringify(request) },
    };
  }

  // 必须实现：流式生成
  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    // Phase 1: 不支持流式
    throw new Error('CRS provider does not support streaming in Phase 1');
  }
}

// 获取 CRS 配置
export function getCRSConfig(): CRSConfig | null {
  const enabled = process.env.USE_CRS_PROVIDER === 'true';
  if (!enabled) return null;

  const baseUrl = process.env.CRS_BASE_URL || 'https://ls.xingchentech.asia/openai';
  const apiKey = process.env.CRS_API_KEY || '';
  const model = process.env.CRS_MODEL || 'gpt-5.3-codex';
  const reasoningEffort = (process.env.CRS_REASONING_EFFORT || 'xhigh') as CRSConfig['reasoningEffort'];
  const disableStorage = process.env.CRS_DISABLE_STORAGE === 'true';

  return { enabled, baseUrl, apiKey, model, reasoningEffort, disableStorage };
}

export function isCRSMode(): boolean {
  return process.env.USE_CRS_PROVIDER === 'true';
}

// 验证 CRS URL（强制白名单）
function validateCRSUrl(urlStr: string): void;

// 调用 CRS Responses API
export async function callCRSResponses(
  config: CRSConfig,
  request: CRSResponsesRequest
): Promise<CRSResponsesOutput>;

// 转换 Vercel AI SDK prompt 为 CRS input
function convertPromptToCRSInput(prompt: LanguageModelV3CallOptions['prompt']): string | Array<{ role: string; content: string }>;

// 创建兼容 Vercel AI SDK 的 LanguageModel
export function createCRSLanguageModel(config: CRSConfig): LanguageModelV3 {
  return new CRSLanguageModel(config);
}
```

**关键实现**：
1. 实现 `LanguageModelV3` 接口（Vercel AI SDK v3）
2. `doGenerate()` - 调用 `/v1/responses`，转换格式
3. `doStream()` - Phase 1 抛出异常
4. 错误处理和重试机制（复用 `generate.ts` 的 `runWithRetry`）
5. 缓存 provider 实例

#### Phase 2: Client 集成（1-2h）

**修改文件**: `src/lib/ai/client.ts`

```typescript
// 新增导入
import { getCRSConfig, createCRSLanguageModel, isCRSMode } from './providers/crs';

// 模块加载时验证互斥性
if (process.env.USE_CRS_PROVIDER === 'true' && process.env.USE_LOCAL_PROXY === 'true') {
  throw new Error(
    'Cannot enable both CRS and LocalProxy providers. ' +
    'Set only one of USE_CRS_PROVIDER or USE_LOCAL_PROXY to true.'
  );
}

// 修改 getModel()
export function getModel(): LanguageModel {
  // 1. 检查 CRS 模式
  if (isCRSMode()) {
    const config = getCRSConfig()!;
    return createCRSLanguageModel(config);
  }

  // 2. 检查 Local Proxy 模式
  if (isLocalProxyMode()) {
    const proxy = getLocalProxyProvider();
    const config = getLocalProxyConfig()!;
    return proxy.chatModel(config.model);
  }

  // 3. 默认 Gemini
  const google = getGoogleProvider();
  const modelName = getModelName();
  return google(modelName);
}

// 同步修改 getModelWithConfig() 和 getModelWithCredential()
```

#### Phase 3: 凭证系统集成（1-2h）

**修改文件**: `src/lib/ai/client.ts`

```typescript
// 扩展 NormalizedAIConfig 类型
export interface NormalizedAIConfig {
  apiKey?: string;
  model?: string;
  provider?: 'crs' | 'local-proxy' | 'gemini';
  baseUrl?: string;
}

// 获取当前 provider
function getCurrentProvider(): 'crs' | 'local-proxy' | 'gemini' {
  if (isCRSMode()) return 'crs';
  if (isLocalProxyMode()) return 'local-proxy';
  return 'gemini';
}

// 修改 resolveCredential 支持 provider 路由
export async function resolveCredential(credentialId: string | null): Promise<NormalizedAIConfig> {
  if (!credentialId) {
    return {
      apiKey: getApiKey(),
      model: getModelName(),
      provider: getCurrentProvider(),
    };
  }

  const credential = await prisma.apiCredential.findUnique({
    where: { id: credentialId },
  });

  if (!credential || !credential.isValid) {
    console.warn(`Credential ${credentialId} not found or invalid, falling back to env`);
    return {
      apiKey: getApiKey(),
      model: getModelName(),
      provider: getCurrentProvider(),
    };
  }

  await prisma.apiCredential.update({
    where: { id: credentialId },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    apiKey: decryptApiKey(credential.encryptedKey),
    model: credential.model || getModelName(),
    provider: (credential.provider as 'crs' | 'local-proxy' | 'gemini') || 'gemini',
    baseUrl: credential.baseUrl || undefined,
  };
}

// 修改 getModelWithCredential 支持 provider 路由
export async function getModelWithCredential(credentialId: string | null): Promise<LanguageModel> {
  const config = await resolveCredential(credentialId);

  // 根据 provider 路由
  if (config.provider === 'crs') {
    if (!config.apiKey) throw new Error('No API key available for CRS');
    const crsConfig: CRSConfig = {
      enabled: true,
      baseUrl: config.baseUrl || process.env.CRS_BASE_URL || 'https://ls.xingchentech.asia/openai',
      apiKey: config.apiKey,
      model: config.model || 'gpt-5.3-codex',
      reasoningEffort: process.env.CRS_REASONING_EFFORT as CRSConfig['reasoningEffort'],
      disableStorage: process.env.CRS_DISABLE_STORAGE === 'true',
    };
    return createCRSLanguageModel(crsConfig);
  }

  if (config.provider === 'local-proxy') {
    const proxy = getLocalProxyProvider();
    return proxy.chatModel(config.model || 'gemini-3.1-pro-high');
  }

  // 默认 Gemini
  if (!config.apiKey) throw new Error('No API key available');
  const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
  return google(config.model || 'gemini-2.0-flash');
}

// 修改 getModelWithConfig 支持 provider 路由
export function getModelWithConfig(config: AIClientConfig & { provider?: string; baseUrl?: string }): LanguageModel {
  // 根据 provider 路由
  if (config.provider === 'crs') {
    const crsConfig: CRSConfig = {
      enabled: true,
      baseUrl: config.baseUrl || process.env.CRS_BASE_URL || 'https://ls.xingchentech.asia/openai',
      apiKey: config.apiKey || config.geminiApiKey || '',
      model: config.model || config.geminiModel || 'gpt-5.3-codex',
      reasoningEffort: process.env.CRS_REASONING_EFFORT as CRSConfig['reasoningEffort'],
      disableStorage: process.env.CRS_DISABLE_STORAGE === 'true',
    };
    return createCRSLanguageModel(crsConfig);
  }

  // 检查环境变量优先级
  if (isLocalProxyMode()) {
    const proxy = getLocalProxyProvider();
    const proxyConfig = getLocalProxyConfig()!;
    return proxy.chatModel(proxyConfig.model);
  }

  // 默认 Gemini
  const normalized = normalizeConfig(config);
  const apiKey = normalized.apiKey || getApiKey();
  const modelName = normalized.model || getModelName();

  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }

  const google = createGoogleGenerativeAI({ apiKey });
  return google(modelName);
}
```

**修改文件**: `src/app/api/config/validate/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, getKeyHint } from "@/lib/crypto";
import { createCRSLanguageModel, type CRSConfig } from "@/lib/ai/providers/crs";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, model, credentialId, provider, baseUrl } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // 根据 provider 验证
    if (provider === 'crs') {
      // 验证 CRS 配置
      const crsConfig: CRSConfig = {
        enabled: true,
        baseUrl: baseUrl || 'https://ls.xingchentech.asia/openai',
        apiKey,
        model: model || 'gpt-5.3-codex',
        reasoningEffort: 'low', // 验证时使用低推理
        disableStorage: true,
      };

      // 测试连接
      const crsModel = createCRSLanguageModel(crsConfig);
      await generateText({
        model: crsModel,
        prompt: "Hi",
      });
    } else {
      // 默认 Gemini 验证
      const validationModel = model?.includes("preview") || model?.includes("exp")
        ? "gemini-2.0-flash"
        : (model || "gemini-2.0-flash");

      const google = createGoogleGenerativeAI({ apiKey });
      await generateText({
        model: google(validationModel),
        prompt: "Hi",
      });
    }

    // 存储加密凭证
    const encryptedKey = encryptApiKey(apiKey);
    const keyHint = getKeyHint(apiKey);

    let credential;
    if (credentialId) {
      // 更新现有凭证
      credential = await prisma.apiCredential.update({
        where: { id: credentialId },
        data: {
          encryptedKey,
          keyHint,
          provider: provider || "gemini",
          baseUrl: baseUrl || null,
          model: model || (provider === 'crs' ? 'gpt-5.3-codex' : 'gemini-2.5-flash'),
          isValid: true,
          lastValidatedAt: new Date(),
        },
      });
    } else {
      // 创建新凭证
      credential = await prisma.apiCredential.create({
        data: {
          encryptedKey,
          keyHint,
          provider: provider || "gemini",
          baseUrl: baseUrl || null,
          model: model || (provider === 'crs' ? 'gpt-5.3-codex' : 'gemini-2.5-flash'),
          isValid: true,
          lastValidatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      valid: true,
      credentialId: credential.id,
      keyHint: credential.keyHint,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // 区分内部错误和 API 错误
    if (message.includes("KEY_ENCRYPTION_SECRET") || message.includes("Prisma") || message.includes("database")) {
      console.error("Config validation internal error:", message);
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 }
      );
    }

    // 日志脱敏
    console.error("Config validation error:", message.replace(/AIza[a-zA-Z0-9_-]+/g, "[API_KEY_REDACTED]"));

    const errorMessage = message.includes("model")
      ? "Invalid model name"
      : "Invalid API key or provider configuration";
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
```

**数据库迁移**（无需修改）：
- `ApiCredential` 表已有 `provider` 和 `baseUrl` 字段
- 现有数据默认 `provider: "gemini"`，兼容

#### Phase 4: 环境变量配置（0.5h）

**修改文件**: `.env.example`

```bash
# CRS Provider (Codex Response Service)
USE_CRS_PROVIDER=false
CRS_BASE_URL=https://ls.xingchentech.asia/openai
CRS_API_KEY=your-crs-api-key
CRS_MODEL=gpt-5.3-codex
CRS_REASONING_EFFORT=xhigh  # low/medium/high/xhigh
CRS_DISABLE_STORAGE=true    # true/false
```

---

## 三、安全考虑

### 3.1 URL 验证（强制白名单）

```typescript
const ALLOWED_CRS_DOMAINS = ['ls.xingchentech.asia'];

function validateCRSUrl(urlStr: string): void {
  const url = new URL(urlStr);

  // 1. 协议检查（仅 HTTPS）
  if (url.protocol !== 'https:') {
    throw new Error(`CRS must use HTTPS, got: ${url.protocol}`);
  }

  // 2. 强制域名白名单
  if (!ALLOWED_CRS_DOMAINS.includes(url.hostname)) {
    throw new Error(
      `CRS URL not in whitelist. Allowed: ${ALLOWED_CRS_DOMAINS.join(', ')}, got: ${url.hostname}`
    );
  }

  // 3. 禁止 URL 中的凭证
  if (url.username || url.password) {
    throw new Error('CRS URL must not contain credentials');
  }

  // 4. 禁止查询参数和片段
  if (url.search || url.hash) {
    throw new Error('CRS URL must not contain query parameters or fragments');
  }

  // 5. 端口检查（仅允许标准 443）
  if (url.port && url.port !== '443') {
    throw new Error(`CRS URL must use standard HTTPS port (443), got: ${url.port}`);
  }
}
```

### 3.2 Fail-Closed 策略

遵循现有 LocalProxy 的模式：

```typescript
if (!config || !config.enabled) {
  throw new Error('CRS provider not enabled');
}
if (!config.apiKey) {
  throw new Error('CRS enabled but CRS_API_KEY not set');
}
```

### 3.3 API Key 保护

- 不在日志中输出 API Key
- 使用环境变量存储
- 支持数据库加密存储（复用现有 `ApiCredential` 表）

---

## 四、兼容性设计

### 4.1 与 Vercel AI SDK 集成

CRS Responses API 返回格式与标准 Chat Completions 不同，需要适配：

```typescript
// CRS 响应格式
{
  "output_text": "...",
  "usage": { "input_tokens": 20, "output_tokens": 11 }
}

// 转换为 Vercel AI SDK 兼容格式
{
  text: response.output_text,
  usage: {
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens
  }
}
```

### 4.2 流式响应支持

**Phase 1 不实现流式**，原因：
1. CRS Responses API 流式格式未知
2. 当前项目主要使用 `generateObject()`，非流式场景
3. 可在后续 Phase 补充

### 4.3 工具调用支持

**Phase 1 不实现工具调用**，原因：
1. 需要验证 CRS 是否支持 function calling
2. 当前 ReAct Agent 主要使用 Gemini
3. 可在后续 Phase 补充

---

## 五、验收标准

### 5.1 功能验收

- [ ] 环境变量 `USE_CRS_PROVIDER=true` 时，`getModel()` 返回 CRS provider
- [ ] CRS provider 可以成功调用 `/v1/responses` 端点
- [ ] 返回的 `LanguageModel` 与 Gemini 行为一致
- [ ] `reasoning_effort` 参数正确传递
- [ ] `store` 参数正确传递

### 5.2 技术验收

- [ ] TypeScript 编译通过（`npm run type-check`）
- [ ] ESLint 检查通过（`npm run lint`）
- [ ] 现有测试不受影响（`npm run test`）
- [ ] 手动测试：入库一个 URL，使用 CRS provider 处理成功

### 5.3 安全验收

- [ ] URL 验证生效（拒绝非 HTTPS）
- [ ] API Key 不在日志中泄露
- [ ] Fail-closed 策略生效（配置错误时抛出异常）

---

## 六、风险评估与发布门槛

### 6.1 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 | 监控指标 |
|------|------|------|----------|----------|
| CRS API 格式变更 | 中 | 高 | 版本锁定，监控 API 变更 | API 错误率 |
| 响应格式不兼容 | 低 | 中 | 充分测试，添加格式转换层 | 解析失败率 |
| 性能问题 | 低 | 低 | 监控响应时间，必要时降级 | P95 延迟 |
| API Key 泄露 | 低 | 高 | 环境变量 + 加密存储 | 安全审计 |
| Provider 冲突 | 低 | 高 | 启动时互斥验证 | 启动失败率 |
| 适配器实现缺陷 | 中 | 高 | 完整测试矩阵 | 单元测试覆盖率 |

### 6.2 发布门槛

#### Phase 1 发布条件
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] TypeScript 编译通过
- [ ] ESLint 检查通过
- [ ] 手动测试：文本入库成功
- [ ] 手动测试：对象生成成功（`generateObject`）
- [ ] 互斥验证生效（同时启用两个 provider 时抛出异常）
- [ ] URL 验证生效（非白名单域名被拒绝）
- [ ] API Key 不在日志中泄露

#### 监控指标
- **成功率**: CRS API 调用成功率 ≥ 95%
- **延迟**: P95 响应时间 ≤ 5s
- **错误率**: 解析失败率 ≤ 2%
- **降级率**: 降级到 Gemini 的比例（如实现降级）

### 6.3 回滚策略

**Kill Switch**:
```bash
# 紧急回滚：禁用 CRS
USE_CRS_PROVIDER=false
```

**降级策略**（可选，Phase 2 实现）:
- CRS 连续失败 3 次 → 自动降级到 Gemini
- 记录降级事件到日志
- 5 分钟后重试 CRS

---

## 七、后续优化（Phase 2+）

### Phase 2: 多模态和工具调用支持（3-4h）
1. **多模态输入**
   - 图片输入（URL 和 Base64）
   - PDF 文件输入
   - 更新 `doGenerate()` 支持 `image` content type

2. **工具调用支持**
   - 实现 function calling
   - 更新 `capabilities` 声明
   - 测试 ReAct Agent 集成

3. **流式响应**（如需要）
   - 实现 `doStream()`
   - 处理 SSE 格式

### Phase 3: 性能优化（1-2h）
1. **性能监控**（响应时间、成功率）
2. **成本对比**（CRS vs Gemini）
3. **降级策略**（自动 fallback）

### Phase 4: UI 切换（2-3h）
1. **前端选择 provider**
2. **对比模式**（同一内容并行处理）

---

## 八、实施时间线

```
2026-03-05  Phase 1 开始（CRS Provider 封装）
2026-03-05  Phase 2 开始（Client 集成）
2026-03-05  Phase 3 开始（凭证系统集成）
2026-03-05  Phase 4 开始（环境变量配置）
2026-03-05  验收测试
2026-03-05  Codex 最终评审
```

**总预计工时**：5.5-8h（Phase 1-4）

---

*计划制定时间: 2026-03-05*
*v1.1 修订完成，待 Codex 最终评审*
