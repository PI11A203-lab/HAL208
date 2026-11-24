<#
.SYNOPSIS
  展示PCで Project Chrome を起動します（#21）。

.DESCRIPTION
  1. 作品フォルダー（project-chrome）と Node.js を確認します。
  2. ポート（展示画面 8000、スマホ受取 8001）が空いているか確認します。使用中なら理由を表示して終了し、他のアプリは止めません。
  3. 展示用サーバー（scripts/serve.mjs ＝ npm run serve と同じ）を裏で起動し、PID を記録します。
     Node.js が無い時だけ、Python の http.server で起動します（QR 受取は使えません）。
  4. Chrome（無ければ Edge、さらに無ければ既定のブラウザー）で http://localhost:<Port>/ を開きます。

  npm install や git pull は実行しません（serve.mjs は追加の npm パッケージを使いません）。
  終了は stop-exhibition.ps1（stop-exhibition.cmd）で行います。
  スタッフは repo ルートの start-exhibition.cmd をダブルクリックして使います。

.PARAMETER Port
  展示画面のポート（初期値 8000）。変えるとブラウザーのカメラ許可を取り直す必要があります。

.PARAMETER LanPort
  スマホがレシートを受け取るポート（初期値 8001）。

.PARAMETER Python
  Node.js を使わず Python の http.server で起動します（QR 受取は使えません）。

.PARAMETER NoBrowser
  ブラウザーを開きません（自動テスト用）。

.PARAMETER CheckOnly
  確認だけ行い、サーバーは起動しません。

.PARAMETER SkipNetCheck
  インターネット接続の確認を省きます。
#>
[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)][int]$Port = 8000,
  [ValidateRange(1024, 65535)][int]$LanPort = 8001,
  [switch]$Python,
  [switch]$NoBrowser,
  [switch]$CheckOnly,
  [switch]$SkipNetCheck
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'exhibition-common.ps1')

$MinNode = [Version]'20.19.0' # package.json の engines と合わせる
$MinPython = [Version]'3.8'

# 外部コマンドを実行して標準出力の行を返す。見つからない・失敗した時は $null。
# Windows PowerShell 5.1 で標準エラー出力が例外にならないよう、一時的に Continue にする。
function Invoke-Probe([string]$Exe, [string[]]$ProbeArgs) {
  $prevPref = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = @(& $Exe @ProbeArgs 2>$null)
    if ($LASTEXITCODE -ne 0) { return $null }
    return , $out
  } catch {
    return $null
  } finally {
    $ErrorActionPreference = $prevPref
  }
}

# Node.js を探す。volta・nvm 等の中継（shim）では別PIDになるため、process.execPath で実体の場所を求めて直接起動する。
function Find-Node {
  $cmd = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $cmd) { return @{ Best = $null; Found = $null } }
  $out = Invoke-Probe $cmd.Source @('-p', "process.versions.node+'|'+process.execPath")
  if (-not $out -or $out.Count -lt 1) { return @{ Best = $null; Found = $null } }
  $parts = ([string]$out[0]).Trim().Split('|')
  $ver = $null
  if ($parts.Count -lt 2 -or -not [Version]::TryParse($parts[0], [ref]$ver)) { return @{ Best = $null; Found = $null } }
  $info = @{ Version = $ver; Exe = $parts[1] }
  if ($ver -ge $MinNode -and (Test-Path -LiteralPath $info.Exe)) { return @{ Best = $info; Found = $info } }
  return @{ Best = $null; Found = $info }
}

# Python 3 を探す。py ランチャー経由では子プロセスが別PIDになるため、実体の python.exe の場所を求めて直接起動する。
# Microsoft Store の案内だけを出す python.exe（App実行エイリアス）は版が取れないため候補から外れる。
function Find-Python {
  $probe = "import sys;v=sys.version_info;print('%d.%d.%d' % (v[0], v[1], v[2]));print(getattr(sys,'_base_executable','') or sys.executable)"
  $candidates = @(
    @{ Name = 'py'; Args = @('-3') },
    @{ Name = 'python'; Args = @() },
    @{ Name = 'python3'; Args = @() }
  )
  $found = @()
  foreach ($c in $candidates) {
    $cmd = Get-Command $c.Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $cmd) { continue }
    $out = Invoke-Probe $cmd.Source (@($c.Args) + @('-c', $probe))
    if (-not $out -or $out.Count -lt 2) { continue }
    $ver = $null
    if (-not [Version]::TryParse(([string]$out[0]).Trim(), [ref]$ver)) { continue }
    $exe = ([string]$out[1]).Trim()
    if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { continue }
    $found += @{ Command = $c.Name; Version = $ver; Exe = $exe }
    if ($ver -ge $MinPython) { return @{ Best = $found[-1]; All = $found } }
  }
  return @{ Best = $null; All = $found }
}

