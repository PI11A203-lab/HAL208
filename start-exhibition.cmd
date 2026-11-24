@echo off
rem Project Chrome exhibition launcher (#21). Double-click to start.
rem Messages are shown by scripts\start-exhibition.ps1. Extra arguments (e.g. -Port 8001) are passed through.
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-exhibition.ps1" %*
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  pause
) else (
  timeout /t 15
)
exit /b %RC%
