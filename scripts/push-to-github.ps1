# Create SHBLN/vibe-coding-3-2 on GitHub and push main (requires gh auth).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$remote = "https://github.com/SHBLN/vibe-coding-3-2.git"

if (-not (git remote | Select-String -Pattern "^vibe-coding-3-2$" -Quiet)) {
  git remote add vibe-coding-3-2 $remote
}

$status = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run: gh auth login --web"
  throw "GitHub CLI is not authenticated."
}

gh repo view SHBLN/vibe-coding-3-2 2>$null
if ($LASTEXITCODE -ne 0) {
  gh repo create SHBLN/vibe-coding-3-2 --public --description "Vibe-coding task board (React + Supabase)"
}

git push -u vibe-coding-3-2 main
Write-Host "Done: https://github.com/SHBLN/vibe-coding-3-2"
