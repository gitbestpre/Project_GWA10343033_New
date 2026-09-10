@echo off
chcp 65001
echo ====================================
echo   启动前端开发服务器
echo ====================================
echo.

cd /d "%~dp0frontend"

echo 检查 node_modules...
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    call npm install
    echo.
)

echo 启动开发服务器...
echo 服务器将在 http://localhost:5173 启动
echo 按 Ctrl+C 可以停止服务器
echo.

call npm run dev

pause
