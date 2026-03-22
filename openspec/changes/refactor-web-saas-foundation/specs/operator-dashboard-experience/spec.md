## ADDED Requirements

### Requirement: Consistent operator login and workspace shell
The frontend SHALL provide a cohesive operator entry flow and post-login workspace shell that supports responsive navigation, account actions, and clear route context.

#### Scenario: Operator signs in successfully
- **WHEN** an operator completes a valid login flow
- **THEN** the system navigates the operator into the protected workspace shell and displays navigation and account controls appropriate to the session

#### Scenario: Operator opens the app on mobile
- **WHEN** a protected workspace page is viewed on a small screen
- **THEN** the navigation shell remains usable through a responsive navigation pattern without hiding the current route context

### Requirement: Standardized resource page states
The frontend SHALL render protected resource pages through shared patterns for loading, empty, error, and forbidden states so page behavior is predictable across modules.

#### Scenario: Resource page is loading
- **WHEN** a protected resource page is waiting on required data
- **THEN** it displays the shared loading state pattern instead of raw blank content

#### Scenario: Resource page request fails
- **WHEN** a protected resource page encounters an error or authorization failure
- **THEN** it renders the shared error or forbidden state pattern with a clear recovery path when available

### Requirement: Reusable CRUD workspace patterns
The frontend SHALL expose reusable dashboard primitives for page headers, filters, tabular/list content, detail surfaces, and mutation feedback across operator-facing modules.

#### Scenario: Feature module implements a list-and-edit workflow
- **WHEN** a protected resource page supports searching, filtering, editing, or status changes
- **THEN** it composes the shared workspace primitives rather than introducing a one-off page-specific interaction model

#### Scenario: Operator performs a mutation
- **WHEN** an operator creates, updates, or changes the status of a resource
- **THEN** the UI provides standardized pending, success, and failure feedback consistent with other workspace pages
