# Script to remove REST API fallback code from Server SDK files
# This removes all the old REST API implementations, keeping only SDK code

Write-Host "Starting REST API code cleanup..." -ForegroundColor Green

# Backup files first
$files = @(
    "src\services\ordersApi.js",
    "src\services\tokensApi.js",
    "src\services\subscriptionApi.js"
)

Write-Host "`nCreating backups..." -ForegroundColor Yellow
foreach ($file in $files) {
    if (Test-Path $file) {
        Copy-Item $file "$file.backup"
        Write-Host "  ✓ Backed up $file" -ForegroundColor Gray
    }
}

Write-Host "`nFiles backed up with .backup extension" -ForegroundColor Green
Write-Host "You can restore them with: Move-Item *.backup -Destination . -Force" -ForegroundColor Gray

Write-Host "`nNow use VS Code to manually remove:" -ForegroundColor Yellow
Write-Host "1. Remove 'const USE_SERVER_SDK = true;' lines" -ForegroundColor White
Write-Host "2. In each function, keep only the 'if (USE_SERVER_SDK) { ... }' code" -ForegroundColor White
Write-Host "3. Remove all 'else { ... }' REST API blocks" -ForegroundColor White
Write-Host "4. Remove the if/else wrapper, keeping only SDK code" -ForegroundColor White
Write-Host "5. Clean up unused imports (fetch, generateAccessToken if not used elsewhere)" -ForegroundColor White

Write-Host "`nPress Enter when ready to see the file locations..." -ForegroundColor Cyan
Read-Host

# Open files in VS Code for manual editing
code "src\services\ordersApi.js"
code "src\services\tokensApi.js"
code "src\services\subscriptionApi.js"

Write-Host "`nFiles opened in VS Code for cleanup." -ForegroundColor Green
