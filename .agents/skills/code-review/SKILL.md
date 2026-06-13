---
name: code-review
description: Perform comprehensive code reviews. Check for correctness, security, performance, readability, and adherence to project patterns. Provide actionable feedback with specific suggestions.
---

# Code Review

## Overview
Code review catches issues before they cascade. A fresh perspective finds bugs, design problems, and missed requirements that the author can't see.

**Core principle:** Review early, review often. Every major change deserves review.

## When to Review
**Mandatory:**
- After completing major feature
- Before merge to main
- After fixing complex bug

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After any multi-file change

## Review Checklist

### 1. Correctness
- Does the code do what it claims?
- Are edge cases handled?
- Are error paths covered?
- Does it match the requirements/spec?

### 2. Security
- Input validation present?
- No secrets/credentials in code?
- SQL injection / XSS prevention?
- Proper authentication/authorization checks?

### 3. Performance
- No N+1 queries or unnecessary loops?
- Appropriate data structures used?
- No memory leaks (event listeners, subscriptions)?
- Lazy loading where appropriate?

### 4. Readability
- Clear naming (variables, functions, classes)?
- Comments explain WHY, not WHAT?
- Consistent code style with project?
- Functions are focused (single responsibility)?

### 5. Architecture
- Follows existing project patterns?
- No unnecessary coupling?
- Dependencies flow in the right direction?
- Changes are in the right layer?

### 6. Testing
- Tests cover the new/changed behavior?
- Tests are meaningful (not just coverage padding)?
- Edge cases tested?
- Tests are readable and maintainable?

## Feedback Format

**Severity levels:**
- 🔴 **Critical** — Must fix before merge. Bugs, security issues, data loss risks.
- 🟡 **Important** — Should fix. Design problems, missing error handling, performance issues.
- 🟢 **Minor** — Nice to have. Style, naming, minor improvements.
- 💡 **Suggestion** — Optional improvement. Alternative approaches, future considerations.

**Good feedback:**
```
🟡 Important: `processItems()` doesn't handle empty arrays.
Line 42: Add guard clause: `if (!items.length) return [];`
This will crash in production when no items are selected.
```

**Bad feedback:**
```
"This code could be better" (vague, no action)
"I would do it differently" (opinion, no reasoning)
```

## Red Flags
**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Rubber-stamp without reading
- Focus only on style nitpicks

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification
