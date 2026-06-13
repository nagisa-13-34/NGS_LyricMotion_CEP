---
name: performance-optimization
description: Systematically identify and fix performance bottlenecks. Measure before optimizing. Profile, don't guess. Target the biggest wins first.
---

# Performance Optimization

## Overview
Performance optimization is about **measuring, not guessing**. Premature optimization wastes time. Targeted optimization based on profiling data delivers real results.

**Core principle:** Profile first, optimize second. Never optimize without measurement.

## The Process

### 1. Measure Baseline
Before changing anything, establish measurable metrics:
- **Load time** — How long until interactive?
- **Runtime** — How fast do operations complete?
- **Memory** — How much memory is consumed?
- **Bundle size** — How large are the assets?

```bash
# Example: Measure bundle size
npx vite build -- --report

# Example: Profile Node.js
node --prof app.js
node --prof-process isolate-*.log > profile.txt
```

### 2. Identify Bottlenecks
Use profiling tools to find WHERE time is spent:

**JavaScript/Web:**
- Chrome DevTools Performance tab
- `console.time()` / `console.timeEnd()`
- Lighthouse for web apps
- Bundle analyzer for size

**Python:**
- `cProfile` / `profile`
- `py-spy` for live profiling
- `memory_profiler` for memory

**C++:**
- Compiler profiler (`-pg` flag)
- Valgrind / Cachegrind
- Platform-specific (Instruments on Mac, VTune on Windows)

### 3. Target the Biggest Win
Focus on the **one thing** that will make the most difference:
- The function taking 80% of runtime
- The largest bundle chunk
- The most frequent allocation

**Don't:**
- Optimize everything at once
- Micro-optimize rarely-called code
- Sacrifice readability for marginal gains

### 4. Optimize and Re-Measure
Make ONE change, then measure again:
- Did it actually improve?
- By how much?
- Any regressions?

## Common Patterns

### Rendering / UI
| Problem | Solution |
|---------|----------|
| Unnecessary re-renders | `React.memo`, `useMemo`, `useCallback` |
| Large lists | Virtual scrolling (react-window) |
| Layout thrashing | Batch DOM reads/writes |
| Heavy computation in render | Move to Web Worker or `requestIdleCallback` |
| Expensive CSS | Reduce selector complexity, use `will-change` |

### JavaScript / Bundle
| Problem | Solution |
|---------|----------|
| Large bundle | Code splitting, lazy loading, tree shaking |
| Slow loops | Use appropriate data structures (Map/Set) |
| Blocking main thread | Web Workers, async processing |
| Memory leaks | Clean up event listeners, clear intervals |
| Repeated calculations | Memoization, caching |

### Network / Data
| Problem | Solution |
|---------|----------|
| Too many requests | Batch, debounce, cache |
| Large payloads | Pagination, compression, partial loading |
| Slow queries | Add indices, optimize joins, use explain |
| Redundant fetches | Cache layer, stale-while-revalidate |

### ExtendScript / CEP Specific
| Problem | Solution |
|---------|----------|
| Slow layer iteration | Minimize `app.project.item()` calls, cache references |
| CSInterface overhead | Batch evalScript calls, avoid frequent round-trips |
| UI update lag | `requestAnimationFrame`, debounce state updates |
| Large JSON parsing | Stream processing, pagination |

## Red Flags
- Optimizing without profiling data
- "This FEELS slow" (measure it!)
- Optimizing code that runs once at startup
- Making code unreadable for 2% improvement
- Premature optimization of code that might change

## Quick Reference
| Step | Action | Tool |
|------|--------|------|
| 1. Measure | Get baseline numbers | Profiler, DevTools |
| 2. Identify | Find the bottleneck | Profiler analysis |
| 3. Target | Pick the biggest win | Pareto principle (80/20) |
| 4. Optimize | Make ONE change | Targeted fix |
| 5. Verify | Measure again | Same tools as step 1 |
| 6. Repeat | Next bottleneck | Back to step 2 |
