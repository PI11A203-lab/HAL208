# 展示用の起動・終了スクリプトの共通処理（#21）。
# start-exhibition.ps1 / stop-exhibition.ps1 から読み込みます。単独では実行しません。
# Windows PowerShell 5.1 でも動くよう、PowerShell 7 専用の構文（??、三項演算子、IsWindows 自動変数など）は使いません。
# 日本語の案内を文字化けさせないため、このファイルは UTF-8（BOM付き）で保存します。

$script:RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$script:AppRoot = Join-Path $script:RepoRoot 'project-chrome'
# 実行時の記録とログは repo 内の .exhibition/ に置く（.gitignore 対象。commit しない）
$script:RunDir = Join-Path $script:RepoRoot '.exhibition'
$script:StateFile = Join-Path $script:RunDir 'server.json'
$script:ErrLog = Join-Path $script:RunDir 'server.log'
$script:OnWindows = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT

function Write-Step([string]$Message) { Write-Host "  $Message" }
function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Note([string]$Message) { Write-Host "[注意] $Message" -ForegroundColor Yellow }
function Write-Fail([string]$Message) { Write-Host "[エラー] $Message" -ForegroundColor Red }

function Get-ServerUrl([int]$Port) { return "http://localhost:$Port/" }

function Read-ServerState {
  if (-not (Test-Path -LiteralPath $script:StateFile)) { return $null }
  try {
    return (Get-Content -LiteralPath $script:StateFile -Raw -Encoding UTF8 | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Remove-ServerState {
  if (Test-Path -LiteralPath $script:StateFile) { Remove-Item -LiteralPath $script:StateFile -Force }
}

# 記録したPIDのプロセスが「このツールで起動したもの」と確認できた時だけ返す。
# PIDは再利用されるため、開始時刻と実行ファイルも一致しなければ他のアプリとみなして触らない。
function Get-OwnedServerProcess($State) {
  if ($null -eq $State) { return $null }
  $proc = Get-Process -Id ([int]$State.pid) -ErrorAction SilentlyContinue
  if ($null -eq $proc) { return $null }
  try {
    $diff = [Math]::Abs([long]$proc.StartTime.ToUniversalTime().Ticks - [long]$State.startTicksUtc)
    if ($diff -gt 20000000) { return $null } # 2秒より離れていれば別プロセス
    if ($State.exe -and $proc.Path -and ($proc.Path -ne $State.exe)) { return $null }
  } catch {
    return $null
  }
  return $proc
}

# 指定ポートで待ち受けているプロセスを調べる。
# 戻り値：@{ Known = 調べられたか; Owners = @(@{ Pid; Name; Path; Address }) }
function Get-PortOwners([int]$Port) {
  $owners = @()
  if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    $conns = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    foreach ($c in $conns) {
      $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
      $name = '(不明)'; $path = ''
      if ($p) {
        $name = $p.ProcessName
        try { if ($p.Path) { $path = $p.Path } } catch { $path = '' }
      }
      $owners += @{ Pid = [int]$c.OwningProcess; Name = $name; Path = $path; Address = "$($c.LocalAddress):$Port" }
    }
    return @{ Known = $true; Owners = $owners }
  }
  # Get-NetTCPConnection が無い環境では、実際に待ち受けを試して空きだけ確認する（プロセス名は分からない）
  $busy = $false
  foreach ($addr in @([System.Net.IPAddress]::Loopback, [System.Net.IPAddress]::IPv6Loopback)) {
    $listener = $null
    try {
      $listener = New-Object System.Net.Sockets.TcpListener($addr, $Port)
      $listener.Start()
    } catch {
      # 使用中のときだけ busy とする。IPv6 が無効な環境などのエラーは使用中とみなさない
      $ex = $_.Exception
      while ($ex) {
        if ($ex -is [System.Net.Sockets.SocketException] -and
            $ex.SocketErrorCode -eq [System.Net.Sockets.SocketError]::AddressAlreadyInUse) { $busy = $true }
        $ex = $ex.InnerException
      }
    } finally {
      if ($listener) { try { $listener.Stop() } catch { $null = $_ } }
    }
  }
  if ($busy) { $owners += @{ Pid = 0; Name = '(不明)'; Path = ''; Address = "localhost:$Port" } }
  return @{ Known = $false; Owners = $owners }
}

function Write-PortOwners($Owners) {
  foreach ($o in $Owners) {
    if ($o.Pid -gt 0) {
      Write-Step "使用中：$($o.Address)  PID $($o.Pid)  $($o.Name)  $($o.Path)"
    } else {
      Write-Step "使用中：$($o.Address)（使用しているアプリ名はこのPCでは調べられませんでした）"
    }
  }
}

# プロキシを通さずにローカルサーバーへ HTTP リクエストする（PowerShell 5.1/7 共通）
function Invoke-LocalHttp([string]$Url) {
  $req = [System.Net.WebRequest]::Create($Url)
  $req.Proxy = $null
  $req.Timeout = 3000
  $res = $req.GetResponse()
  try {
    $reader = New-Object System.IO.StreamReader($res.GetResponseStream(), [System.Text.Encoding]::UTF8)
    $body = $reader.ReadToEnd()
    return @{ Status = [int]$res.StatusCode; ContentType = [string]$res.ContentType; Body = $body }
  } finally {
    $res.Close()
  }
}
