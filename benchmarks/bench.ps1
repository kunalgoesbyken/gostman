<#
.SYNOPSIS
  Reproducible desktop-footprint benchmark: Gostman vs Postman vs Bruno (optionally Insomnia, Hoppscotch).

.DESCRIPTION
  Measures, per installed app:
    1. Installed size on disk (MB)
    2. Installer download size (MB) - only if you supply/keep the installer locally; nothing is downloaded
    3. Cold-start time to a visible main window (ms), median of -Runs
    4. Idle memory after -SettleSeconds (MB): sum of WorkingSet64 and PrivateMemorySize64 over the
       whole process tree (app + children, including msedgewebview2 / Electron renderers), median of -Runs

  Apps that are not installed are skipped with install instructions. The script never downloads or
  installs anything. Every process it launches is killed afterwards.

.EXAMPLE
  .\bench.ps1
  .\bench.ps1 -Apps Gostman,Bruno -Runs 3 -SettleSeconds 10
  .\bench.ps1 -InstallerPaths @{ Postman='C:\dl\Postman-Setup.exe'; Bruno='C:\dl\bruno_setup.exe' }
#>
[CmdletBinding()]
param(
  [string[]]$Apps = @('Gostman','Postman','Bruno'),   # also: Insomnia, Hoppscotch
  [int]$Runs = 5,
  [int]$SettleSeconds = 20,
  [int]$StartTimeoutSeconds = 60,
  [string]$GostmanPath,                                # override Gostman exe path
  [hashtable]$InstallerPaths = @{},                    # AppName -> local installer file
  [string]$OutDir = $PSScriptRoot,
  [string]$DataDir,
  [string]$Workspace
)

$ErrorActionPreference = 'Stop'

$localApp = $env:LOCALAPPDATA
$pf   = $env:ProgramFiles
$repoBin = Join-Path $PSScriptRoot '..\gostman-gui\build\bin\Gostman.exe'

# name -> exe name, candidate exe paths (first existing wins), winget id, installer glob hints
$catalog = [ordered]@{
  Gostman = @{
    Candidates = @($GostmanPath, $repoBin, "$localApp\Programs\Gostman\Gostman.exe", "$pf\Gostman\Gostman.exe")
    Winget = $null
    Hint = 'Download Gostman.exe from https://github.com/kunalgoesbyken/gostman/releases, or pass -GostmanPath.'
    InstallerGlob = @('Gostman*setup*.exe','Gostman*installer*.exe','Gostman*.msi')
  }
  Postman = @{
    Candidates = @("$localApp\Postman\Postman.exe", "$localApp\Programs\Postman\Postman.exe", "$pf\Postman\Postman.exe")
    Winget = 'Postman.Postman'
    Hint = 'winget install --id Postman.Postman -e'
    InstallerGlob = @('Postman*Setup*.exe','Postman-win*.exe')
  }
  Bruno = @{
    Candidates = @("$localApp\Programs\Bruno\Bruno.exe", "$localApp\Programs\bruno\Bruno.exe", "$pf\Bruno\Bruno.exe", "$localApp\Bruno\Bruno.exe")
    Winget = 'Bruno.Bruno'
    Hint = 'winget install --id Bruno.Bruno -e'
    InstallerGlob = @('bruno*setup*.exe','bruno_*.exe')
  }
  Insomnia = @{
    Candidates = @("$localApp\insomnia\Insomnia.exe", "$localApp\Programs\insomnia\Insomnia.exe", "$pf\Insomnia\Insomnia.exe")
    Winget = 'Insomnia.Insomnia'
    Hint = 'winget install --id Insomnia.Insomnia -e   (optional)'
    InstallerGlob = @('Insomnia*Setup*.exe','Insomnia.Core*.exe')
  }
  Hoppscotch = @{
    Candidates = @("$localApp\Programs\Hoppscotch\Hoppscotch.exe", "$localApp\Hoppscotch\Hoppscotch.exe", "$pf\Hoppscotch\Hoppscotch.exe")
    Winget = 'hoppscotch.Hoppscotch'
    Hint = 'winget install --id hoppscotch.Hoppscotch -e   (optional)'
    InstallerGlob = @('Hoppscotch*.exe','Hoppscotch*.msi')
  }
}

function Get-Median([double[]]$v) {
  if (-not $v -or $v.Count -eq 0) { return $null }
  $s = @($v | Sort-Object)
  $n = $s.Count
  if ($n % 2) { return $s[[int](($n - 1) / 2)] }
  return ($s[$n/2 - 1] + $s[$n/2]) / 2
}

