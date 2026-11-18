$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot 'output/electron-runtime45'
$runtimeVersion = Join-Path $runtimeDir 'version'
if ((Test-Path (Join-Path $runtimeDir 'electron.exe')) -and (Test-Path $runtimeVersion) -and ((Get-Content $runtimeVersion -Raw).Trim() -eq '45.0.0')) { exit 0 }
New-Item -ItemType Directory -Path (Join-Path $projectRoot 'output') -Force | Out-Null
$archive = Join-Path $projectRoot 'output/electron-v45.0.0-win32-x64.zip'
$checksums = Join-Path $projectRoot 'output/electron-v45.0.0-SHASUMS256.txt'
if (!(Test-Path $archive)) { Invoke-WebRequest -Uri 'https://github.com/electron/electron/releases/download/v45.0.0/electron-v45.0.0-win32-x64.zip' -OutFile $archive -TimeoutSec 180 }
if (!(Test-Path $checksums)) { Invoke-WebRequest -Uri 'https://github.com/electron/electron/releases/download/v45.0.0/SHASUMS256.txt' -OutFile $checksums -TimeoutSec 30 }
$checksumLine = Get-Content $checksums | Where-Object { $_ -match '\*?electron-v45\.0\.0-win32-x64\.zip$' }
if (!$checksumLine) { throw 'Missing runtime checksum' }
$expectedHash = ($checksumLine -split '\s+')[0]
$actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
if ($actualHash.ToLowerInvariant() -ne $expectedHash.ToLowerInvariant()) { throw 'Runtime checksum mismatch' }
Expand-Archive -LiteralPath $archive -DestinationPath $runtimeDir -Force
