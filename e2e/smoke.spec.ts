import { test, expect } from "@playwright/test";

// ─── Navigation & Page Load ───

test.describe("Navigation", () => {
  test("root redirects to dashboard", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.url()).toContain("/dashboard");
  });

  test("dashboard page loads", async ({ page }) => {
    await page.goto("/dashboard");
    // "AI" and "Practice Hub" are in separate spans
    await expect(page.locator("nav")).toContainText("Practice Hub");
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("library page loads", async ({ page }) => {
    await page.goto("/library");
    await expect(page.locator("h1")).toContainText("Knowledge Base");
  });

  test("practice page loads", async ({ page }) => {
    await page.goto("/practice");
    await expect(page.locator("h1")).toContainText("Practice Queue");
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1")).toContainText("Settings");
  });

  test("navbar links navigate correctly", async ({ page }) => {
    await page.goto("/dashboard");

    await page.click('nav a[href="/library"]');
    await expect(page).toHaveURL(/\/library/);

    await page.click('nav a[href="/practice"]');
    await expect(page).toHaveURL(/\/practice/);

    await page.click('nav a[href="/settings"]');
    await expect(page).toHaveURL(/\/settings/);

    await page.click('nav a[href="/dashboard"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// ─── Dashboard ───

test.describe("Dashboard", () => {
  test("shows stats cards", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForResponse((resp) =>
      resp.url().includes("/api/dashboard/stats") && resp.status() === 200
    );
    await expect(page.locator("text=Total Entries")).toBeVisible();
    await expect(page.locator("text=This Week")).toBeVisible();
    await expect(page.locator("text=Processing")).toBeVisible();
    await expect(page.locator("text=Failed")).toBeVisible();
  });

  test("To Review card links to filtered library", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForResponse((resp) =>
      resp.url().includes("/api/dashboard/stats") && resp.status() === 200
    );
    const reviewLink = page.locator('a[href*="knowledgeStatus=TO_REVIEW"]');
    if ((await reviewLink.count()) > 0) {
      await reviewLink.first().click();
      await expect(page).toHaveURL(/knowledgeStatus=TO_REVIEW/);
    }
  });

  test("knowledge status and weekly trend render", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForResponse((resp) =>
      resp.url().includes("/api/dashboard/stats") && resp.status() === 200
    );
    await expect(page.locator("text=Knowledge Status")).toBeVisible();
    await expect(page.locator("text=Weekly Trend")).toBeVisible();
  });
});

// ─── Library ───

test.describe("Library", () => {
  test("shows entry list or empty state", async ({ page }) => {
    await page.goto("/library");
    await page.waitForResponse((resp) =>
      resp.url().includes("/api/entries") && resp.status() === 200
    );
    // Entry cards use div with h3 headings, not <a> links
    const hasEntries = (await page.locator("h3").count()) > 0;
    const hasEmpty = (await page.locator("text=No entries found").count()) > 0
      || (await page.locator("text=no entries").count()) > 0;
    expect(hasEntries || hasEmpty).toBeTruthy();
  });

  test("search input is functional", async ({ page }) => {
    await page.goto("/library");
    const searchInput = page.locator('input[placeholder*="earch"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("test query");
    await expect(searchInput).toHaveValue("test query");
  });

  test("knowledge status tabs work", async ({ page }) => {
    await page.goto("/library");
    await page.waitForResponse((resp) =>
      resp.url().includes("/api/entries") && resp.status() === 200
    );
    const activeTab = page.locator("button", { hasText: "Active" });
    if ((await activeTab.count()) > 0) {
      await activeTab.first().click();
      await page.waitForResponse((resp) =>
        resp.url().includes("/api/entries") && resp.status() === 200
      );
    }
  });

  test("Add button opens ingest dialog", async ({ page }) => {
    await page.goto("/library");
    const addButton = page.locator("button", { hasText: /Add|新增/ });
    await expect(addButton.first()).toBeVisible();
    await addButton.first().click();
    await expect(page.locator("button", { hasText: "Link" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Text" })).toBeVisible();
  });

  test("sort controls work", async ({ page }) => {
    await page.goto("/library");
    await page.waitForResponse((resp) =>
      resp.url().includes("/api/entries") && resp.status() === 200
    );
    const sortControl = page.locator("select, button", {
      hasText: /sort|Sort|Created|Updated/,
    });
    if ((await sortControl.count()) > 0) {
      await expect(sortControl.first()).toBeVisible();
    }
  });
});

// ─── Ingest Dialog ───

test.describe("Ingest Dialog", () => {
  test("can switch between Link/File/Text tabs", async ({ page }) => {
    await page.goto("/library");
    await page.locator("button", { hasText: /Add|新增/ }).first().click();

    // Text tab
    await page.locator("button", { hasText: "Text" }).click();
    await expect(page.locator("textarea")).toBeVisible();

    // Link tab - uses textarea for multi-URL
    await page.locator("button", { hasText: "Link" }).click();
    await expect(page.locator('textarea[placeholder*="URL"]')).toBeVisible();
  });

  test("text ingest has submit button", async ({ page }) => {
    await page.goto("/library");
    await page.locator("button", { hasText: /Add|新增/ }).first().click();
    await page.locator("button", { hasText: "Text" }).click();
    await page.locator("textarea").fill("E2E test content for Playwright.");
    const submitBtn = page.locator("button", { hasText: /Submit|提交|Add|Process/ });
    await expect(submitBtn.first()).toBeEnabled();
  });
});

// ─── Settings ───

test.describe("Settings", () => {
  test("shows API key input and model selector", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator("select")).toBeVisible();
  });

  test("can toggle API key visibility", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await page.locator("button").filter({ has: page.locator("svg") }).first().click();
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test("save button exists", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("button", { hasText: /Save|保存/ })).toBeVisible();
  });
});

// ─── Practice ───

test.describe("Practice", () => {
  test("shows status filter tabs", async ({ page }) => {
    await page.goto("/practice");
    await expect(page.locator("button", { hasText: "All" })).toBeVisible();
    await expect(page.locator("button", { hasText: "In Progress" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Queued" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Completed" })).toBeVisible();
  });

  test("tab switching works", async ({ page }) => {
    await page.goto("/practice");
    await page.waitForResponse((r) => r.url().includes("/api/practice"));
    await page.locator("button", { hasText: "In Progress" }).click();
    await page.waitForTimeout(500);
    expect(await page.textContent("body")).toBeTruthy();
  });
});

// ─── API Health ───

test.describe("API Health", () => {
  test("dashboard stats API responds", async ({ request }) => {
    const resp = await request.get("/api/dashboard/stats");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("total");
  });

  test("entries API responds", async ({ request }) => {
    const resp = await request.get("/api/entries?page=1&pageSize=10");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
  });

  test("practice API responds", async ({ request }) => {
    expect((await request.get("/api/practice")).ok()).toBeTruthy();
  });

  test("groups API responds", async ({ request }) => {
    expect((await request.get("/api/groups")).ok()).toBeTruthy();
  });

  test("tags stats API responds", async ({ request }) => {
    expect((await request.get("/api/tags/stats")).ok()).toBeTruthy();
  });
});