function Test-Internet {
  $hosts = @('cdn.jsdelivr.net', 'storage.googleapis.com')
  $ng = @()
  foreach ($h in $hosts) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $task = $client.ConnectAsync($h, 443)
      if (-not $task.Wait(3000) -or -not $client.Connected) { $ng += $h }
    } catch {
      $ng += $h
    } finally {
      $client.Close()
    }
  }
  return $ng
}

function Open-Browser([string]$Url) {
  foreach ($name in @('chrome', 'msedge')) {
    try {
      Start-Process -FilePath $name -ArgumentList $Url -ErrorAction Stop
      return $name
    } catch {
      $null = $_ # 未インストールなら次の候補へ
    }
  }
  Start-Process -FilePath $Url
  return '既定のブラウザー'
}

function Show-LogTail {
  if (Test-Path -LiteralPath $script:ErrLog) {
    $lines = @(Get-Content -LiteralPath $script:ErrLog -Encoding UTF8 -Tail 15 -ErrorAction SilentlyContinue)
    if ($lines.Count -gt 0) {
      Write-Step "--- $script:ErrLog の末尾 ---"
      $lines | ForEach-Object { Write-Step $_ }
    }
  }
}

Write-Host ''
Write-Host '=== Project Chrome 展示用の起動 ===' -ForegroundColor Cyan
Write-Step "作品フォルダー：$script:AppRoot"

# 1. 作品フォルダー
if (-not (Test-Path -LiteralPath (Join-Path $script:AppRoot 'index.html'))) {
  Write-Fail '作品フォルダー（project-chrome\index.html）が見つかりません。'
  Write-Step 'start-exhibition.cmd を移動・コピーせず、HAL208 フォルダーの中にあるものを使ってください。'
  exit 1
}

# 2. 既にこのツールで起動中なら、ブラウザーを開くだけにする
$state = Read-ServerState
$owned = Get-OwnedServerProcess $state
if ($owned) {
  $url = Get-ServerUrl ([int]$state.port)
  Write-Ok "既にこのツールで起動しています（PID $($owned.Id)、$url）。"
  if ($CheckOnly) { exit 0 }
  if (-not $NoBrowser) { Write-Ok "$(Open-Browser $url) で開きました。" }
  exit 0
}
if ($state) { Remove-ServerState } # 前回の記録が残っているだけ（PCの再起動など）

# 3. サーバーの実行環境（Node.js。無ければ Python で代替）
$serveScript = Join-Path $script:RepoRoot 'scripts\serve.mjs'
$mode = $null; $runtime = $null
if (-not $Python) {
  $node = Find-Node
  if ($node.Best -and (Test-Path -LiteralPath $serveScript)) {
    $mode = 'node'; $runtime = $node.Best
    Write-Ok "Node.js $($runtime.Version)（$($runtime.Exe)）"
  } elseif (-not (Test-Path -LiteralPath $serveScript)) {
    Write-Note 'scripts\serve.mjs が無い版です。Python で起動します（QR 受取は使えません）。'
  } elseif ($node.Found) {
    Write-Note "Node.js $($node.Found.Version) は古いため使えません（$MinNode 以上が必要）。"
  } else {
    Write-Note 'Node.js が見つかりません。'
  }
}
if (-not $mode) {
  $py = Find-Python
  if ($py.Best) {
    $mode = 'python'; $runtime = $py.Best
    Write-Ok "Python $($runtime.Version)（$($runtime.Exe)）"
    Write-Note 'Python で起動するため、仮想購入の QR 受取は使えません（写真のPC保存は使えます）。'
  } else {
    Write-Fail '作品を起動するための Node.js（推奨）または Python 3 が見つかりません。'
    if ($py.All.Count -gt 0) {
      $vers = ($py.All | ForEach-Object { "$($_.Command) $($_.Version)" }) -join ', '
      Write-Step "見つかった Python は古すぎます（$vers。$MinPython 以上が必要）。"
    }
    Write-Step "https://nodejs.org/ から Node.js（$MinNode 以上の LTS）をインストールしてください（初回だけ・開発担当に依頼）。"
    exit 1
  }
}

