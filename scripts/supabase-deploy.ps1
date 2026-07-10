#Requires -Version 5.1
<#
.SYNOPSIS
  Load deploy.env and run Supabase CLI commands from tradepro-backend.
#>
$ErrorActionPreference = 'Stop'

$frontendRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path $frontendRoot)) {
  $frontendRoot = 'c:\Users\dolab\Downloads\Bathroom Sales Estimation Platform'
}

$deployEnv = Join-Path $frontendRoot '.cursor\local\deploy.env'
if (Test-Path $deployEnv) {
  Get-Content $deployEnv | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim()
      if ($name) { Set-Item -Path "env:$name" -Value $value }
    }
  }
}

$backendRoot = 'c:\Users\dolab\Downloads\tradepro-backend'
Set-Location $backendRoot

if (-not $env:SUPABASE_ACCESS_TOKEN -and -not (Test-Path "$env:USERPROFILE\.supabase\access-token")) {
  Write-Host 'Supabase not logged in. Either:' -ForegroundColor Yellow
  Write-Host "  1. Fill in $deployEnv (copy from deploy.env.example)" -ForegroundColor Yellow
  Write-Host '  2. Run: npx supabase login  (in this terminal, then complete browser redirect)' -ForegroundColor Yellow
  exit 1
}

$cmd = $args[0]
switch ($cmd) {
  'link' {
    if (-not $env:SUPABASE_PROJECT_REF) { throw 'Set SUPABASE_PROJECT_REF in deploy.env' }
    npx supabase link --project-ref $env:SUPABASE_PROJECT_REF @args[1..($args.Length - 1)]
  }
  'push' {
    npm run supabase:push
  }
  'projects' {
    npx supabase projects list
  }
  default {
    npx supabase @args
  }
}
