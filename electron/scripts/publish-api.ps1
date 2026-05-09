$ErrorActionPreference = "Stop"
$env:DOTNET_ROLL_FORWARD = "Major"

Push-Location "$PSScriptRoot\..\..\backend\PizzaPos.Api"
try {
    Write-Host "Publishing PizzaPos.Api as self-contained win-x64..."
    dotnet publish -c Release -r win-x64 --self-contained true `
        -p:PublishSingleFile=true `
        -o "$PSScriptRoot\..\resources\api"
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed (exit $LASTEXITCODE)" }
    Write-Host "Publish complete: electron/resources/api"
}
finally {
    Pop-Location
}
