# Build with .env.local and deploy static dist/ to Cloudflare Pages.
param(
  [string]$ProjectName = "vibe-coding-3"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path ".env.local")) {
  throw "Missing .env.local. Create it from .env.example."
}

Write-Host "Building production bundle..."
npm run build

Write-Host "Deploying to Cloudflare Pages project '$ProjectName'..."
npx wrangler pages deploy dist --project-name=$ProjectName --commit-dirty=true

Write-Host "Deploy finished."
