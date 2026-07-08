@echo off
echo ========================================
echo  JCopSIP - Desenvolvimento
echo ========================================
echo.
echo Iniciando servidores...
echo.

start "JCopSIP-Backend" cmd /c "cd backend && npm run dev"
start "JCopSIP-Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Pressione qualquer tecla para parar ambos
pause >nul
taskkill /f /fi "WINDOWTITLE eq JCopSIP-Backend*" 2>nul
taskkill /f /fi "WINDOWTITLE eq JCopSIP-Frontend*" 2>nul
