# Build with .env.local and deploy to Cloudflare Workers (static assets).
param(
  [string]$WorkerName = "vibe-coding-3-2"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path ".env.local")) {
  throw "Missing .env.local. Create it from .env.example."
}

Write-Host "Building production bundle..."
npm run build

Write-Host "Deploying Worker '$WorkerName' with static assets from dist/..."
npx wrangler deploy

Write-Host "Deploy finished."
