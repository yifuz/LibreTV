param(
    [ValidateSet('start', 'stop', 'status')]
    [string]$Action = 'start',
    [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$projectDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeDir = Join-Path $projectDir '.local'
$statePath = Join-Path $runtimeDir 'server.json'
$siteUrl = 'http://localhost:8080'

function Get-ManagedServer {
    if (-not (Test-Path -LiteralPath $statePath)) { return $null }
    $saved = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $server = Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
    if (-not $server) { return $null }
    if ($server.Path -ne $saved.nodePath -or
        [string]$server.StartTime.ToUniversalTime().Ticks -ne [string]$saved.startTicks) {
        throw 'Saved process identity no longer matches. No process was stopped.'
    }
    return $server
}

$server = Get-ManagedServer
if ($Action -eq 'stop') {
    if ($server) { Stop-Process -Id $server.Id; $server.WaitForExit(10000) | Out-Null }
    if (Test-Path -LiteralPath $statePath) { Remove-Item -LiteralPath $statePath }
    Write-Host 'LibreTV stopped.'
    exit 0
}
if ($Action -eq 'status') {
    if (-not $server) { Write-Host 'LibreTV is stopped.'; exit 0 }
    $status = Invoke-RestMethod "$siteUrl/api/status" -TimeoutSec 5
    Write-Host "LibreTV $($status.version) is running at $siteUrl (PID $($server.Id))."
    exit 0
}
if (-not $server) {
    $nodePath = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    if (-not (Test-Path -LiteralPath (Join-Path $projectDir '.env.local'))) { throw 'Run npm run setup:local first.' }
    if (-not (Test-Path -LiteralPath (Join-Path $projectDir '.next/BUILD_ID'))) { throw 'Run npm ci and npm run build first.' }
    if (Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue) { throw 'Port 8080 is occupied. Nothing was stopped.' }
    [System.IO.Directory]::CreateDirectory($runtimeDir) | Out-Null
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $nextPath = Join-Path $projectDir 'node_modules/next/dist/bin/next'
    $server = Start-Process -FilePath $nodePath -WorkingDirectory $projectDir `
        -ArgumentList @(('"{0}"' -f $nextPath), 'start', '--port', '8080', '--hostname', '127.0.0.1') `
        -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'server.log') `
        -RedirectStandardError (Join-Path $runtimeDir 'server-error.log') -PassThru
    @{ pid = $server.Id; nodePath = $server.Path; startTicks = [string]$server.StartTime.ToUniversalTime().Ticks } |
        ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
}
$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $server.Refresh()
    if ($server.HasExited) { throw 'LibreTV exited. Check .local/server-error.log.' }
    try {
        $status = Invoke-RestMethod "$siteUrl/api/status" -TimeoutSec 2
        if ($status.passwordRequired -and $status.version) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'LibreTV did not become ready. Check .local logs.' }
Write-Host "LibreTV $($status.version) is ready at $siteUrl."
if ($OpenBrowser) { Start-Process $siteUrl }
