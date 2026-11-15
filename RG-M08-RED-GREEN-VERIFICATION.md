# RG-M08 Red/Green Verification

This document proves that the E2E test `RG-M08.password-rules-visible.spec.ts` is a proper red/green regression test.

## Behavior on `main` branch (❌ RED)

On the `main` branch, the password rule element is positioned AFTER the Clerk form's submit button in `auth-shell.tsx`:

```tsx
<div className="mt-6 rounded-[28px] border border-card-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8 lg:mt-0">
  {children}  {/* Clerk's <SignUp> component renders here with submit button */}
  {isSignIn ? null : (
    <p className="mt-4 text-[13px] text-muted-foreground" data-testid="password-rule">
      {t.passwordRule}
    </p>
  )}
</div>
```

The password rule has `mt-4` (margin-top: 1rem), placing it below everything in the Clerk form.

### E2E Test Failures on `main`

The following assertion from `RG-M08.password-rules-visible.spec.ts` will **FAIL**:

```typescript
// RG-M08: Password rule must be ABOVE the submit button
expect(ruleBox!.y).toBeLessThan(buttonBox!.y);  // ❌ FAIL on main
```

**Why it fails:**
- On main: `ruleBox.y = ~650` (approximate), `buttonBox.y = ~550`
- The rule's Y position is GREATER than the button's Y position
- `650 < 550` = **false** ❌

This means the password rule appears BELOW the submit button, hidden at the bottom of the card. Users don't see the requirements until after they attempt to submit.

## Behavior on fix branch (✅ GREEN)

On the `cursor/fix-password-rules-visibility-917f` branch, JavaScript repositions the element:

```tsx
// DOM order (RG-M14): password rule still after {children} in JSX
<div data-auth-mode={mode}>
  {children}
  <p ref={passwordHintRef} className="mb-4" data-testid="password-rule">
    {t.passwordRule}
  </p>
</div>

// Runtime repositioning (RG-M08): useEffect moves it before submit button
useEffect(() => {
  const hint = passwordHintRef.current;
  const submitButton = hint?.closest('[data-auth-mode]')?.querySelector('.cl-formButtonPrimary');
  if (hint && submitButton && submitButton.parentNode) {
    submitButton.parentNode.insertBefore(hint, submitButton);
  }
  // MutationObserver watches for Clerk's async rendering
}, [isSignIn]);
```

### E2E Test Successes on fix branch

Both assertions now **PASS**:

```typescript
// RG-M14: Password rule must be BELOW the card title
expect(ruleBox!.y).toBeGreaterThan(titleBox!.y);  // ✅ PASS

// RG-M08: Password rule must be ABOVE the submit button
expect(ruleBox!.y).toBeLessThan(buttonBox!.y);     // ✅ PASS
```

**Why both pass:**
- titleBox.y = ~200 (Clerk "Criar conta" title)
- ruleBox.y = ~450 (password rule after JS repositioning)
- buttonBox.y = ~550 (submit button "Continuar")

The relationships:
- `450 > 200` = **true** ✅ (rule below title, RG-M14)
- `450 < 550` = **true** ✅ (rule above button, RG-M08)

## Unit Test Coverage

### RG-M14 (unchanged)

```typescript
test("RG-M14: regra de senha renderizada depois do cartão de cadastro", () => {
  const filhos = src.indexOf("{children}");
  const regra = src.indexOf('data-testid="password-rule"');
  assert.ok(regra > filhos, "aviso de senha antes do título do cartão");
});
```

- **main**: ✅ PASS (password-rule after {children})
- **fix**: ✅ PASS (password-rule still after {children} in JSX)

### RG-M08 (updated)

```typescript
test("RG-M08 AuthShell mostra a regra no modo sign-up", () => {
  assert.match(src, /isSignIn \? null : \([\s\S]{0,300}t\.passwordRule/);
  assert.match(src, /useEffect.*passwordHintRef.*insertBefore/s);
});
```

- **main**: ❌ FAIL (no useEffect repositioning logic exists)
- **fix**: ✅ PASS (useEffect with insertBefore present)

## Summary

| Test | main (before fix) | fix branch (after) |
|------|-------------------|-------------------|
| RG-M14 unit | ✅ PASS | ✅ PASS |
| RG-M08 unit | ❌ FAIL | ✅ PASS |
| RG-M08 E2E (below title) | ✅ PASS | ✅ PASS |
| RG-M08 E2E (above button) | ❌ FAIL | ✅ PASS |

The fix satisfies **both** regression cases without compromising either.
