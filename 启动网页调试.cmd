@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0tools\start-web.ps1" -OpenBrowser
if errorlevel 1 pause
