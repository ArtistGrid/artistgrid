import { test, expect } from "@playwright/test";
import { mockSite, dismissAnnouncement } from "./helpers";

test("announcement modal shows on first visit and can be dismissed", async ({ page }) => {
  await mockSite(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Got it!" })).toBeVisible();
  await page.getByRole("button", { name: "Got it!" }).click();
  await expect(page.getByRole("button", { name: "Got it!" })).toBeHidden();
});

test("announcement modal does not show after dismissal", async ({ page }) => {
  await mockSite(page);
  await dismissAnnouncement(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Got it!" })).toBeHidden();
});