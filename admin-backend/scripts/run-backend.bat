@echo off
setlocal
cd /d "%~dp0.."
echo Starting TSrecord backend on http://localhost:4000 ...
echo Admin panel: http://localhost:4000/
echo.
npm run dev
pause
