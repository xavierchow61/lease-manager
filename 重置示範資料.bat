@echo off
chcp 65001 >nul
title 重置示範資料
cd /d "%~dp0"

echo 此動作會清空資料庫並重新載入示範資料。
set /p ok="確定要重置嗎？(Y/N) "
if /i not "%ok%"=="Y" (
  echo 已取消。
  pause
  exit /b
)
call npm run db:seed
echo.
echo 完成！示範帳號：
echo   業主 owner@demo.com / demo1234
echo   租客 tenant@demo.com（或 T001）/ demo1234
pause
