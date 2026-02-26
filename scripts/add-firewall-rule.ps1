# Add Windows Firewall rule for Tiny Remote (inbound TCP on port 8765).
# Run once during install (e.g. from Inno Setup). Requires admin for firewall.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/add-firewall-rule.ps1 [port]

param([int]$Port = 8765)

$ruleName = "Tiny Remote"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Remove-NetFirewallRule -DisplayName $ruleName
}
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private, Domain
Write-Host "Firewall rule added: $ruleName (TCP $Port)"
