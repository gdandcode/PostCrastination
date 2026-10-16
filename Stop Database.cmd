@echo off
set "PATH=C:\Users\YOGA\Documents\Codex\runtimes\node-v24.21.0-win-x64;%PATH%"
cd /d "%~dp0server"
call npm.cmd run db:stop
pause
