# Requires -RunAsAdministrator

$serviceName = "DockerComposeETA"
$nssmPath = "C:\nssm\nssm.exe"  # Adjust path if needed

# Remove the service
& $nssmPath remove $serviceName confirm

Write-Host "Service removed successfully."
