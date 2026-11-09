@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Apply-Patch.ps1" -Action Check
pause
