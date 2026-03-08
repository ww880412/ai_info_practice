# Mode Comparison E2E Tests - Task 11

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建端到端测试，覆盖完整的模式对比流程（前端 + 后端）

**Architecture:** 使用 Playwright 进行 E2E 测试，覆盖用户完整操作流程

**Tech Stack:** Playwright, TypeScript, Vitest

---

## Task 11: E2E 测试 - 模式对比完整流程

### Step 1: 创建 E2E 测试文件

**Files:**
- Create: `src/__tests__/e2e/mode-comparison.spec.ts`

创建 E2E 测试：

```typescript
import { test, expect } from '@playwright/test';

test.describe('Mode Comparison E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to library page
    await page.goto('/library');
  });

  test('complete mode comparison flow', async ({ page }) => {
    // Step 1: Enter selection mode
    await page.click('button:has-text("批量选择")');
    await expect(page.locator('text=已选择 0 个条目')).toBeVisible();

    // Step 2: Select multiple entries
    const entryCards = page.locator('[data-testid="entry-card"]');
    const entryCount = await entryCards.count();
    expect(entryCount).toBeGreaterThan(0);

    // Select first 3 entries
    for (let i = 0; i < Math.min(3, entryCount); i++) {
      await entryCards.nth(i).click();
    }

    await expect(page.locator('text=已选择 3 个条目')).toBeVisible();

    // Step 3: Open comparison dialog
    await page.click('button:has-text("模式对比")');
    await expect(page.locator('text=选择要对比的目标模式')).toBeVisible();

    // Step 4: Select target mode
    await page.click('input[value="tool-calling"]');
    await expect(page.locator('input[value="tool-calling"]')).toBeChecked();

    // Step 5: Start comparison
    await page.click('button:has-text("开始对比")');

    // Step 6: Wait for navigation to comparison result page
    await page.waitForURL(/\/comparison\/[a-z0-9-]+/);
    await expect(page.locator('h1:has-text("模式对比结果")')).toBeVisible();

    // Step 7: Verify processing state
    await expect(page.locator('text=处理进度')).toBeVisible();
    await expect(page.locator('text=处理中...')).toBeVisible();

    // Step 8: Wait for completion (with timeout)
    await page.waitForSelector('text=详细结果', { timeout: 120000 });

    // Step 9: Verify statistics are displayed
    await expect(page.locator('text=胜率')).toBeVisible();
    await expect(page.locator('text=平均分差')).toBeVisible();

    // Step 10: Verify result list
    const resultCards = page.locator('[data-testid="comparison-result-card"]');
    const resultCount = await resultCards.count();
    expect(resultCount).toBe(3);

    // Step 11: Click on first result to view detail
    await resultCards.first().click();

    // Step 12: Wait for navigation to detail page
    await page.waitForURL(/\/comparison\/[a-z0-9-]+\/entry\/[a-z0-9-]+/);

    // Step 13: Verify detail page content
    await expect(page.locator('text=原始模式')).toBeVisible();
    await expect(page.locator('text=对比模式')).toBeVisible();
    await expect(page.locator('text=总体评分')).toBeVisible();
    await expect(page.locator('text=维度对比')).toBeVisible();

    // Step 14: Navigate back to batch results
    await page.click('button[aria-label="返回"]');
    await page.waitForURL(/\/comparison\/[a-z0-9-]+$/);

    // Step 15: Navigate back to library
    await page.click('button[aria-label="返回"]');
    await page.waitForURL('/library');
  });

  test('handle empty selection', async ({ page }) => {
    // Enter selection mode
    await page.click('button:has-text("批量选择")');

    // Try to open comparison dialog without selecting entries
    const compareButton = page.locator('button:has-text("模式对比")');
    await expect(compareButton).toBeDisabled();
  });

  test('handle API error gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('/api/entries/compare-modes', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid entry IDs' }),
      });
    });

    // Enter selection mode and select entries
    await page.click('button:has-text("批量选择")');
    const entryCards = page.locator('[data-testid="entry-card"]');
    await entryCards.first().click();

    // Open comparison dialog
    await page.click('button:has-text("模式对比")');

    // Start comparison
    await page.click('button:has-text("开始对比")');

    // Verify error message is displayed
    await expect(page.locator('text=创建对比任务失败')).toBeVisible();
  });

  test('polling stops when batch is completed', async ({ page }) => {
    // Navigate to a completed batch (mock data)
    await page.route('/api/entries/compare-modes/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            batchId: 'test-batch-123',
            status: 'completed',
            progress: 100,
            entryCount: 3,
            completedCount: 3,
            results: [
              {
                entryId: 'entry1',
                entryTitle: 'Test Entry 1',
                originalMode: 'two-step',
                comparisonMode: 'tool-calling',
                winner: 'comparison',
                scoreDiff: 8.5,
              },
            ],
            stats: {
              originalWins: 1,
              comparisonWins: 2,
              ties: 0,
              avgScoreDiff: 5.5,
              dimensionBreakdown: {
                completeness: 3,
                accuracy: 5,
                relevance: 7,
                clarity: 4,
                actionability: 6,
              },
            },
          },
        }),
      });
    });

    await page.goto('/comparison/test-batch-123');

    // Verify completed state
    await expect(page.locator('text=详细结果')).toBeVisible();
    await expect(page.locator('text=处理中...')).not.toBeVisible();

    // Wait a bit and verify no additional API calls (polling stopped)
    await page.waitForTimeout(5000);
    // If polling continued, we would see loading indicators
  });

  test('select all and clear selection', async ({ page }) => {
    // Enter selection mode
    await page.click('button:has-text("批量选择")');

    // Click select all
    await page.click('button:has-text("全选")');

    // Verify all entries are selected
    const entryCards = page.locator('[data-testid="entry-card"]');
    const entryCount = await entryCards.count();
    await expect(page.locator(`text=已选择 ${entryCount} 个条目`)).toBeVisible();

    // Click clear
    await page.click('button:has-text("清空")');

    // Verify selection is cleared
    await expect(page.locator('text=已选择 0 个条目')).toBeVisible();
  });

  test('exit selection mode clears selection', async ({ page }) => {
    // Enter selection mode
    await page.click('button:has-text("批量选择")');

    // Select some entries
    const entryCards = page.locator('[data-testid="entry-card"]');
    await entryCards.first().click();
    await expect(page.locator('text=已选择 1 个条目')).toBeVisible();

    // Exit selection mode
    await page.click('button:has-text("退出选择")');

    // Re-enter selection mode
    await page.click('button:has-text("批量选择")');

    // Verify selection was cleared
    await expect(page.locator('text=已选择 0 个条目')).toBeVisible();
  });
});
```

