@echo off
echo Stopping CardWise Backend and Frontend processes...
taskkill /FI "WINDOWTITLE eq CardWise API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq CardWise Web*" /T /F >nul 2>&1
echo CardWise stopped.
pause
