@echo off
echo Stopping existing Node.js processes...
taskkill /F /IM node.exe >nul 2>nul

echo Cleaning Next.js cache...
if exist .next rmdir /s /q .next

echo Starting AI Photo Cleaner dev server...
npm run dev

pause
