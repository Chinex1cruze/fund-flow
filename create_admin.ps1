Param(
    [string]$UserName = "admin"
)

function Convert-SecureStringToPlain([System.Security.SecureString]$ss){
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
    try{ [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

# Prompt for password
$pwd = Read-Host "Enter password for user '$UserName'" -AsSecureString
$pwdConfirm = Read-Host "Confirm password" -AsSecureString
if((Convert-SecureStringToPlain $pwd) -ne (Convert-SecureStringToPlain $pwdConfirm)){
    Write-Error "Passwords do not match. Aborting."
    exit 1
}
$pwdPlain = Convert-SecureStringToPlain $pwd

# Create salt
$rand = [Security.Cryptography.RandomNumberGenerator]::Create()
$saltBytes = New-Object byte[] 16
$rand.GetBytes($saltBytes)
$salt = [Convert]::ToBase64String($saltBytes)

# Hash the password (SHA-256 with salt) - suitable for local/dev; use a stronger KDF in production
$sha = [Security.Cryptography.SHA256]::Create()
$pwdBytes = [Text.Encoding]::UTF8.GetBytes($pwdPlain + $salt)
$hashBytes = $sha.ComputeHash($pwdBytes)
$pwdHash = [Convert]::ToBase64String($hashBytes)

# Generate a cryptographically-random token (base64url, shown once)
$tokenBytes = New-Object byte[] 32
$rand.GetBytes($tokenBytes)
$rawToken = [Convert]::ToBase64String($tokenBytes)
$token = $rawToken.TrimEnd('=') -replace '\+','-' -replace '/','_'

# Token hash (store this, not the token itself)
$tokenHashBytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($token + $salt))
$tokenHash = [Convert]::ToBase64String($tokenHashBytes)

# Prepare data directory and users file
$dataDir = Join-Path $PSScriptRoot 'data'
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
$usersFile = Join-Path $dataDir 'users.json'

$users = @()
if(Test-Path $usersFile){
    try{
        $raw = Get-Content $usersFile -Raw
        if($raw.Trim().Length -gt 0){
            $users = $raw | ConvertFrom-Json
        }
    } catch {
        Write-Warning "Could not parse existing users file; starting fresh."
        $users = @()
    }
}

if($users -eq $null){ $users = @() }

# Normalize single-object JSON to array
if($users -is [System.Management.Automation.PSObject] -and ($users.GetType().Name -ne 'Object[]')){
    $users = @($users)
}

if($users | Where-Object { $_.username -eq $UserName }){
    Write-Error "User '$UserName' already exists. Aborting to avoid overwrite."
    exit 1
}

$user = [PSCustomObject]@{
    username = $UserName
    passwordHash = $pwdHash
    salt = $salt
    role = "admin"
    tokenHash = $tokenHash
    tokenCreatedAt = (Get-Date).ToString("o")
}

$users += $user
$users | ConvertTo-Json -Depth 10 | Out-File -FilePath $usersFile -Encoding UTF8

Write-Host ""
Write-Host "Admin user '$UserName' created and stored in: $usersFile"
Write-Host "IMPORTANT: The token is shown only once. Copy and store it securely (password manager or clipboard)."
Write-Host ""
Write-Host "TOKEN: $token"
Write-Host ""
Write-Host "Add 'data/' to your .gitignore if you use git to avoid committing secrets."
Write-Host ""