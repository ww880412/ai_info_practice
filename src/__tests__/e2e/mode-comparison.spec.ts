import { expect, test, type Page } from "@playwright/test";

const mockEntries = [
  {
    id: "entry-1",
    title: "Test Entry 1",
    sourceType: "WEBPAGE",
    processStatus: "DONE",
    contentType: "TUTORIAL",
    techDomain: "AGENT",
    coreSummary: "Summary 1",
    practiceValue: "ACTIONABLE",
    aiTags: ["tag-a", "tag-b"],
    userTags: [],
    createdAt: "2026-03-08T00:00:00.000Z",
  },
  {
    id: "entry-2",
    title: "Test Entry 2",
    sourceType: "WEBPAGE",
    processStatus: "DONE",
    contentType: "TUTORIAL",
    techDomain: "RAG",
    coreSummary: "Summary 2",
    practiceValue: "ACTIONABLE",
    aiTags: ["tag-c"],
    userTags: [],
    createdAt: "2026-03-08T00:00:00.000Z",
  },
  {
    id: "entry-3",
    title: "Test Entry 3",
    sourceType: "WEBPAGE",
    processStatus: "DONE",
    contentType: "TUTORIAL",
    techDomain: "PROMPT_ENGINEERING",
    coreSummary: "Summary 3",
    practiceValue: "ACTIONABLE",
    aiTags: ["tag-d"],
    userTags: [],
    createdAt: "2026-03-08T00:00:00.000Z",
  },
];

async function mockLibraryApis(page: Page) {
  await page.route(/\/api\/entries(\?.*)?$/, async (route) => {
    const method = route.request().method();

    if (method === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ deletedCount: 1 }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: mockEntries,
        total: mockEntries.length,
      }),
    });
  });

  await page.route("**/api/groups", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
      }),
    });
  });

  await page.route(/\/api\/tags\/stats(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          aiTags: [],
          userTags: [],
        },
      }),
    });
  });
}

function makeCompletedBatchResponse() {
  return {
    data: {
      batchId: "test-batch-123",
      status: "completed",
      progress: 100,
      entryCount: 3,
      completedCount: 3,
      results: [
        {
          entryId: "entry-1",
          entryTitle: "Test Entry 1",
          originalMode: "two-step",
          comparisonMode: "tool-calling",
          winner: "comparison",
          scoreDiff: 8.5,
          originalScore: {
            overallScore: 78,
            dimensions: {
              completeness: 80,
              accuracy: 76,
              relevance: 82,
              clarity: 74,
              actionability: 72,
            },
          },
          comparisonScore: {
            overallScore: 86.5,
            dimensions: {
              completeness: 89,
              accuracy: 84,
              relevance: 88,
              clarity: 85,
              actionability: 81,
            },
          },
        },
        {
          entryId: "entry-2",
          entryTitle: "Test Entry 2",
          originalMode: "two-step",
          comparisonMode: "tool-calling",
          winner: "comparison",
          scoreDiff: 6.2,
          originalScore: {
            overallScore: 75,
            dimensions: {
              completeness: 74,
              accuracy: 76,
              relevance: 77,
              clarity: 73,
              actionability: 70,
            },
          },
          comparisonScore: {
            overallScore: 81.2,
            dimensions: {
              completeness: 82,
              accuracy: 83,
              relevance: 80,
              clarity: 81,
              actionability: 76,
            },
          },
        },
        {
          entryId: "entry-3",
          entryTitle: "Test Entry 3",
          originalMode: "two-step",
          comparisonMode: "tool-calling",
          winner: "original",
          scoreDiff: -2.5,
          originalScore: {
            overallScore: 84,
            dimensions: {
              completeness: 86,
              accuracy: 84,
              relevance: 85,
              clarity: 82,
              actionability: 80,
            },
          },
          comparisonScore: {
            overallScore: 81.5,
            dimensions: {
              completeness: 80,
              accuracy: 82,
              relevance: 81,
              clarity: 80,
              actionability: 78,
            },
          },
        },
      ],
      stats: {
        originalWins: 1,
        comparisonWins: 2,
        ties: 0,
        avgScoreDiff: 4.07,
        dimensionBreakdown: {
          completeness: 3.2,
          accuracy: 4.1,
          relevance: 2.8,
          clarity: 3.7,
          actionability: 2.9,
        },
      },
    },
  };
}