# 4. ポート（QR 受取を使う時は LAN 側も）
$ports = @($Port)
if ($mode -eq 'node') {
  if ($LanPort -eq $Port) { Write-Fail '-Port と -LanPort には別の番号を指定してください。'; exit 1 }
  $ports += $LanPort
}
foreach ($p in $ports) {
  $portInfo = Get-PortOwners $p
  if ($portInfo.Owners.Count -gt 0) {
    Write-Fail "ポート $p は他のアプリが使用中のため起動できません。他のアプリは停止しません。"
    Write-PortOwners $portInfo.Owners
    if (@($portInfo.Owners | Where-Object { $_.Name -match '^(python|py|node)' }).Count -gt 0) {
      Write-Step '手動（npm run serve や python -m http.server）で起動したサーバーの可能性があります。'
      Write-Step "その黒い画面（ターミナル）で Ctrl+C を押して止めるか、そのまま $(Get-ServerUrl $Port) を開いて使ってください。"
    } else {
      Write-Step '使用中のアプリを閉じてからやり直すか、開発担当に相談してください。'
    }
    exit 1
  }
  if ($portInfo.Known) { Write-Ok "ポート $p は空いています。" } else { Write-Ok "ポート $p は空いています（簡易確認）。" }
}

# 5. インターネット（作品は外部のライブラリ・モデルを読み込むため。失敗しても起動は続ける）
if (-not $SkipNetCheck) {
  $ng = @(Test-Internet)
  if ($ng.Count -gt 0) {
    Write-Note "インターネット上の読込先に接続できません：$($ng -join ', ')"
    Write-Step 'このままだと「モデルを読み込めませんでした」と出ます。Wi-Fi・LAN ケーブルを確認してください。'
  } else {
    Write-Ok 'インターネット上の読込先に接続できます。'
  }
}

if ($CheckOnly) {
  Write-Ok '確認だけ行いました（-CheckOnly）。サーバーは起動していません。'
  exit 0
}

# 6. 起動（ウィンドウは表示せず、ログを .exhibition\server.log に残す）
if (-not (Test-Path -LiteralPath $script:RunDir)) { $null = New-Item -ItemType Directory -Path $script:RunDir }
# ログはサーバー自身にファイルへ書かせる。ツール側でパイプ中継すると、ツール終了後にサーバーが書き込みに失敗するため。
# 作業ディレクトリからの相対パスにして、日本語・空白を含むパスを引数に入れない。
# Start-Process は引数を空白でつないで渡すため、ここのコードには空白を入れない。
if ($mode -eq 'node') {
  $env:PORT = "$Port"
  $env:LAN_PORT = "$LanPort"
  $boot = "fs=require('fs');p='.exhibition/server.log';fs.writeFileSync(p,'');" +
          "process.stdout.write=process.stderr.write=(c)=>{fs.appendFileSync(p,c);return!0};" +
          "import('./scripts/serve.mjs')"
  $startArgs = @{ FilePath = $runtime.Exe; ArgumentList = @('-e', $boot); WorkingDirectory = $script:RepoRoot; PassThru = $true }
} else {
  $boot = "sys=__import__('sys');runpy=__import__('runpy');f=open('../.exhibition/server.log','w',encoding='utf-8',buffering=1);" +
          "sys.stdout=sys.stderr=f;sys.argv=['http.server','$Port','--bind','127.0.0.1'];" +
          "runpy.run_module('http.server',run_name='__main__',alter_sys=True)"
  $startArgs = @{ FilePath = $runtime.Exe; ArgumentList = @('-c', $boot); WorkingDirectory = $script:AppRoot; PassThru = $true }
}
if ($script:OnWindows) { $startArgs.WindowStyle = 'Hidden' }
try {
  $proc = Start-Process @startArgs
} catch {
  Write-Fail "サーバーを起動できませんでした：$($_.Exception.Message)"
  exit 1
}

