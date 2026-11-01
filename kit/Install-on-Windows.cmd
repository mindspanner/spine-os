@echo off
rem Spine OS Kit - Windows double-click installer. Opens install.ps1 (same folder) in PowerShell.
rem No admin rights, no network. Everything installs inside the one folder you choose.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
