@echo off
title CardWise Launcher
echo Starting CardWise Backend and Frontend...
set "PATH=C:\Program Files\nodejs;%PATH%"

start "CardWise API" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 /nobreak >nul
start "CardWise Web" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:5173
echo CardWise is launching at http://localhost:5173
