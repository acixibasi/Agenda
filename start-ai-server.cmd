@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%NODE_EXE%" (
  echo Node runtime niet gevonden:
  echo %NODE_EXE%
  echo.
  echo Start anders handmatig met jouw Node-installatie:
  echo node --use-system-ca ai-server.js
  exit /b 1
)

"%NODE_EXE%" --use-system-ca ai-server.js
