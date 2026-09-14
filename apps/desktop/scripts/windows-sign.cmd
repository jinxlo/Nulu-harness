@echo off
setlocal DisableDelayedExpansion
set "signTool=%NULU_DESKTOP_WINDOWS_SIGNTOOL%"
set "certificateFile=%NULU_DESKTOP_WINDOWS_CER_FILE%"
set "tokenPin=%NULU_DESKTOP_WINDOWS_TOKEN_PIN%"
set "keyContainer=%NULU_DESKTOP_WINDOWS_KEY_CONTAINER%"
set "targetFile=%NULU_DESKTOP_WINDOWS_SIGN_TARGET%"
set "appendSignature="
if "%NULU_DESKTOP_WINDOWS_SIGN_APPEND%"=="1" set "appendSignature=/as"
set "NULU_DESKTOP_WINDOWS_SIGNTOOL="
set "NULU_DESKTOP_WINDOWS_CER_FILE="
set "NULU_DESKTOP_WINDOWS_TOKEN_PIN="
set "NULU_DESKTOP_WINDOWS_KEY_CONTAINER="
set "NULU_DESKTOP_WINDOWS_SIGN_TARGET="
set "NULU_DESKTOP_WINDOWS_SIGN_APPEND="
set "signTool=" & set "certificateFile=" & set "tokenPin=" & set "keyContainer=" & set "targetFile=" & set "appendSignature=" & "%signTool%" sign /v /fd sha256 /f "%certificateFile%" /kc "[{{%tokenPin%}}]=%keyContainer%" /csp "eToken Base Cryptographic Provider" %appendSignature% /tr http://timestamp.digicert.com /td sha256 "%targetFile%"
exit /b %errorlevel%
