# Web Frontend Conventions

## Ownership

- `app/`: route entry points and layout boundaries only.
- `src/features/<feature>/`: feature-specific UI composition and page logic.
- `src/data/<domain>/`: typed gateways that isolate transport and response normalization.
- `components/ui/`: shared low-level shadcn/ui primitives.
- `components/common/`: reusable workspace building blocks shared across features.
- `src/features/auth/`: operator auth, session, and route-protection logic.

## Current layout contract

- `app/(public)`: unauthenticated entry routes.
- `app/(auth)`: login and other auth-only routes.
- `app/(dashboard)`: protected operator workspace routes with shared shell and server-side session checks.

## Agent rules

- Do not add business logic directly inside route files when a feature module exists.
- Prefer adding new API integration code under `src/data/` before wiring it into a feature.
- Reuse the shared state components for loading, empty, error, and forbidden states.
- Keep auth changes inside `src/features/auth/` and avoid client-managed cookies.
- Treat `src/services/core-service.ts` and `src/mocks/` as legacy compatibility layers while migrating features to the canonical structure.
