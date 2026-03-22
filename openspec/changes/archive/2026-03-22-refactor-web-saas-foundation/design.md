## Context

`apps/web` is already running on Next.js 16, Tailwind CSS v4, and shadcn/ui, but the current implementation mixes page composition, client state, authentication, and API calls directly inside route files. The app also carries two competing structures at once: route files under `app/` with many business screens, and a partial `src/` layer for navigation, types, mocks, and services. That makes it hard for coding agents to determine where a new behavior belongs, which files are canonical, and how to safely refactor shared concerns.

The target state is an operator SaaS workspace, not a marketing-heavy public product. The project is intended for coding-agent-driven implementation, so the design must favor deterministic file conventions, single-responsibility modules, and patterns that minimize ambiguity during future automated edits.

## Goals / Non-Goals

**Goals:**

- Establish a clear App Router layout with public, auth, and protected workspace boundaries.
- Define one canonical module structure for features, shared UI, data access, schemas, and utilities.
- Introduce a reusable operator shell pattern that can host existing dashboard pages without route-by-route reinvention.
- Move authentication and access checks to a server-first flow appropriate for an internal SaaS operator app.
- Keep the current tech stack and existing business surface area while making future agent-driven work safer and faster.

**Non-Goals:**

- Rebuilding the backend API or introducing a third-party identity provider.
- Redesigning every business workflow or changing domain rules for students, teachers, schedules, and finance.
- Delivering full product copy, marketing pages, or a public website beyond what the operator entry flow needs.
- Solving all data modeling inconsistencies in one pass if they can be isolated behind a typed gateway.

## Decisions

### 1. Use explicit route groups for public, auth, and app shells

The frontend will be organized around route groups such as `(public)`, `(auth)`, and `(app)` so the shell and provider logic are attached to the correct boundary instead of repeated across pages.

Rationale:
- This aligns with App Router best practice and makes layout ownership obvious.
- It isolates protected workspace concerns from the login flow.
- It gives coding agents a stable rule: shell work belongs in layout files at the route-group boundary.

Alternatives considered:
- Keep the current mixed route structure and refactor page internals only. Rejected because it leaves navigation, auth, and provider composition ambiguous.
- Build a single global layout for everything. Rejected because login and protected workspace have materially different UX and runtime requirements.

### 2. Adopt a feature-first module structure with strict shared boundaries

Business logic will move toward `src/features/<feature>` for domain-specific UI and orchestration, `src/components` for reusable shared primitives, `src/lib` for cross-cutting helpers, and a dedicated typed data layer for API adapters and server-safe access.

Rationale:
- Existing pages already suggest domain slices such as students, teachers, schedules, and finance.
- A feature-first layout gives coding agents one canonical place to add or modify behavior.
- It reduces the current spread of logic between route files, `components/`, and `src/services/`.

Alternatives considered:
- Keep all logic in route folders. Rejected because large route files do not scale and make shared behavior hard to discover.
- Move everything into a generic `src/modules` tree. Rejected because it adds a new abstraction name without improving clarity over `features`.

### 3. Standardize on a typed gateway between UI modules and backend responses

The UI will consume normalized typed functions rather than calling ad hoc fetch helpers directly from page components. The gateway may include server-side helpers and client-safe query functions, but route components must not own response normalization.

Rationale:
- Current pages depend on direct service calls and response mapping that are easy to duplicate.
- Centralized normalization creates one place to absorb backend inconsistencies.
- It allows agent edits to change API behavior without touching unrelated UI composition.

Alternatives considered:
- Continue calling `src/services/core-service.ts` directly from pages. Rejected because mapping logic and transport concerns leak into UI code.
- Introduce a heavy client cache layer immediately. Rejected because the first priority is structural clarity, not framework proliferation.

### 4. Move authentication to a server-first operator session boundary

Authentication will remain intentionally lightweight, but login submission, session creation, and workspace protection should be driven from server-safe code paths instead of client-only credential checks and cookie writes.

Rationale:
- The current flow validates credentials in the browser and writes raw session data to cookies.
- A server-first boundary is a minimum standard for an internal operator app, even if credentials remain seeded or environment-backed at first.
- This supports middleware and server component checks without duplicating auth assumptions.

Alternatives considered:
- Keep purely client-side login. Rejected because it is not acceptable as a long-term SaaS baseline.
- Introduce a full auth provider now. Rejected because it adds scope the user did not request.

### 5. Treat dashboard UX as a reusable workspace system, not isolated pages

The app will define shared patterns for resource pages: page header, filter toolbar, responsive table/list views, form/dialog surfaces, and loading/empty/error states. Existing screens will be refactored into these patterns instead of maintaining bespoke page structures.

Rationale:
- The codebase already contains reusable primitives, but usage is inconsistent.
- A baseline workspace system reduces design drift and implementation variance.
- Coding agents benefit from repeatable CRUD page patterns and smaller units of change.

Alternatives considered:
- Leave each dashboard page autonomous. Rejected because it preserves inconsistency and duplicated logic.

## Risks / Trade-offs

- [Large surface-area refactor] -> Mitigate by preserving route URLs and migrating one shell/module boundary at a time behind stable feature contracts.
- [Auth refactor may affect local development flow] -> Mitigate by keeping a simple seeded operator login path and documenting environment defaults clearly.
- [Typed gateway can expose backend contract gaps] -> Mitigate by adding normalization helpers and fixture-backed tests before migrating every screen.
- [Feature-first structure adds upfront moving cost] -> Mitigate by defining a minimal directory contract and migrating only actively used domains first.
- [Existing pages are mostly client components] -> Mitigate by converting only the boundary concerns to server-first patterns while keeping interactive leaf components client-side.

## Migration Plan

1. Introduce the new route-group layouts, shared providers, and workspace shell without changing operator URLs.
2. Establish the canonical feature/module directories and move shared primitives into stable locations.
3. Add the typed gateway and migrate one or two representative domains first to validate the pattern.
4. Replace client-only auth handling with server-backed login/session helpers and middleware-compatible checks.
5. Migrate remaining dashboard pages onto the reusable workspace patterns and remove superseded code paths.

Rollback strategy:
- Keep URL structure stable and migrate in slices so the app can fall back to the prior page implementations if a domain migration proves unstable.
- Avoid deleting old helpers until the new shell, auth, and gateway paths are validated.

## Open Questions

- Should the initial protected landing route remain `/dashboard`, or should the refactor introduce a new `/workspace` entry and redirect legacy routes?
- How much of the current dashboard surface is actively used versus generated as demo scaffolding that can be retired during refactor?
- Does the team want server actions as the default mutation path, or should route handlers remain the primary integration boundary for now?
