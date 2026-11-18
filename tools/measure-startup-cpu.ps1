param([string]$Url='http://127.0.0.1:5173/?profile', [string]$ReportPrefix='output/startup-cpu')
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class StartupCpuCounter {
    [DllImport("kernel32.dll", SetLastError=true)]
    private static extern bool GetSystemTimes(out long idle, out long kernel, out long user);

    public static long[] Read() {
        long idle, kernel, user;
        if (!GetSystemTimes(out idle, out kernel, out user)) throw new Win32Exception();
        return new long[] { idle, kernel + user };
    }
}
'@

Push-Location (Split-Path -Parent $PSScriptRoot)
$originalUrl=$env:NAIWA_EDGE_URL
$originalReport=$env:NAIWA_EDGE_REPORT
try {
    $env:NAIWA_EDGE_URL=$Url
    $env:NAIWA_EDGE_REPORT="${ReportPrefix}-browser.json"
    $nodePath=(Get-Command node.exe).Source
    $clock=[Diagnostics.Stopwatch]::StartNew()
    $previous=[StartupCpuCounter]::Read()
    $process=Start-Process -FilePath $nodePath -ArgumentList 'tools/verify-foundry-edge.mjs','--startup-only','--check-progress' -WindowStyle Hidden -PassThru
    $samples=[Collections.Generic.List[object]]::new()
    while (!$process.HasExited) {
        Start-Sleep -Milliseconds 500
        $current=[StartupCpuCounter]::Read()
        $total=$current[1]-$previous[1]
        if ($total -gt 0) {
            $busy=100*(1-($current[0]-$previous[0])/$total)
            $samples.Add([pscustomobject]@{ elapsedMs=$clock.ElapsedMilliseconds; systemCpuPercent=[Math]::Round($busy,2) })
        }
        $previous=$current
    }
    $samples | Export-Csv -NoTypeInformation -Encoding utf8 -LiteralPath "${ReportPrefix}-system.csv"
    if ($process.ExitCode -ne 0) { throw "Edge startup check failed. See $env:NAIWA_EDGE_REPORT." }
    $samples | Measure-Object systemCpuPercent -Average -Maximum
} finally {
    $env:NAIWA_EDGE_URL=$originalUrl
    $env:NAIWA_EDGE_REPORT=$originalReport
    Pop-Location
}
