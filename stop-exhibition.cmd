@echo off
rem Project Chrome exhibition stopper (#21). Stops only the server started by start-exhibition.cmd.
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-exhibition.ps1" %*
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  pause
) else (
  timeout /t 10
)
exit /b %RC%
