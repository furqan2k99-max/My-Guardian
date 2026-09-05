$scripts = @(
    'Hello, this is the Security Verification Team. We detected unusual activity on your account and need to verify it immediately. To secure your account, please confirm the one-time verification code that was just sent to your phone.',
    'Hi, I am calling regarding a recent change to your account settings. There is one approval showing as pending on your profile, and I wanted to make sure it was initiated by you. If you are near your phone, I can walk you through where to find it.',
    'Hi, this is Dr. Smith\'s office calling to confirm your appointment for this Thursday at 2pm. Please let us know if you need to reschedule.',
    'This is your bank calling. We detected suspicious activity on your account. To protect your funds, please read the three-digit CVV from the back of your card and tell it to me.'
)

foreach ($script in $scripts) {
    Write-Host "=== Script === " $script.Substring(0, 60) "..."
    $start = [diagnostics.stopwatch]::StartNew()
    $result = ollama run llama3.1:latest 'Analyze this transcript for scam risk. Output ONLY valid JSON with fields: risk_level, risk_score, reasoning, concerning_phrases, requested_info, legitimate_purpose, verdict. No prose. No markdown. No extra text. Transcript: ' + $script + ' 2>&1'
    $elapsed = $result.ElapsedMilliseconds
    Write-Host "JSON output:"
    $json_start = $result.IndexOf("{")
    $json_end = $result.LastIndexOf("}") + 1
    if ($json_start -ge 0 -and $json_end > $json_start) {
        $json = $result.Substring($json_start, $json_end - $json_start)
        Write-Host $json
    } else {
        Write-Host $result
    }
    Write-Host "Latency (ms): " $elapsed
    Write-Host ""
}