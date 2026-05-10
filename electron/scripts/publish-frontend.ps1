$ErrorActionPreference = "Stop"

$frontendDir = Resolve-Path "$PSScriptRoot\..\..\frontend"
$outDir = Join-Path "$PSScriptRoot\.." "resources\frontend"

Push-Location $frontendDir
try {
    Write-Host "Installing frontend dependencies (if missing)..."
    if (-not (Test-Path "node_modules")) {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" }
    }

    Write-Host "Building Next.js standalone..."
    # Cloud build env yok — runtime detection (lib/env.ts) localhost'ta
    # http://localhost:5000'i kullanır. Ek env gerekmiyor.
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "next build failed (exit $LASTEXITCODE)" }

    Write-Host "Cleaning previous frontend resources..."
    if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null

    Write-Host "Copying standalone server..."
    Copy-Item -Recurse -Force ".next\standalone\*" $outDir

    Write-Host "Copying static assets..."
    $standaloneNextStatic = Join-Path $outDir ".next\static"
    New-Item -ItemType Directory -Force -Path $standaloneNextStatic | Out-Null
    Copy-Item -Recurse -Force ".next\static\*" $standaloneNextStatic

    if (Test-Path "public") {
        Write-Host "Copying public/..."
        $publicOut = Join-Path $outDir "public"
        New-Item -ItemType Directory -Force -Path $publicOut | Out-Null
        Copy-Item -Recurse -Force "public\*" $publicOut
    }

    Write-Host "Frontend publish complete: $outDir"
}
finally {
    Pop-Location
}
