/**
 * RG-M08 + RG-M14: Password rules visibility and positioning on /sign-up
 * 
 * This regression test ensures BOTH:
 * - RG-M08: Password requirements are shown BEFORE user submits (above submit button)
 * - RG-M14: Password rule appears BELOW the Clerk card title (not above it)
 * 
 * The fix uses JavaScript to reposition the password hint after Clerk renders,
 * so it appears between the password field and submit button.
 * 
 * DOM order (RG-M14): password-rule after {children} in source
 * Visual order (RG-M08): password-rule before submit button at runtime
 */

import { expect, test } from "@playwright/test";

test.describe("RG-M08 + RG-M14: Password rules visibility and positioning", () => {
  test("password rule is visible and positioned correctly in Portuguese", async ({ page }) => {
    await page.goto("/sign-up");
    
    // Wait for page and Clerk to fully render
    await expect(page.locator("[data-testid='auth-sign-up']")).toBeVisible();
    await page.waitForSelector("button:has-text('Continuar')", { timeout: 5000 });
    
    // The password rule should be visible immediately
    const passwordRule = page.locator("[data-testid='password-rule']");
    await expect(passwordRule).toBeVisible();
    await expect(passwordRule).toContainText("Senha");
    await expect(passwordRule).toContainText("15 caracteres");
    
    // Verify positioning: rule must be BELOW card title but ABOVE submit button
    const ruleBox = await passwordRule.boundingBox();
    const cardTitle = page.locator("h1:has-text('Criar conta')").or(page.locator(".cl-headerTitle"));
    const titleBox = await cardTitle.first().boundingBox();
    const submitButton = page.locator("button:has-text('Continuar')").first();
    const buttonBox = await submitButton.boundingBox();
    
    expect(ruleBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    
    // RG-M14: Password rule must be BELOW the card title
    expect(ruleBox!.y).toBeGreaterThan(titleBox!.y);
    
    // RG-M08: Password rule must be ABOVE the submit button
    expect(ruleBox!.y).toBeLessThan(buttonBox!.y);
  });

  test("password rule is visible and positioned correctly in English", async ({ page }) => {
    await page.goto("/en/sign-up");
    
    await expect(page.locator("[data-testid='auth-sign-up']")).toBeVisible();
    await page.waitForSelector("button:has-text('Continue')", { timeout: 5000 });
    
    const passwordRule = page.locator("[data-testid='password-rule']");
    await expect(passwordRule).toBeVisible();
    await expect(passwordRule).toContainText("Password");
    await expect(passwordRule).toContainText("15 characters");
    
    // Verify positioning
    const ruleBox = await passwordRule.boundingBox();
    const submitButton = page.locator("button:has-text('Continue')").first();
    const buttonBox = await submitButton.boundingBox();
    expect(ruleBox!.y).toBeLessThan(buttonBox!.y);
  });

  test("password rule is visible and positioned correctly in Spanish", async ({ page }) => {
    await page.goto("/es/sign-up");
    
    await expect(page.locator("[data-testid='auth-sign-up']")).toBeVisible();
    await page.waitForSelector("button:has-text('Continuar')", { timeout: 5000 });
    
    const passwordRule = page.locator("[data-testid='password-rule']");
    await expect(passwordRule).toBeVisible();
    await expect(passwordRule).toContainText("Contraseña");
    await expect(passwordRule).toContainText("15 caracteres");
    
    // Verify positioning
    const ruleBox = await passwordRule.boundingBox();
    const submitButton = page.locator("button:has-text('Continuar')").first();
    const buttonBox = await submitButton.boundingBox();
    expect(ruleBox!.y).toBeLessThan(buttonBox!.y);
  });

  test("password rule is NOT shown on sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    
    await expect(page.locator("[data-testid='auth-sign-in']")).toBeVisible();
    
    // Password rule should not be present on sign-in
    const passwordRule = page.locator("[data-testid='password-rule']");
    await expect(passwordRule).not.toBeVisible();
  });

  test("password rule remains visible and positioned correctly on mobile (390px width)", async ({ page }) => {
    // Set to 390px width - the specific viewport mentioned in RG-M14
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/sign-up");
    
    await expect(page.locator("[data-testid='auth-sign-up']")).toBeVisible();
    await page.waitForSelector("button:has-text('Continuar')", { timeout: 5000 });
    
    const passwordRule = page.locator("[data-testid='password-rule']");
    await expect(passwordRule).toBeVisible();
    await expect(passwordRule).toContainText("15 caracteres");
    
    // Verify positioning at 390px (RG-M14 specific case)
    const ruleBox = await passwordRule.boundingBox();
    const cardTitle = page.locator("h1:has-text('Criar conta')").or(page.locator(".cl-headerTitle"));
    const titleBox = await cardTitle.first().boundingBox();
    const submitButton = page.locator("button:has-text('Continuar')").first();
    const buttonBox = await submitButton.boundingBox();
    
    expect(ruleBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    
    // RG-M14: Password rule must be BELOW the card title (not above it)
    expect(ruleBox!.y).toBeGreaterThan(titleBox!.y);
    
    // RG-M08: Password rule must be ABOVE the submit button
    expect(ruleBox!.y).toBeLessThan(buttonBox!.y);
  });
});
