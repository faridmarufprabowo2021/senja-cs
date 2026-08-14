$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Graphify = $null
foreach ($c in @(
  "$env:USERPROFILE\.local\bin\graphify.exe",
  "$env:APPDATA\uv\tools\graphifyy\Scripts\graphify.exe",
  (Get-Command graphify -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
)) {
  if ($c -and (Test-Path $c)) { $Graphify = $c; break }
}

if ($Graphify) {
  & $Graphify . --update --no-viz
  & $Graphify export html 2>$null
  Write-Output "graphify update via CLI: $Graphify"
  exit 0
}

$pyFile = "graphify-out\.graphify_python"
if (-not (Test-Path $pyFile)) { Write-Error "graphify not installed for this repo" }
$py = (Get-Content $pyFile -Raw).Trim()
Write-Host "CLI missing; running AST rebuild fallback..."
& $py -c "print('fallback: install graphify CLI with: uv tool install graphifyy')"
exit 1
