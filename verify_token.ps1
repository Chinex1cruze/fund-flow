Param(
    [string]$Token
)

if(-not $Token){
    $Token = Read-Host "Enter token to verify"
}

$usersFile = Join-Path $PSScriptRoot 'data\users.json'
if(-not (Test-Path $usersFile)){
    Write-Error "Users file not found: $usersFile"
    exit 1
}

try{
    $users = Get-Content $usersFile -Raw | ConvertFrom-Json
} catch {
    Write-Error "Failed to read or parse users file."
    exit 1
}

if($users -eq $null){ Write-Error "No users found."; exit 1 }

# Normalize
if($users -is [System.Management.Automation.PSObject] -and ($users.GetType().Name -ne 'Object[]')){ $users = @($users) }

$sha = [Security.Cryptography.SHA256]::Create()
$matched = $null
foreach($u in $users){
    $computed = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Token + $u.salt))
    $computedBase64 = [Convert]::ToBase64String($computed)
    if($computedBase64 -eq $u.tokenHash){
        $matched = $u
        break
    }
}

if($matched){
    Write-Host "Token is valid for user: $($matched.username) (role: $($matched.role))."
    Write-Host "Token created at: $($matched.tokenCreatedAt)"
} else {
    Write-Host "Token not found or invalid."
}
