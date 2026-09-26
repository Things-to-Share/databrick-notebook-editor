<#
.SYNOPSIS
  Packages, installs and activates the "Databricks Notebook Editor" VS Code extension locally.

.DESCRIPTION
  Single-script deployment for this extension, per the project spec ("Local Databricks Notebook
  Editor" -> Requirements -> Deployment). It:
    1. Reads name/publisher/version from package.json to compute the extension folder id
       (<publisher>.<name>-<version>), matching VS Code's own extensions-folder naming convention.
    2. Packages the extension:
         - If Node.js + npx are available, packages a real .vsix via `npx @vscode/vsce package`
           and installs it with `code --install-extension <vsix> --force` (when the `code` CLI
           is on PATH). This is the preferred path.
         - Otherwise (no Node.js / no `code` CLI - this machine has neither by default), falls
           back to a manual copy: the extension's own source files are copied straight into
           %USERPROFILE%\.vscode\extensions\<publisher>.<name>-<version>\, which is exactly what
           VS Code would have unpacked from a .vsix anyway. This requires no build tooling.
    3. Prints a reminder that VS Code only picks up (de)activated/updated extensions after
       "Developer: Reload Window" (or a full restart) - there is no CLI command that can force an
       already-running VS Code window to reload extensions from the outside.

.PARAMETER Uninstall
  Remove the manually-installed copy instead of (re)installing it.

.EXAMPLE
  .\deploy.ps1
  Packages/installs the extension using the best available method for this machine.

.EXAMPLE
  .\deploy.ps1 -Uninstall
  Removes the locally-installed copy of the extension.
#>
[CmdletBinding()]
param(
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$pkgPath = Join-Path $root 'package.json'
if (-not (Test-Path $pkgPath)) {
  throw "package.json not found next to deploy.ps1 (expected at $pkgPath)."
}
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$extensionId = "$($pkg.publisher).$($pkg.name)-$($pkg.version)"
$extensionsDir = Join-Path $env:USERPROFILE '.vscode\extensions'
$installDir = Join-Path $extensionsDir $extensionId

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Info($msg) { Write-Host "    $msg" -ForegroundColor DarkGray }

if ($Uninstall) {
  Write-Step "Uninstalling $extensionId"
  if (Test-Path $installDir) {
    Remove-Item -Recurse -Force $installDir
    Write-Info "Removed $installDir"
  } else {
    Write-Info "Nothing installed at $installDir"
  }
  Write-Host "Run 'Developer: Reload Window' in VS Code to finish removing the extension." -ForegroundColor Yellow
  return
}

Write-Step "Deploying $extensionId"
Write-Info "Source: $root"
Write-Info "Target: $installDir"

# --- Files that make up the shipped extension (mirrors what a .vsix would contain). ---
$includeItems = @('package.json', 'extension.js', 'media', '.vscodeignore', 'README.md', 'LICENSE')

$vsixPath = $null
$hasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
$hasNpx = [bool](Get-Command npx -ErrorAction SilentlyContinue)
$hasCodeCli = [bool](Get-Command code -ErrorAction SilentlyContinue)

if ($hasNode -and $hasNpx) {
  Write-Step "Packaging with @vscode/vsce"
  Push-Location $root
  try {
    npx --yes @vscode/vsce package --allow-missing-repository --skip-license -o "$root\$($pkg.name)-$($pkg.version).vsix" 2>&1 | ForEach-Object { Write-Info $_ }
    $candidate = Join-Path $root "$($pkg.name)-$($pkg.version).vsix"
    if (Test-Path $candidate) { $vsixPath = $candidate }
  } catch {
    Write-Info "vsce packaging failed ($($_.Exception.Message)) - falling back to manual copy install."
  } finally {
    Pop-Location
  }
} else {
  Write-Info "Node.js/npx not found on PATH - skipping .vsix packaging, using manual copy install instead."
}

if ($vsixPath -and $hasCodeCli) {
  Write-Step "Installing $vsixPath via 'code --install-extension'"
  code --install-extension $vsixPath --force
  Write-Host "Installed. Run 'Developer: Reload Window' in VS Code to activate the update." -ForegroundColor Yellow
  return
}

if ($vsixPath -and -not $hasCodeCli) {
  Write-Info "'code' CLI not found on PATH - packaged $vsixPath but cannot auto-install it."
  Write-Info "Install manually: open VS Code > Extensions view > '...' menu > 'Install from VSIX...' and pick the file above."
}

# --- Manual copy install (no build tooling required). ---
Write-Step "Installing by direct copy into the local extensions folder"
if (Test-Path $installDir) {
  Remove-Item -Recurse -Force $installDir
}
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

foreach ($item in $includeItems) {
  $src = Join-Path $root $item
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $installDir -Recurse -Force
    Write-Info "Copied $item"
  }
}

Write-Host ""
Write-Host "Done. Extension copied to:" -ForegroundColor Green
Write-Host "  $installDir" -ForegroundColor Green
Write-Host ""
Write-Host "To activate: reload the VS Code window (Ctrl+Shift+P -> 'Developer: Reload Window')." -ForegroundColor Yellow
Write-Host "Re-run this script after any future edit to package.json / extension.js / media/* to refresh the installed copy." -ForegroundColor Yellow
