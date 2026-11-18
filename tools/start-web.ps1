param([switch]$OpenBrowser)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$webUrl = 'http://127.0.0.1:5173/'
$listener = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $logFolder = Join-Path $projectPath 'output'
    New-Item -ItemType Directory -Path $logFolder -Force | Out-Null
    Start-Process -FilePath $nodePath -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logFolder 'vite-dev.log') -RedirectStandardError (Join-Path $logFolder 'vite-dev.err.log') | Out-Null
}
$ready = $false
for ($attempt = 0; $attempt -lt 10; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200 -and $response.Content -match '/src/main.js') { $ready = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 300
}
if (-not $ready) { throw 'Web server did not respond. See output/vite-dev.err.log; port 5173 may belong to another application.' }
Write-Output "Web server ready: $webUrl"
if ($OpenBrowser) { Start-Process $webUrl }
