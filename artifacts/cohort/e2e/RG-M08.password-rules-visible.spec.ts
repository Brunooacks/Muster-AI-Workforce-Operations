/**
 * RG-M08: Password rules must be visible BEFORE form submission on /sign-up
 * 
 * This regression test ensures that:
 * 1. Password requirements are shown before the user attempts to submit
 * 2. The rules appear above the sign-up form (not below)
 * 3. The rules are visible in all three supported languages (pt, en, es)
 * 
 * Previously, password rules only appeared after submission as an error,
 * causing user frustration. This test ensures the fix remains in place.
 */

import { expect, test } from "@playwright/test";

test.describe("RG-M08: Password rules visibility on sign-up", () => {
  test("password rule is visible before form interaction in Portuguese", async ({ page }) => {
    await page.goto("/sign-up");
    
    // Wait for page to load
    await expect(page.locator("[data-testid='auth-sign-up']")).toBeVisible();
    
    // The password rule should be visible immediately
    const passwordRule = page.locator("[data-testid='password-rule']");
    await expect(passwordRule).toBeVisible();
    await expect(passwordRule).toContainText("Senha");
    await expect(passwordRule).toContainText("15 caracteres");
    
    // Verify the rule appears BEFORE the form card
    const ruleBox = await passwordRule.boundingBox();
    const formCard = page.locator("input[name='emailAddress']").first();
    const formBox = await formCard.boundingBox();
    
    expect(ruleBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    
    // The rule's Y position should be less than the form's Y position (appears above)
    expect(ruleBox!.y).toBeLessThan(formBox!.y);
  });

  test("password rule is visible in English", async ({ page }) => {
    await page.goto("/en/sign-up");
    
    await expect(page.locator("[data-testid='auth-sign-up']")).toBeVisible();
    
    const passwordRule = page.locator("[data-testid='password-rule']");
    await expect(passwordRule).toBeVisible();
    await expect(passwordRule).toContainText("Password");
    await expect(passwordRule).toContainText("15 characters");
  });

  test("password rule is visible in Spanish", async ({ page }) => {
    await page.goto("/es/sign-up");
    
    await expect(page.locator("[data-testid='auth-sign-up']")).toBeVisible();
    
    const passwordRule = page.locator("[data-testid='password-rule']");
    await expect(passwordRule).toBeVisible();
    await expect(passwordRule).toContainText("Contraseña");
    await expect(passwordRule).toContainText("15 caracteres");
  });

  test("password rule is NOT shown on sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    
    await expect(page.locator("[data-testid='auth-sign-in']")).toBeVisible();
    
    // Password rule should not be present on sign-in
    const passwordRule = page.locator("[data-testid='password-rule']");
    await expect(passwordRule).not.toBeVisible();
  });

  test("password rule remains visible on mobile viewport", async ({ page }) => {
    // Set mobile viewport (matching Pixel 7 from playwright.config.ts)
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/sign-up");
    
    await expect(page.locator("[data-testid='auth-sign-up']")).toBeVisible();
    
    const passwordRule = page.locator("[data-testid='password-rule']");
    await expect(passwordRule).toBeVisible();
    await expect(passwordRule).toContainText("15 caracteres");
    
    // Verify it's still above the form on mobile
    const ruleBox = await passwordRule.boundingBox();
    const formCard = page.locator("input[name='emailAddress']").first();
    const formBox = await formCard.boundingBox();
    
    expect(ruleBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    expect(ruleBox!.y).toBeLessThan(formBox!.y);
  });
});
