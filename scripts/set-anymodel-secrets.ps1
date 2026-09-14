# Sets AnyModel secrets for Supabase Edge Function `anymodel-chat`.
# Requires: npx supabase login OR $env:SUPABASE_ACCESS_TOKEN
param(
  [string]$ProjectRef = "yxxwpsodzksvxpvizybt",
  [Parameter(Mandatory = $true)]
  [string]$ApiKey,
  [string]$BaseUrl = "https://anymodel.org/v1",
  [string]$Model = "cx/gpt-5.6-luna"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Setting AnyModel secrets for project $ProjectRef..."
npx supabase secrets set `
  --project-ref $ProjectRef `
  "ANYMODEL_API_KEY=$ApiKey" `
  "ANYMODEL_BASE_URL=$BaseUrl" `
  "ANYMODEL_MODEL=$Model"

Write-Host "AnyModel secrets updated."
