# Sync VITE_* build env vars to Cloudflare (Pages project API).
# For Workers Builds (wrangler deploy): set variables in Cloudflare Dashboard manually.
# Auth: CLOUDFLARE_API_TOKEN or `npx wrangler login`.

param(
  [string]$ProjectName = "vibe-coding-3-2",
  [string]$EnvFile = ".env.local"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Warning "Workers Builds: prefer Dashboard -> Settings -> Variables for VITE_* build env."
Write-Warning "This script targets legacy Cloudflare Pages project API."

if (-not (Test-Path $EnvFile)) {
  throw "Missing $EnvFile. Create it from .env.example."
}

$vars = @{}
Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $parts = $_ -split '=', 2
  if ($parts.Count -eq 2) {
    $vars[$parts[0].Trim()] = $parts[1].Trim()
  }
}

$required = @("VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY")
foreach ($key in $required) {
  if (-not $vars.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($vars[$key])) {
    throw "Missing $key in $EnvFile"
  }
}

$token = $env:CLOUDFLARE_API_TOKEN
if (-not $token) {
  $whoamiJson = npx wrangler whoami --json 2>$null | Out-String
  if ($whoamiJson) {
    $whoami = $whoamiJson | ConvertFrom-Json
    if ($whoami.apiToken) { $token = $whoami.apiToken }
  }
}

if (-not $token) {
  throw "Cloudflare auth missing. Set CLOUDFLARE_API_TOKEN or run: npx wrangler login"
}

$accountId = $env:CLOUDFLARE_ACCOUNT_ID
if (-not $accountId) {
  $accounts = Invoke-RestMethod `
    -Uri "https://api.cloudflare.com/client/v4/accounts?per_page=1" `
    -Headers @{ Authorization = "Bearer $token" }
  if (-not $accounts.success -or $accounts.result.Count -eq 0) {
    throw "Could not resolve Cloudflare account id."
  }
  $accountId = $accounts.result[0].id
}

$envVars = @{}
foreach ($key in $required) {
  $envVars[$key] = @{ type = "plain_text"; value = $vars[$key] }
}

$body = @{
  deployment_configs = @{
    production = @{ env_vars = $envVars }
    preview = @{ env_vars = $envVars }
  }
} | ConvertTo-Json -Depth 6

Write-Host "Updating Cloudflare Pages env vars for '$ProjectName' (account $accountId)..."

$response = Invoke-RestMethod `
  -Method Patch `
  -Uri "https://api.cloudflare.com/client/v4/accounts/$accountId/pages/projects/$ProjectName" `
  -Headers @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  } `
  -Body $body

if (-not $response.success) {
  throw "Cloudflare API error: $($response.errors | ConvertTo-Json -Compress)"
}

Write-Host "Environment variables updated."
