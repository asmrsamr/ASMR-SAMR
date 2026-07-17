# Phase Execution Status

Date: 2026-07-17
Branch: `Codex`

## Phase 1: Security And Access

Status: In progress

Completed:

- GitHub CLI verified against the `asmrsamr` account without using the exposed PAT.
- Admin sessions moved to tab-scoped storage with inactivity and maximum-lifetime controls.
- Staff permission discovery corrected without exposing other role definitions.
- Non-admin staff profile modification blocked.
- Administrator self-lockout and final-administrator removal blocked in PostgreSQL and the user Edge Function.
- Anonymous and privileged-boundary security tests added.
- GitHub Actions quality gate added.

Pending external access:

- Sign in to the Supabase project-owner dashboard.
- Apply `20260717131500_phase1_access_hardening.sql`.
- Redeploy `admin-users`.
- Create the first named administrator and a recovery administrator.
- Run the authenticated role matrix.

## Phase 2: Operational Dashboard QA

Status: In progress; repository implementation complete, live acceptance pending

Completed:

- Role-aware sidebar visibility.
- Direct-route permission error behavior retained.
- Public storefront and protected login regression checks.
- Route-to-page contract coverage for every dashboard navigation item.
- Canonical staff-role coverage across the dashboard and legacy fallback helpers.
- Legacy admin tokens and protected remote caches moved out of persistent storage.
- Safe cancellation actions for orders and planned production records.
- Authenticated role/RLS acceptance harness with optional transient audited CRUD.
- Phase 2 contract gate added to GitHub Actions.

Pending:

- Deploy the Phase 1 live migration and updated `admin-users` function.
- Create two named administrator accounts.
- Run the authenticated read matrix for every operational role.
- Run the transient CRUD and audit cycle with an authorized account.
- Audit-log verification for sensitive changes.
- Correction of defects found during real-account testing.

## Later Phases

Phases 3 through 8 remain gated by the approved checkout path, real business
data, launch content, production configuration, and stakeholder acceptance.
