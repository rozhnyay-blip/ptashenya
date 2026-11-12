$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$node = (Get-Command node.exe -ErrorAction Stop).Source
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$log = Join-Path $logs ("store-" + (Get-Date -Format "yyyy-MM-dd") + ".log")
# One Node process serves both the production storefront and API.
# Task Scheduler restarts this script if it exits with a non-zero code.
$ErrorActionPreference = "Continue"
& $node (Join-Path $PSScriptRoot "start-production.mjs") >> $log 2>&1
exit $LASTEXITCODE