function Get-DirSizeBytes([string]$p) {
  if (Test-Path -LiteralPath $p -PathType Leaf) { return (Get-Item -LiteralPath $p).Length }
  $sum = (Get-ChildItem -LiteralPath $p -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  if ($null -eq $sum) { 0 } else { $sum }
}

# Install root: Squirrel layouts (app-x.y.z next to Update.exe) -> parent; a lone exe -> the file
# itself (portable); otherwise the exe's folder.
function Get-InstallRoot([string]$exe) {
  $dir = Split-Path $exe -Parent
  $parent = Split-Path $dir -Parent
  if ((Split-Path $dir -Leaf) -like 'app-*' -and (Test-Path (Join-Path $parent 'Update.exe'))) { return $parent }
  $items = @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)
  $portable = ($items.Count -le 6) -and -not ($items | Where-Object { $_.PSIsContainer })
  if ($portable -and ($dir -notlike "$pf*") -and ($dir -notlike "$localApp\Programs*")) { return $exe }
  return $dir
}

function Find-Installer([string]$name, $entry) {
  if ($InstallerPaths.ContainsKey($name) -and (Test-Path $InstallerPaths[$name])) { return (Get-Item $InstallerPaths[$name]).Length }
  foreach ($g in $entry.InstallerGlob) {
    $f = Get-ChildItem -Path "$env:USERPROFILE\Downloads" -Filter $g -File -ErrorAction SilentlyContinue |
         Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($f) { return $f.Length }
  }
  return $null
}

# Descendants (inclusive) of the given root PIDs, from a fresh process-table snapshot.
function Get-Tree([int[]]$rootPids) {
  $all = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId
  $kids = @{}
  foreach ($p in $all) {
    $pp = [int]$p.ParentProcessId
    if (-not $kids.ContainsKey($pp)) { $kids[$pp] = New-Object System.Collections.Generic.List[int] }
    $kids[$pp].Add([int]$p.ProcessId)
  }
  $seen = New-Object System.Collections.Generic.HashSet[int]
  $q = New-Object System.Collections.Generic.Queue[int]
  foreach ($r in $rootPids) { if ($seen.Add($r)) { $q.Enqueue($r) } }
  while ($q.Count) {
    $c = $q.Dequeue()
    if ($kids.ContainsKey($c)) { foreach ($k in $kids[$c]) { if ($seen.Add($k)) { $q.Enqueue($k) } } }
  }
  return @($seen)
}

# Root processes = every process running this exact image (handles single-instance relaunch stubs).
function Get-Roots([string]$exe) {
  $leaf = [IO.Path]::GetFileNameWithoutExtension($exe)
  @(Get-Process -Name $leaf -ErrorAction SilentlyContinue | Where-Object {
      try { $_.Path -ieq $exe } catch { $false } } | ForEach-Object { $_.Id })
}

function Stop-All([string]$exe) {
  $roots = Get-Roots $exe
  if ($roots) { foreach ($id in (Get-Tree $roots)) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }
  $t = [Diagnostics.Stopwatch]::StartNew()
  while ((Get-Roots $exe) -and $t.Elapsed.TotalSeconds -lt 15) { Start-Sleep -Milliseconds 200 }
  Start-Sleep -Seconds 2
}

function Initialize-DataDir([string]$dir, [string]$folder) {
  $appData = Join-Path $dir 'Gostman'
  New-Item -ItemType Directory -Force -Path $appData | Out-Null
  if (-not $folder) { return }
  $root = (Resolve-Path -LiteralPath $folder).Path
  $state = [ordered]@{
    current = $root; recent = @($root); pinned = @(); names = @{}
    folders = @{ $root = [ordered]@{ trusted = $true; activeEnvironmentId = ''; collapsed = @(); tokens = @{} } }
  }
  $json = $state | ConvertTo-Json -Depth 5
  [IO.File]::WriteAllText((Join-Path $appData 'workspaces.json'), $json, (New-Object Text.UTF8Encoding $false))
}

function Measure-Once([string]$exe, [int]$settle, [int]$timeout) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $proc = Start-Process -FilePath $exe -PassThru -WorkingDirectory (Split-Path $exe -Parent)
  $ready = $false
  while ($sw.Elapsed.TotalSeconds -lt $timeout) {
    $roots = Get-Roots $exe
    if (-not $roots) { $roots = @($proc.Id) }
    foreach ($id in (Get-Tree $roots)) {
      $p = Get-Process -Id $id -ErrorAction SilentlyContinue
      if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero -and $p.MainWindowTitle) { $ready = $true; break }
    }
    if ($ready) { break }
    Start-Sleep -Milliseconds 20
  }
  $startMs = $sw.Elapsed.TotalMilliseconds
  if (-not $ready) { return [pscustomobject]@{ Ok = $false } }
  Start-Sleep -Seconds $settle
  $roots = Get-Roots $exe
  if (-not $roots) { $roots = @($proc.Id) }
  $ws = 0L; $priv = 0L; $n = 0
  foreach ($id in (Get-Tree $roots)) {
    $p = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($p) { $ws += $p.WorkingSet64; $priv += $p.PrivateMemorySize64; $n++ }
  }
  [pscustomobject]@{ Ok = $true; StartMs = $startMs; WsMB = $ws / 1MB; PrivMB = $priv / 1MB; Procs = $n }
}

