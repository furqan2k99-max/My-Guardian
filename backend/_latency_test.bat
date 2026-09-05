@echo off
setlocal enabledelayedexpansion

echo Script A:
for /f "tokens=" %%a in ('powershell -Command "Get-Date -Format %s%N"') do set start_ts=%%a
set "resultA="
set "latencyA="
call :run_ollama "Hello, this is the Security Verification Team. We detected unusual activity on your account and need to verify it immediately. To secure your account, please confirm the one-time verification code that was just sent to your phone."
set /a end_ts=!start_ts! - !start_ts!
echo Latency for A: !latencyA!ms
echo Result A: !resultA%
echo.

echo Script B:
for /f "tokens=" %%a in ('powershell -Command "Get-Date -Format %s%N"') do set start_ts=%%a
call :run_ollama "Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it."
echo Latency for B: !latencyA!ms
echo.

echo Script C:
for /f "tokens=" %%a in ('powershell -Command "Get-Date -Format %s%N"') do set start_ts=%%a
call :run_ollama "Hi, this is Dr. Smith's office calling to confirm your appointment for this Thursday at 2pm. Please let us know if you need to reschedule."
echo Latency for C: !latencyA!ms
echo.

echo Script D:
for /f "tokens=" %%a in ('powershell -Command "Get-Date -Format %s%N"') do set start_ts=%%a
call :run_ollama "This is your bank calling. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me."
echo Latency for D: !latencyA!ms
echo.

goto :eof

:run_ollama
set "prompt=Analyze this transcript for scam risk. Output ONLY valid JSON with fields: risk_level, risk_score, reasoning, concerning_phrases, requested_info, legitimate_purpose, verdict. No prose. No markdown. No extra text. Transcript: %~1"
for /f "tokens=" %%a in ('powershell -Command "Write-Output (Get-Date -Format %s%N)"') do set start_ts=%%a
set "result_raw="
set "result_raw="
rem Call ollama - this will take a while
powershell -Command "ollama run llama3.1:latest %prompt%" >nul 2>&1
rem Actually capture the output properly
for /f "usebackq tokens=" %%a in (`powershell -Command "ollama run llama3.1:latest %prompt%" 2^&1`) do set "result_raw=%%a"
set /a end_ts=!start_ts! - !start_ts!
set "latencyA=%latency_ms%"
echo Result: !result_raw:~0,200!
goto :eof