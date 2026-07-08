@echo off
title JCopSIP - Abrir Versao Nova
color 0B

echo ========================================
echo    JCopSIP - Abrir Versao Nova
echo ========================================
echo.
echo Abrindo a versao mais recente do JCopSIP...
echo.

:: Tenta abrir no Chrome em modo anonimo (sem cache)
start "" "chrome.exe" --incognito "https://sip-jcop-production.up.railway.app" 2>nul

if %ERRORLEVEL% NEQ 0 (
  :: Se Chrome nao encontrado, tenta Edge
  start "" "msedge.exe" --inprivate "https://sip-jcop-production.up.railway.app" 2>nul
  
  if %ERRORLEVEL% NEQ 0 (
    :: Se nada funcionar, abre no navegador padrao
    start "" "https://sip-jcop-production.up.railway.app?v=%RANDOM%"
  )
)

echo ========================================
echo   Site aberto! Se ainda estiver vendo
echo   a versao antiga, pressione Ctrl+F5
echo   para limpar o cache.
echo ========================================
echo.
echo   URL: https://sip-jcop-production.up.railway.app
echo.
echo   Login: admin / admin123
echo.
echo   Aba "Minhas SIPs" para gerenciar
echo.
pause
