@echo off
title Khoi dong TSrecord Admin Backend
echo ===================================================
echo   KHOI DONG HE THONG QUAN TRI TSRECORD ADMIN BACKEND
echo ===================================================
echo.

cd /d "%~dp0\admin-backend"

if not exist node_modules (
    echo [INFO] Thu muc node_modules chua ton tai. Dang tu dong cai dat dependencies...
    call npm install
)

echo [INFO] Dang tu dong mo giao dien quan tri tai http://localhost:4000 ...
start "" http://localhost:4000

echo [INFO] Dang bat server backend...
call npm run dev
pause
