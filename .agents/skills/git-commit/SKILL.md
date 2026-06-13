---
name: git-commit
description: Create clean, atomic Git commits with well-formatted messages. Detect project conventions and follow them. Keep commits focused and the history readable.
---

# Git Commit

## Overview
Clean Git history is a communication tool. Each commit should tell a story about what changed and why. Atomic commits make debugging, reverting, and reviewing dramatically easier.

## Commit Message Format

### Conventional Commits (default)
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
| Type | Use When |
|------|----------|
| `feat` | Adding new functionality |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes nor adds |
| `style` | Formatting, whitespace, semicolons |
| `docs` | Documentation only |
| `test` | Adding or fixing tests |
| `chore` | Build, tooling, dependencies |
| `perf` | Performance improvement |

**Examples:**
```bash
git commit -m "feat(tags): add preset export/import"
git commit -m "fix(mac): resolve D&D polyfill ghost position"
git commit -m "refactor(App): remove Mac tab fallback UI"
git commit -m "chore: update dockview to v5.1.0"
```

### Detect Project Conventions
Before committing, check existing commit history:
```bash
git log --oneline -20
```
- If project uses Conventional Commits → follow that
- If project uses a different style → match it
- If no convention → use Conventional Commits as default

## Atomic Commits

### Rules
1. **One logical change per commit** — Don't mix bug fix with refactoring
2. **Each commit should build** — No broken intermediate states
3. **Each commit should be revertable** — Reverting one commit shouldn't break others

### How to Split
```bash
# Stage specific files
git add src/utils/macDragPolyfill.js
git commit -m "feat(mac): add HTML5 D&D polyfill"

# Stage related changes
git add src/main.jsx
git commit -m "feat(mac): integrate D&D polyfill in entry point"

# Stage UI changes
git add src/App.jsx src/styles/index.css
git commit -m "refactor(App): remove Mac tab fallback, use Dockview everywhere"
```

### Interactive Staging
```bash
# Stage parts of a file
git add -p

# Review what's staged
git diff --staged
```

## Message Guidelines

**Subject line:**
- 50 characters or less
- Imperative mood ("add" not "added" or "adds")
- No period at end
- Lowercase after type prefix

**Body (when needed):**
- Wrap at 72 characters
- Explain WHAT and WHY, not HOW
- Use when change is non-obvious

**When to use body:**
- Breaking changes
- Non-obvious bug fixes
- Architecture decisions
- Workarounds with context

## Pre-Commit Checklist
Before each commit:
- [ ] Changes are related (single logical change)
- [ ] Code builds/compiles
- [ ] No debug code left (console.log, debugger, TODO)
- [ ] No unrelated formatting changes mixed in
- [ ] Commit message is clear and follows convention