### Step 2: 添加测试数据标识

在实现的组件中添加 `data-testid` 属性：

**src/app/library/page.tsx**:
```typescript
<div data-testid="entry-card" className="...">
  {/* entry card content */}
</div>
```

**src/components/comparison/ComparisonList.tsx**:
```typescript
<Card data-testid="comparison-result-card" className="...">
  {/* result card content */}
</Card>
```

### Step 3: 配置 Playwright

**Files:**
- Modify: `playwright.config.ts`

确保 Playwright 配置正确：

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Step 4: 运行 E2E 测试

Run: `npx playwright test src/__tests__/e2e/mode-comparison.spec.ts`
Expected: All tests passing

### Step 5: 生成测试报告

Run: `npx playwright show-report`
Expected: HTML report showing all test results

### Step 6: Commit

```bash
git add src/__tests__/e2e/mode-comparison.spec.ts playwright.config.ts
git commit -m "test(e2e): add comprehensive mode comparison E2E tests

- Test complete flow: selection → dialog → batch → results → detail
- Test empty selection handling
- Test API error handling
- Test polling behavior (start/stop)
- Test select all and clear selection
- Test exit selection mode
- Add data-testid attributes for test selectors
- Configure Playwright for E2E testing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] E2E 测试覆盖完整流程（6 个测试场景）
- [ ] 测试选择模式、对比创建、结果展示、详情查看
- [ ] 测试错误处理和边界情况
- [ ] 测试轮询行为
- [ ] 所有 E2E 测试通过
- [ ] 测试报告生成成功
- [ ] 代码已提交到 Git

---

**任务创建日期**: 2026-03-08
**预计工时**: 2-3 小时
**前置任务**: Task 7-10（前端所有组件）
