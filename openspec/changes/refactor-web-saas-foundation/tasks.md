## 1. Frontend Architecture Foundation

- [x] 1.1 Audit the current `apps/web` route tree, shared components, and service layer, then define the canonical target structure for route groups, features, shared UI, and data access.
- [x] 1.2 Introduce protected, auth, and optional public route-group layouts with shared providers and a reusable workspace shell boundary.
- [x] 1.3 Consolidate global styling, metadata, and provider setup so layout ownership is explicit and duplicated bootstrap logic is removed.

## 2. Auth and Session Boundary

- [x] 2.1 Replace client-only credential validation and cookie writes with a server-safe operator session flow that can be consumed by login, middleware, and server components.
- [x] 2.2 Refactor middleware and route protection to use the new session boundary while preserving login redirect and post-login return behavior.
- [x] 2.3 Add lightweight local-development defaults for the operator login flow without introducing a full external identity provider.

## 3. Agent-Friendly Module Refactor

- [x] 3.1 Create canonical feature modules for the highest-value dashboard domains and move route-specific business logic out of page files.
- [x] 3.2 Introduce a typed gateway layer that normalizes API responses before they reach feature UI components.
- [x] 3.3 Remove or isolate legacy mock/demo-only code paths so coding agents have one authoritative implementation path per concern.

## 4. Workspace Experience Standardization

- [x] 4.1 Refactor the operator shell to provide responsive navigation, route context, and account actions through shared workspace primitives.
- [x] 4.2 Standardize loading, empty, error, forbidden, and mutation-feedback states across representative dashboard resource pages.
- [x] 4.3 Migrate representative CRUD screens to the shared list/filter/detail patterns and document the convention for future feature pages.

## 5. Verification and Handoff

- [x] 5.1 Add or update frontend checks that validate the new route boundaries, typed gateway contracts, and protected navigation behavior.
- [x] 5.2 Verify the refactored app builds cleanly on Next.js 16 with Tailwind CSS v4 and shadcn/ui conventions intact.
- [x] 5.3 Update project guidance for coding-agent contributors so future changes follow the new frontend structure and extension points.
