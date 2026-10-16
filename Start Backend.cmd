@echo off
set "PATH=C:\Users\YOGA\Documents\Codex\runtimes\node-v24.21.0-win-x64;%PATH%"
cd /d "%~dp0server"
call npm.cmd run db:start
if errorlevel 1 goto failed
call npm.cmd run db:migrate
if errorlevel 1 goto failed
echo.
echo Keep this window open while using the backend.
echo Database check: http://127.0.0.1:3001/api/health
call npm.cmd start
exit /b
:failed
echo Backend could not start. See server\README.md.
pause
