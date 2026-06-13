@echo off
setlocal
cd /d "%~dp0.."
echo Issuing pending e-invoices...
npm run einvoice:issue
echo.
pause
