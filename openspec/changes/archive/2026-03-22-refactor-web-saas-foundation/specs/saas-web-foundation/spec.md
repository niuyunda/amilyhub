## ADDED Requirements

### Requirement: Protected workspace route boundaries
The frontend SHALL organize the application into explicit public, auth, and protected workspace boundaries so layout responsibilities, providers, and access control are attached to the correct route group.

#### Scenario: Unauthenticated user requests a protected workspace page
- **WHEN** a request targets a protected workspace route without a valid operator session
- **THEN** the system redirects the request to the login entry point and preserves the original destination for post-login return

#### Scenario: Authenticated user requests the login page
- **WHEN** an operator with a valid session requests the login route
- **THEN** the system redirects the operator to the default protected landing page

### Requirement: Shared application providers and metadata
The frontend SHALL define shared providers, document metadata, and global styling at the layout boundary so all routes inherit a consistent runtime environment without duplicating setup code.

#### Scenario: Protected workspace route renders
- **WHEN** any protected workspace page is rendered
- **THEN** the page is wrapped by the shared app providers, theme configuration, and workspace shell defined for the protected route group

#### Scenario: Auth route renders
- **WHEN** the login route is rendered
- **THEN** the page uses the auth-specific layout without importing protected workspace navigation or dashboard chrome

### Requirement: Server-safe operator session checks
The frontend SHALL evaluate operator session validity through server-safe code paths that can be used by middleware, server components, and login flows.

#### Scenario: Middleware validates an incoming request
- **WHEN** middleware or a server component checks the current operator session
- **THEN** it reads a server-safe session representation rather than relying on browser-only credential validation logic

#### Scenario: Login creates a session
- **WHEN** a login attempt succeeds
- **THEN** the session is created through a server-managed flow that can be trusted by subsequent protected route checks
