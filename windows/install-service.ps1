# Requires -RunAsAdministrator

$serviceName = "DockerComposeETA"
$serviceDisplayName = "Docker Compose ETA Weather Service"
$serviceDescription = "Manages Docker Compose for ETA Weather Application"
$workingDirectory = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Create a new service using nssm
$nssmPath = "C:\nssm\nssm.exe"  # Adjust path if needed
$dockerComposePath = "docker-compose"

# Install the service
& $nssmPath install $serviceName $dockerComposePath
& $nssmPath set $serviceName AppDirectory $workingDirectory
& $nssmPath set $serviceName AppParameters "up"
& $nssmPath set $serviceName DisplayName $serviceDisplayName
& $nssmPath set $serviceName Description $serviceDescription
& $nssmPath set $serviceName Start SERVICE_AUTO_START
& $nssmPath set $serviceName ObjectName LocalSystem
& $nssmPath set $serviceName AppStopMethodConsole 3000

Write-Host "Service installed successfully. You can start it using 'Start-Service $serviceName'"