# ---- machine info ----
$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim()
$ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
$os  = Get-CimInstance Win32_OperatingSystem
$disk = try { (Get-PhysicalDisk | Select-Object -First 1 | ForEach-Object { "$($_.MediaType) $($_.FriendlyName)" }) } catch { 'unknown' }
$wv2 = try { (Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction Stop).pv } catch { 'unknown' }
Write-Host "Machine: $cpu | $ram GB RAM | Windows build $($os.BuildNumber) | WebView2 runtime $wv2" -ForegroundColor Cyan

$results = @()
foreach ($name in $Apps) {
  if (-not $catalog.Contains($name)) { Write-Warning "Unknown app '$name' (valid: $($catalog.Keys -join ', '))"; continue }
  $entry = $catalog[$name]
  $exe = $entry.Candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if ($exe) { $exe = (Resolve-Path -LiteralPath $exe).Path }
  if (-not $exe) {
    Write-Host "[$name] not installed - skipping. To install: $($entry.Hint)" -ForegroundColor Yellow
    if ($entry.Winget) { Write-Host "         (winget id: $($entry.Winget); verify with: winget search $name)" -ForegroundColor DarkYellow }
    $results += [pscustomobject]@{ App = $name; Status = 'not installed'; Exe = $null }
    continue
  }
  if (Get-Roots $exe) {
    Write-Host "[$name] already running - close it fully first. Skipping." -ForegroundColor Yellow
    $results += [pscustomobject]@{ App = $name; Status = 'already running'; Exe = $exe }
    continue
  }

  Write-Host "[$name] $exe" -ForegroundColor Green
  $root = Get-InstallRoot $exe
  $installMB = (Get-DirSizeBytes $root) / 1MB
  $instBytes = Find-Installer $name $entry
  $instMB = if ($instBytes) { $instBytes / 1MB } else { $null }

  $savedAppData = $env:APPDATA
  if ($name -eq 'Gostman' -and $DataDir) {
    Initialize-DataDir $DataDir $Workspace
    $env:APPDATA = (Resolve-Path -LiteralPath $DataDir).Path
  }
  $runsData = @()
  for ($i = 1; $i -le $Runs; $i++) {
    Write-Host ("  run {0}/{1} ..." -f $i, $Runs) -NoNewline
    try { $r = Measure-Once $exe $SettleSeconds $StartTimeoutSeconds }
    finally { Stop-All $exe }
    if ($r.Ok) {
      Write-Host (" start {0:N0} ms, WS {1:N0} MB, private {2:N0} MB, {3} procs" -f $r.StartMs, $r.WsMB, $r.PrivMB, $r.Procs)
      $runsData += $r
    } else { Write-Host " no visible window within ${StartTimeoutSeconds}s" -ForegroundColor Red }
  }
  $env:APPDATA = $savedAppData

  $ok = $runsData.Count -gt 0
  $results += [pscustomobject]@{
    App = $name; Status = if ($ok) { 'ok' } else { 'no window' }; Exe = $exe; InstallRoot = $root
    InstalledMB = [math]::Round($installMB, 1)
    InstallerMB = if ($instMB) { [math]::Round($instMB, 1) } else { $null }
    OkRuns = $runsData.Count
    StartMsMedian = if ($ok) { [math]::Round((Get-Median ([double[]]$runsData.StartMs)), 0) } else { $null }
    StartMsAll = @($runsData | ForEach-Object { [math]::Round($_.StartMs, 0) })
    WorkingSetMBMedian = if ($ok) { [math]::Round((Get-Median ([double[]]$runsData.WsMB)), 1) } else { $null }
    PrivateMBMedian = if ($ok) { [math]::Round((Get-Median ([double[]]$runsData.PrivMB)), 1) } else { $null }
    ProcessCountMedian = if ($ok) { Get-Median ([double[]]$runsData.Procs) } else { $null }
  }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$meta = [ordered]@{
  Timestamp = (Get-Date).ToString('o'); CPU = $cpu; RAM_GB = $ram; WindowsBuild = $os.BuildNumber
  Disk = $disk; WebView2 = $wv2; Runs = $Runs; SettleSeconds = $SettleSeconds
  DataDir = $DataDir; Workspace = $Workspace
}
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }
$jsonPath = Join-Path $OutDir "results-$stamp.json"
[pscustomobject]@{ Machine = $meta; Results = $results } | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonPath -Encoding utf8

Write-Host ""
$results | Where-Object { $_.Status -eq 'ok' } |
  Format-Table App, InstalledMB, InstallerMB, StartMsMedian, WorkingSetMBMedian, PrivateMBMedian, ProcessCountMedian -AutoSize
Write-Host "Raw results: $jsonPath"
Write-Host "Copy the numbers into results.md together with the machine line above. Do not publish numbers you did not measure."
