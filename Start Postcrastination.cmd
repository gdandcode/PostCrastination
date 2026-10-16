@echo off
set "PATH=C:\Users\YOGA\Documents\Codex\runtimes\node-v24.21.0-win-x64;%PATH%"
cd /d "%~dp0"
call npm.cmd run dev -- --open
pause
