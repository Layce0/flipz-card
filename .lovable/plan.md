

## Diagnostic

After a thorough analysis of the codebase, I identified **one critical bug** causing navigation to break:

### Bug: `OnboardingTutorial` is lazy-loaded but rendered outside any `<Suspense>` boundary

In `App.tsx`:
- Line 2: `const OnboardingTutorial = lazy(() => ...)`
- Line 53: `<OnboardingTutorial />` is placed **before** the `<Suspense fallback={...}>` on line 55

When the component hasn't finished loading yet (e.g. after a page reload with cache miss), React throws a fatal error because a `lazy` component **must** be inside a `Suspense`. This crashes the entire component tree, which kills routing and navigation.

### Other findings (no issues)
- All routes in `App.tsx` are correctly defined with `BrowserRouter > Routes > Route`
- Navigation uses React Router `<Link>` components (no `<a href>`)
- No `window.location.reload()` remains in the codebase
- All page navigations use `useNavigate()` properly

---

## Plan

### 1. Wrap `OnboardingTutorial` in its own `Suspense` boundary (App.tsx)

Move the `<OnboardingTutorial />` inside a `<Suspense fallback={null}>` wrapper so it loads gracefully without crashing the app:

```tsx
<Suspense fallback={null}>
  <OnboardingTutorial />
</Suspense>
```

This is a single-line fix in `App.tsx` (around line 53). No other files need to change.

### Why this fixes the bug
- Without `Suspense`, a lazy component that hasn't loaded yet throws a promise that React can't catch, crashing the entire tree including the router
- After a reload, the JS chunks may not be cached, triggering this crash consistently
- Wrapping in `Suspense` allows React to show `null` while the tutorial loads, keeping the rest of the app functional

