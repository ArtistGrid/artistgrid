import { test, expect } from "@playwright/test";
import { TRACKER_ID, mockSite, dismissAnnouncement } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockSite(page);
  await dismissAnnouncement(page);
});

test("clicking an artist card navigates to its tracker", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kanye West" })).toBeVisible();
  await page.getByRole("heading", { name: "Kanye West" }).click();
  await expect(page).toHaveURL(new RegExp(`/sh/${TRACKER_ID}`));
  await expect(page.getByText("Donda")).toBeVisible();
});

test("home search filters and can be cleared", async ({ page }) => {
  await page.goto("/");
  const search = page.getByLabel("Search artists");
  await search.fill("drake");
  await expect(page.getByRole("heading", { name: "Drake" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanye West" })).not.toBeVisible();

  await search.fill("");
  await expect(page.getByRole("heading", { name: "Kanye West" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Drake" })).toBeVisible();
});
