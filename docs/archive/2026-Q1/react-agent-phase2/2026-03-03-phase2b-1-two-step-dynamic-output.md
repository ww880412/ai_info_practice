# Phase 2b-1: 两步模式动态输出

**版本**: v1.3
**日期**: 2026-03-03
**状态**: 实施完成，待 Layer 3 验证
**前置**: Phase 2a 已完成

---

## 背景

Phase 2b 经过 5 轮 Codex 评审后拆分为两个子阶段：
- **Phase 2b-1**：两步模式动态输出（本文档）
- **Phase 2b-2**：tool-calling 模式动态输出（需架构调整，待后续）

**拆分原因**：
1. 两步模式改动小、风险低，`mergeTwoStepResults` 行为正确
2. tool-calling 模式涉及 `executeWithTools` 合并逻辑调整，复杂度高

---

## 目标

让两步模式下 `summaryStructure.fields` 根据内容长度动态填充。

---

## 技术方案

### 改动范围

| 改动类型 | 文件 | 内容 |
|----------|------|------|
| **新增** | content-depth.ts | `getContentDepth()`, `getFieldsGuidance()` |
| **修改** | engine.ts | `buildStep2Prompt()` 注入 fieldsGuidance |
| **修复** | schemas.ts | `getRequiredFields('api-reference')` → `[]`；移除 3 个 `type: z.literal()` |

### 不改动

- `evaluateDecisionQuality` — 复用现有检查
- `mergeTwoStepResults` — Step 2 覆盖行为正确
- `sdk-tools.ts` — 留给 Phase 2b-2

### 内容分级

| 内容长度 | 分级 | fields 要求 |
|----------|------|-------------|
| < 2000 字 | SHORT | 必填字段（最少 2 个）|
| 2000-10000 字 | MEDIUM | 必填 + 常用可选 |
| > 10000 字 | LONG | 完整字段 |

**v1.1 新增规则**：当 `requiredFields.length < 2` 时（如 `api-reference`=0、`generic`=1、`timeline-evolution`=1），SHORT 也至少输出 2 个推荐字段，以满足质量门槛 `summaryFieldCount >= 2`。

---

## 验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC1 | 两步模式输出非空 fields（至少 2 个） | 手动测试 |
| AC2 | fields 与 UI 渲染器兼容 | DynamicSummary 正常显示 |
| AC3 | `npm run test` 通过 | 自动化 |
| AC4 | TypeScript 编译通过 | `npx tsc --noEmit` |
| AC5 | 回归：现有功能不受影响 | 手动测试 |

---

## 测试策略（v1.1 新增）

### 自动化测试

```typescript
// content-depth.test.ts
describe('getContentDepth', () => {
  it('boundary 1999/2000', () => {
    expect(getContentDepth(1999)).toBe('SHORT');
    expect(getContentDepth(2000)).toBe('MEDIUM');
  });
  it('boundary 10000/10001', () => {
    expect(getContentDepth(10000)).toBe('MEDIUM');
    expect(getContentDepth(10001)).toBe('LONG');
  });
});

// schemas.test.ts
describe('getRequiredFields', () => {
  it('api-reference returns []', () => {
    expect(getRequiredFields('api-reference')).toEqual([]);
  });
  it('generic returns only 1 field', () => {
    expect(getRequiredFields('generic')).toEqual(['summary']);
  });
  it('timeline-evolution returns only 1 field', () => {
    expect(getRequiredFields('timeline-evolution')).toEqual(['events']);
  });
});

// content-depth.test.ts - v1.3 改进保底测试（解析并计数字段名）
describe('getFieldsGuidance minimum 2 fields guarantee', () => {
  // 定义各类型的推荐字段
  const recommendedFieldsByType: Record<string, string[]> = {
    'api-reference': ['endpoint', 'returnValue'],
    'generic': ['summary', 'keyPoints'],
    'timeline-evolution': ['events', 'currentStatus'],
  };

  it.each(['api-reference', 'generic', 'timeline-evolution'])(
    '%s SHORT guidance includes at least 2 field names',
    (type) => {
      const guidance = getFieldsGuidance('SHORT', type);
      const expectedFields = recommendedFieldsByType[type];
      // 验证 guidance 包含至少 2 个实际字段名
      const foundFields = expectedFields.filter(field => guidance.includes(field));
      expect(foundFields.length).toBeGreaterThanOrEqual(2);
    }
  );
});
```

---

## 工作量

| 任务 | 估时 |
|------|------|
| content-depth.ts | 30min |
| engine.ts 修改 | 30min |
| schemas.ts 修复 | 15min |
| 测试 | 30min |
| 手动验收 | 15min |
| **合计** | **2h** |

---

## 后续

Phase 2b-1 验证后，再推进 Phase 2b-2：
- 需要重新设计 `executeWithTools` 合并逻辑
- `sdk-tools.ts` 的 `extract_summary` 需要输出 `summaryStructure.fields`

---

*文档版本: v1.3 | 改进测试：解析并计数字段名 >= 2*
