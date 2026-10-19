const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders both workflow preview cards and declares preview-only mode", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Answer with AI" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Analyze build failure" })).toBeVisible();
  await expect(page.getByText(/Preview mode · Slack deployment pending/)).toBeVisible();
  await expect(page.getByText(/does not send data to an AI service/)).toBeVisible();
});

test("answer preview requires a question and never submits to a live AI service", async ({ page }) => {
  await page.getByRole("button", { name: "Preview workflow input" }).first().click();
  await expect(page.locator("#answer-output")).toContainText("Enter a question first.");

  await page.locator("#question").fill("Explain a failed CI build");
  await page.locator("#context").fill("The test job failed");
  await page.getByRole("button", { name: "Preview workflow input" }).first().click();
  await expect(page.locator("#answer-output")).toContainText("Input ready for Slack workflow");
  await expect(page.locator("#answer-output")).toContainText("Context provided");
});

test("build preview rejects malformed repository or non-numeric run ID", async ({ page }) => {
  await page.locator("#repo").fill("not-a-repository");
  await page.locator("#runid").fill("abc");
  await page.getByRole("button", { name: "Preview workflow input" }).nth(1).click();
  await expect(page.locator("#build-output")).toContainText("Enter a repository in owner/name format");
});

test("build preview accepts owner/repository and numeric run ID", async ({ page }) => {
  await page.locator("#repo").fill("Cyrrenza-v2/Invest-broker");
  await page.locator("#runid").fill("1234567890");
  await page.getByRole("button", { name: "Preview workflow input" }).nth(1).click();
  await expect(page.locator("#build-output")).toContainText("Input format looks valid");
  await expect(page.locator("#build-output")).toContainText("Live analysis will be available after Slack deployment");
});
