@echo off
chcp 65001 >nul
title 物業管理系統 Pro
cd /d "%~dp0"

echo ============================================
echo    物業管理系統 Pro - 啟動中...
echo ============================================
echo.

REM 首次執行：自動安裝相依套件與建立資料庫
if not exist "node_modules" (
  echo [首次啟動] 安裝相依套件中，請稍候 1-3 分鐘...
  call npm install
  echo [首次啟動] 建立資料庫與示範資料...
  call npm run setup
)

REM 若資料庫不存在也先建立
if not exist "prisma\dev.db" (
  echo [初始化] 建立資料庫與示範資料...
  call npm run setup
)

echo.
echo 系統即將啟動，瀏覽器會自動開啟 http://localhost:3001
echo （首次開啟可能需等待數秒編譯，請稍候）
echo 要關閉系統，直接關閉這個視窗即可。
echo.

REM 5 秒後自動開啟瀏覽器
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3001"

REM 啟動開發伺服器（佔用此視窗）
call npm run dev
pause
