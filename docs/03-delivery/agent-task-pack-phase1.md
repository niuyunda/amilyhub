# Agent Task Pack - Phase 1 (API Discovery)

## Task A1 - Deep API harvesting
- Expand from menu-level capture to full interaction-level coverage.
- For each functional page, execute:
  - list open
  - keyword search
  - filter toggle
  - page change
  - open details drawer
  - open create/edit dialog (do not submit)
- Capture newly appearing endpoints and request methods.

## Task A2 - Endpoint normalization
- Build normalized table:
  - module
  - page route
  - method
  - path
  - sample request keys
  - sample response keys
  - notes

## Task A3 - Data export design
- Design non-destructive exporter scripts from captured read APIs.
- Include retry, pagination, and resume-by-checkpoint.
