# Phase 2 Operational Acceptance

Date: 2026-07-17

## Automated Gates

Run the repository-safe checks before every dashboard release:

```powershell
node --check website/app.js
node --check website/admin-dashboard.js
python website/test_website.py
python website/test_security.py
python website/test_admin_contracts.py
```

The contract gate verifies every sidebar route, CRUD controls, role mapping,
session storage, protected-record cancellation, audit coverage, and the fixed,
independently scrolling sidebar.

## Authenticated Acceptance

Use a dedicated named staff account. Supply credentials through temporary
environment variables only; never add them to a file, GitHub variable, browser
storage, or source code. Read the password interactively so its value is not
written into PowerShell history.

```powershell
$env:ASMR_QA_EMAIL = '<staff email>'
$securePassword = Read-Host 'QA password' -AsSecureString
$env:ASMR_QA_PASSWORD = [Net.NetworkCredential]::new('', $securePassword).Password
$env:ASMR_QA_EXPECTED_ROLE = 'admin'
python website/test_admin_authenticated.py
```

The default run is read-only. It signs in, verifies the active profile, reads
the account's own role permissions, probes each authorized module through RLS,
and signs out.

For an administrator or marketing writer, enable one transient campaign CRUD
cycle. The test creates, updates, deletes, and verifies audit records for a
uniquely named QA campaign before signing out:

```powershell
$env:ASMR_QA_ALLOW_WRITES = '1'
python website/test_admin_authenticated.py
```

Clear the variables after the run:

```powershell
Remove-Item Env:ASMR_QA_EMAIL, Env:ASMR_QA_PASSWORD, Env:ASMR_QA_EXPECTED_ROLE, Env:ASMR_QA_ALLOW_WRITES -ErrorAction SilentlyContinue
```

## Role Matrix

Run the read-only acceptance once for each operational role: administrator,
manager, finance, marketing, inventory, production, and support. Confirm that:

- Only permitted sidebar modules are visible.
- A direct unauthorized URL returns an access error and no records.
- Read-only roles have no add, edit, archive, delete, post, or export actions.
- Orders and planned production are cancelled, not hard deleted.
- API Keys and User Management are administrator-only.
- Sensitive writes appear in the audit log.
- Logout removes the tab-scoped session and protected cache.

## External Gate

Authenticated acceptance requires the Phase 1 migration and updated
`admin-users` Edge Function to be deployed, plus at least two named active
administrator accounts. Until that is complete, the authenticated script exits
successfully with a clear skipped warning and performs no writes.