test.describe("Mode Comparison E2E", () => {
  test.beforeEach(async ({ page }) => {
    await mockLibraryApis(page);
    await page.goto("/library");
    await expect(page.locator("[data-testid='entry-card']").first()).toBeVisible();
  });

  test("complete mode comparison flow", async ({ page }) => {
    let batchStatusCallCount = 0;

    await page.route("**/api/entries/compare-modes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            batchId: "test-batch-123",
            entryCount: 3,
            estimatedTime: "约 3 分钟",
          },
        }),
      });
    });

    await page.route("**/api/entries/compare-modes/test-batch-123", async (route) => {
      batchStatusCallCount += 1;
      if (batchStatusCallCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              batchId: "test-batch-123",
              status: "processing",
              progress: 33,
              entryCount: 3,
              completedCount: 1,
              results: null,
              stats: null,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeCompletedBatchResponse()),
      });
    });

    await page.click("button:has-text('批量选择')");
    await expect(page.locator("text=已选择 0 个条目")).toBeVisible();

    const entryCards = page.locator("[data-testid='entry-card']");
    const entryCount = await entryCards.count();
    expect(entryCount).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(3, entryCount); i += 1) {
      await entryCards.nth(i).click();
    }
    await expect(page.locator("text=已选择 3 个条目")).toBeVisible();

    await page.click("button:has-text('模式对比')");
    await expect(page.locator("text=选择要对比的目标模式")).toBeVisible();

    await page.check("input[value='tool-calling']");
    await expect(page.locator("input[value='tool-calling']")).toBeChecked();

    await page.click("button:has-text('开始对比')");

    await page.waitForURL(/\/comparison\/[a-z0-9-]+/);
    await expect(page.locator("h1:has-text('模式对比结果')")).toBeVisible();
    await expect(page.locator("text=处理进度")).toBeVisible();
    await expect(page.locator("text=处理中...")).toBeVisible();

    await page.waitForSelector("text=详细结果", { timeout: 120000 });
    await expect(page.locator("text=胜率")).toBeVisible();
    await expect(page.locator("text=平均分差")).toBeVisible();

    const resultCards = page.locator("[data-testid='comparison-result-card']");
    await expect(resultCards).toHaveCount(3);

    await resultCards.first().click();
    await page.waitForURL(/\/comparison\/[a-z0-9-]+\/entry\/[a-z0-9-]+/);

    await expect(page.locator("text=原始模式")).toBeVisible();
    await expect(page.locator("text=对比模式")).toBeVisible();
    await expect(page.locator("text=总体评分")).toBeVisible();
    await expect(page.locator("text=维度对比")).toBeVisible();

    await page.click("button[aria-label='返回']");
    await page.waitForURL(/\/comparison\/[a-z0-9-]+$/);
    await page.click("button[aria-label='返回']");
    await page.waitForURL("/library");
  });

  test("handle empty selection", async ({ page }) => {
    await page.click("button:has-text('批量选择')");
    const compareButton = page.locator("button:has-text('模式对比')");
    await expect(compareButton).toBeDisabled();
  });

  test("handle API error gracefully", async ({ page }) => {
    await page.route("**/api/entries/compare-modes", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid entry IDs" }),
      });
    });

    await page.click("button:has-text('批量选择')");
    await page.locator("[data-testid='entry-card']").first().click();
    await page.click("button:has-text('模式对比')");
    await page.click("button:has-text('开始对比')");

    await expect(page.locator("text=创建对比任务失败")).toBeVisible();
  });

  test("polling stops when batch is completed", async ({ page }) => {
    let callCount = 0;

    await page.route("**/api/entries/compare-modes/test-batch-123", async (route) => {
      callCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeCompletedBatchResponse()),
      });
    });

    await page.goto("/comparison/test-batch-123");
    await expect(page.locator("text=详细结果")).toBeVisible();
    await expect(page.locator("text=处理中...")).not.toBeVisible();

    const settledCount = callCount;
    await page.waitForTimeout(5000);
    expect(callCount).toBe(settledCount);
  });

  test("select all and clear selection", async ({ page }) => {
    await page.click("button:has-text('批量选择')");
    await page.click("button:has-text('全选')");

    const entryCount = await page.locator("[data-testid='entry-card']").count();
    await expect(page.locator(`text=已选择 ${entryCount} 个条目`)).toBeVisible();

    await page.click("button:has-text('清空')");
    await expect(page.locator("text=已选择 0 个条目")).toBeVisible();
  });

  test("exit selection mode clears selection", async ({ page }) => {
    await page.click("button:has-text('批量选择')");
    await page.locator("[data-testid='entry-card']").first().click();
    await expect(page.locator("text=已选择 1 个条目")).toBeVisible();

    await page.click("button:has-text('退出选择')");
    await page.click("button:has-text('批量选择')");
    await expect(page.locator("text=已选择 0 个条目")).toBeVisible();
  });
});
