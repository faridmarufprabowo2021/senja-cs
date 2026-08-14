$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
if (Get-Command graphify -ErrorAction SilentlyContinue) {
  graphify . --no-viz
  graphify export html 2>$null
} else {
  Write-Host "Use agent skill /graphify . for full rebuild (graphify CLI not on PATH)."
  Write-Host "Or: pnpm graphify:update after first agent build."
}
