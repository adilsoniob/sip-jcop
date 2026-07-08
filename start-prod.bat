@echo off
echo ========================================
echo  JCopSIP - Producao
echo ========================================
echo.
set NODE_ENV=production
cd backend
node src/index.js
pause
