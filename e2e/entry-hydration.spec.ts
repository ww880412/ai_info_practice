import { expect, test } from "@playwright/test";

test("entry page does not emit hydration mismatch errors", async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("http://localhost:3002/entry/cmmganfcj0000148we1hzt6oa");
  await page.waitForLoadState("networkidle");

  expect(
    consoleErrors.filter((message) => message.includes("Hydration failed"))
  ).toEqual([]);
});
