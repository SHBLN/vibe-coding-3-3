# Applies R2 secrets from supabase/r2-secrets.env to Supabase Edge Functions.
# Requires: npx supabase login  OR  $env:SUPABASE_ACCESS_TOKEN
param(
  [string]$ProjectRef = "yxxwpsodzksvxpvizybt",
  [string]$SecretsFile = "supabase/r2-secrets.env"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path $SecretsFile)) {
  throw "Missing $SecretsFile"
}

$lines = Get-Content $SecretsFile | Where-Object {
  $_ -and -not $_.Trim().StartsWith('#')
}

if ($lines.Count -eq 0) {
  throw "No secrets found in $SecretsFile"
}

Write-Host "Applying $($lines.Count) secrets to project $ProjectRef..."
npx supabase secrets set --project-ref $ProjectRef @lines
Write-Host "Done."
