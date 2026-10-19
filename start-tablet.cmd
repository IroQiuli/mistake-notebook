@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   错题簿 - 平板/手机局域网访问
echo ============================================
echo.

if not exist node_modules (
  echo [1/3] 首次运行，安装依赖...
  call npm install
) else (
  echo [1/3] 依赖已就绪
)

echo [2/3] 构建...
call npm run build
if errorlevel 1 (
  echo 构建失败，按任意键退出
  pause >nul
  exit /b 1
)

echo.
echo 本机局域网地址（平板用这个）：
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=1" %%b in ("%%a") do echo    http://%%b:5199
)
echo.
echo 保持此窗口开着，平板浏览器打开上面的地址。
echo 关闭窗口即停止服务。
echo.

echo [3/3] 启动服务...
npx vite preview --host 0.0.0.0 --port 5199 --strictPort
pause
