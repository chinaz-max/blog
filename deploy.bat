@echo off
chcp 65001 >nul
cd /d "C:\Users\primer\Desktop\blog"

C:\tool\Git\cmd\git.exe add -A

if "%1"=="" (
    C:\tool\Git\cmd\git.exe -c user.name=chinaz-max -c user.email=3034772563@qq.com -c http.proxy= commit -m "deploy: update blog"
) else (
    C:\tool\Git\cmd\git.exe -c user.name=chinaz-max -c user.email=3034772563@qq.com -c http.proxy= commit -m "%*"
)

C:\tool\Git\cmd\git.exe -c http.proxy= push origin main

echo.
echo Done! Wait a few minutes and refresh your site.
echo.
pause