$url = Get-ServerUrl $Port
$ready = $false
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
  if ($proc.HasExited) { break }
  try {
    $res = Invoke-LocalHttp "http://127.0.0.1:$Port/"
    if ($res.Status -eq 200) { $ready = $true; break }
  } catch {
    Start-Sleep -Milliseconds 300
  }
}
# Node.js ではスマホ用（LAN 側）の待ち受けも始まってから成功とする
if ($ready -and $mode -eq 'node') {
  $ready = $false
  while ((Get-Date) -lt $deadline -and -not $proc.HasExited) {
    $c = New-Object System.Net.Sockets.TcpClient
    try { $c.Connect('127.0.0.1', $LanPort); $ready = $true; break } catch { Start-Sleep -Milliseconds 300 } finally { $c.Close() }
  }
}
if (-not $ready) {
  Write-Fail 'サーバーが起動しませんでした。'
  Show-LogTail
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  exit 1
}

# 自分が起動したプロセスであることを後で確かめられるよう記録する
$proc.Refresh()
$exePath = ''
try { if ($proc.Path) { $exePath = $proc.Path } } catch { $exePath = '' }
$record = [ordered]@{
  pid = $proc.Id
  startTicksUtc = $proc.StartTime.ToUniversalTime().Ticks
  exe = $exePath
  mode = $mode
  port = $Port
  lanPort = $(if ($mode -eq 'node') { $LanPort } else { $null })
  url = $url
  repoRoot = $script:RepoRoot
  startedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
}
$record | ConvertTo-Json | Set-Content -LiteralPath $script:StateFile -Encoding UTF8

# 同じポートを他のプロセスも待ち受けていたら（ほぼ起きないが）ブラウザーが別のアプリへつながる恐れがある
$after = Get-PortOwners $Port
if ($after.Known) {
  $others = @($after.Owners | Where-Object { $_.Pid -ne $proc.Id })
  if ($others.Count -gt 0) {
    Write-Note "ポート $Port を他のアプリも待ち受けています。画面が作品と違う場合は stop-exhibition.cmd で止めて開発担当に相談してください。"
    Write-PortOwners $others
  }
}

if ($mode -eq 'node') {
  # QR に入るスマホ用アドレス（LAN の IPv4）を確認する
  try {
    $info = (Invoke-LocalHttp "http://127.0.0.1:$Port/api/server-info").Body | ConvertFrom-Json
    if ($info.lan) {
      Write-Ok "スマホ受取用のアドレス：$($info.lan)（スマホは展示PCと同じ Wi-Fi に接続）"
    } else {
      Write-Note 'このPCに LAN の IPv4 アドレスがありません（Wi-Fi 未接続など）。この状態では QR 受取が使えません。'
    }
  } catch {
    Write-Note "スマホ受取の状態を確認できませんでした：$($_.Exception.Message)"
  }
} else {
  # ES Modules は JavaScript の MIME 型でないと読み込めない（Windows のレジストリ設定で text/plain になる場合がある）
  try {
    $js = Invoke-LocalHttp "http://127.0.0.1:$Port/js/main.js"
    if ($js.ContentType -notmatch 'javascript|ecmascript') {
      Write-Note "JavaScript の配信形式が「$($js.ContentType)」です。画面が「起動中...」のまま進まない可能性があります。"
      Write-Step 'docs/exhibition-operations.md の「画面が起動中...のまま」を参照し、開発担当に相談してください。'
    }
  } catch {
    Write-Note "js/main.js を取得できませんでした：$($_.Exception.Message)"
  }
}

Write-Ok "サーバーを起動しました（PID $($proc.Id)）。"
Write-Host ''
Write-Host "  作品のURL：$url" -ForegroundColor Cyan
if (-not $NoBrowser) {
  $browser = Open-Browser $url
  Write-Ok "$browser で開きました。カメラの許可を求められたら「許可」を選んでください。"
}
Write-Step '終了するときは stop-exhibition.cmd を実行します。このウィンドウは閉じて構いません。'
exit 0
