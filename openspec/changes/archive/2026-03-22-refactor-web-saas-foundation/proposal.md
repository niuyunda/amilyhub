## Why

`apps/web` already contains a broad operator dashboard, but the frontend is still organized as a collection of route files with mixed concerns, hardcoded authentication, and service logic that is difficult for coding agents to extend safely. A structural refactor is needed now so future work can build on a predictable Next.js 16 SaaS foundation instead of compounding page-level coupling.

## What Changes

- Refactor `apps/web` into a clearer SaaS-style application structure with explicit route groups, shared providers, and protected operator workspace shells.
- Standardize frontend module boundaries for features, shared UI, server/data access, and typed contracts so coding agents have one obvious place to change behavior.
- Replace ad hoc page patterns with reusable dashboard primitives for navigation, list/detail flows, form states, and empty/loading/error handling.
- Move authentication and route protection toward a server-first boundary suitable for an internal operator workspace, while preserving the current low-friction admin access model.
- Define frontend guardrails for a coding-agent-only project, including deterministic conventions, reduced duplication, and implementation paths that are easy to reason about.

## Capabilities

### New Capabilities
- `saas-web-foundation`: A Next.js 16 application shell with explicit public, auth, and protected workspace boundaries, shared providers, and route protection rules.
- `agent-friendly-frontend-modules`: A deterministic frontend module structure for features, shared UI, typed data access, and coding-agent-safe extension points.
- `operator-dashboard-experience`: A consistent operator-facing workspace experience for login, navigation, dashboard pages, CRUD flows, and state handling across desktop and mobile.

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/web/app`, `apps/web/components`, `apps/web/lib`, `apps/web/src`, `apps/web/middleware.ts`, and related frontend configuration.
- Dependencies/systems: Next.js 16 App Router patterns, Tailwind CSS v4 tokens, shadcn/ui component usage, and the current API integration layer in `apps/web/src/services`.
- Delivery impact: the refactor is primarily frontend-facing but may require light contract normalization between the UI and existing API responses to preserve typed, agent-safe data flows.
