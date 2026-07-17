param(
  [string]$Email = "j.zoneng@gmail.com",
  [string]$ExpectedRole = "admin",
  [switch]$AllowWrites
)

$ErrorActionPreference = "Stop"

$securePassword = Read-Host "Admin password for $Email" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

try {
  $env:ASMR_QA_EMAIL = $Email
  $env:ASMR_QA_PASSWORD = $plainPassword
  $env:ASMR_QA_EXPECTED_ROLE = $ExpectedRole
  if ($AllowWrites) {
    $env:ASMR_QA_ALLOW_WRITES = "1"
  } else {
    Remove-Item Env:\ASMR_QA_ALLOW_WRITES -ErrorAction SilentlyContinue
  }

  python website/test_admin_authenticated.py
} finally {
  Remove-Item Env:\ASMR_QA_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:\ASMR_QA_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:\ASMR_QA_EXPECTED_ROLE -ErrorAction SilentlyContinue
  Remove-Item Env:\ASMR_QA_ALLOW_WRITES -ErrorAction SilentlyContinue
  $plainPassword = $null
}
