<#
.SYNOPSIS
  start-exhibition.ps1 で起動した Project Chrome のローカルサーバーを停止します（#21）。

.DESCRIPTION
  記録した PID・開始時刻・実行ファイルが一致するプロセスだけを停止します。
  手動で起動したサーバーや、同じポートを使う他のアプリは停止しません。
  ブラウザーは閉じないので、先にブラウザーのタブ（またはウィンドウ）を閉じてください。
#>
[CmdletBinding()]
param()

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'exhibition-common.ps1')

Write-Host ''
Write-Host '=== Project Chrome 展示用の終了 ===' -ForegroundColor Cyan

$state = Read-ServerState
if (-not $state) {
  Write-Ok 'このツールで起動したサーバーの記録はありません（既に停止しています）。'
  foreach ($p in @(8000, 8001)) {
    $portInfo = Get-PortOwners $p
    if ($portInfo.Owners.Count -gt 0) {
      Write-Note "ポート $p は使用中ですが、このツールで起動したものではないため停止しません。"
      Write-PortOwners $portInfo.Owners
      Write-Step '手動（npm run serve など）で起動した場合は、その黒い画面（ターミナル）で Ctrl+C を押して止めてください。'
    }
  }
  exit 0
}

$owned = Get-OwnedServerProcess $state
if (-not $owned) {
  Remove-ServerState
  if (Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue) {
    Write-Note "記録の PID $($state.pid) は別のアプリに再利用されているため、停止しません。"
  }
  Write-Ok 'サーバーは既に停止していました（PCの再起動など）。記録を片付けました。'
  exit 0
}

try {
  Stop-Process -Id $owned.Id -Force
  $null = $owned.WaitForExit(5000)
} catch {
  Write-Fail "サーバー（PID $($owned.Id)）を停止できませんでした：$($_.Exception.Message)"
  exit 1
}
if (-not $owned.HasExited) {
  Write-Fail "サーバー（PID $($owned.Id)）が終了しません。PC を再起動するか開発担当に相談してください。"
  exit 1
}
Remove-ServerState
Write-Ok "サーバー（PID $($owned.Id)、ポート $($state.port)）を停止しました。"
if ($state.PSObject.Properties['mode'] -and $state.mode -eq 'node') {
  Write-Step 'スマホでまだ受け取っていないレシート画像も消えました（サーバーのメモリーにだけ置いているため）。'
}
exit 0
