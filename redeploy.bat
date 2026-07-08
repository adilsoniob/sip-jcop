@echo off
title JCopSIP - Redeploy Automático
color 0B

echo ========================================
echo    JCopSIP - Redeploy Automatico
echo ========================================
echo.

:: Step 1: Build frontend
echo [1/5] Buildando frontend...
cd /d "%~dp0"
cd frontend
call npm run build 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha ao buildar frontend!
    pause
    exit /b 1
)
echo [OK] Frontend buildado com sucesso!
echo.

:: Step 2: Git add
echo [2/5] Adicionando arquivos ao Git...
cd /d "%~dp0"
git add -A
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha ao adicionar arquivos!
    pause
    exit /b 1
)
echo [OK] Arquivos adicionados!
echo.

:: Step 3: Git commit
echo [3/5] Criando commit...
cd /d "%~dp0"
git commit -m "JCopSIP v2 - %DATE% %TIME%"
if %ERRORLEVEL% neq 0 (
    echo [AVISO] Nada novo para commitar (ou erro no commit)
    echo Continuando mesmo assim...
) else (
    echo [OK] Commit criado com sucesso!
)
echo.

:: Step 4: Git Push para GitHub
echo [4/5] Enviando para o GitHub...
cd /d "%~dp0"
git push origin main
if %ERRORLEVEL% neq 0 (
    echo [AVISO] Falha ao enviar para GitHub (verifique sua internet/login)
    echo Continuando com deploy Railway mesmo assim...
) else (
    echo [OK] Codigo enviado para GitHub com sucesso!
)
echo.

:: Step 5: Railway deploy
echo [5/5] Fazendo deploy no Railway...
cd /d "%~dp0"
railway up
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha no deploy do Railway!
    pause
    exit /b 1
)
echo [OK] Deploy realizado com sucesso!
echo.

echo ========================================
echo   Redeploy concluido!
echo   GitHub: https://github.com/adilsoniob/sip-jcop
echo   Site:   https://sip-jcop.edgeone.run
echo ========================================
echo.
pause
