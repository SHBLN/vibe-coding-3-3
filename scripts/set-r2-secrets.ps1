# Sets Cloudflare R2 secrets for Supabase Edge Function `r2-upload-url`.
# Requires: npx supabase login OR $env:SUPABASE_ACCESS_TOKEN
param(
  [string]$ProjectRef = "yxxwpsodzksvxpvizybt",
  [string]$AccountId = "1bb98b8d84ccd00ac5d3b208dfd9701b",
  [string]$BucketName = "group07",
  [string]$PublicBaseUrl = "https://pub-5943ea523cdd4acdb8d8394f28617584.r2.dev",
  [Parameter(Mandatory = $true)]
  [string]$AccessKeyId,
  [Parameter(Mandatory = $true)]
  [string]$SecretAccessKey
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Setting R2 secrets for project $ProjectRef..."
npx supabase secrets set `
  --project-ref $ProjectRef `
  "R2_ACCOUNT_ID=$AccountId" `
  "R2_BUCKET_NAME=$BucketName" `
  "R2_PUBLIC_BASE_URL=$PublicBaseUrl" `
  "R2_ACCESS_KEY_ID=$AccessKeyId" `
  "R2_SECRET_ACCESS_KEY=$SecretAccessKey"

Write-Host "R2 secrets updated."
