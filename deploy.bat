@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0" || exit /b 1
set "GIT=C:\tool\Git\cmd\git.exe"
if not defined BLOG_GIT_PROXY set "BLOG_GIT_PROXY=http://127.0.0.1:7892"

"%GIT%" add -A
if errorlevel 1 (
    echo.
    echo ERROR: git add failed.
    pause
    exit /b 1
)

"%GIT%" diff --cached --quiet
if errorlevel 2 (
    echo.
    echo ERROR: could not check staged changes.
    pause
    exit /b 1
)
if errorlevel 1 (
    if "%~1"=="" (
        "%GIT%" -c user.name=chinaz-max -c user.email=3034772563@qq.com commit -m "deploy: update blog"
    ) else (
        "%GIT%" -c user.name=chinaz-max -c user.email=3034772563@qq.com commit -m "%*"
    )
    if errorlevel 1 (
        echo.
        echo ERROR: git commit failed.
        pause
        exit /b 1
    )
)

echo Pushing with Git Credential Manager. Paste your Token if requested; it will be saved securely.
"%GIT%" -c credential.gitHubAuthModes=pat -c credential.guiPrompt=false -c http.proxy="%BLOG_GIT_PROXY%" -c https.proxy="%BLOG_GIT_PROXY%" push origin main
if errorlevel 1 (
    echo.
    echo ERROR: git push failed. Check the error above and proxy %BLOG_GIT_PROXY%.
    pause
    exit /b 1
)

echo.
echo Done! Wait a few minutes and refresh your site.
echo.
pause
