[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:CurrentStage = 0
$script:TotalStages = 1

function Start-WizardStage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$Name
    )

    $script:CurrentStage += 1
    Clear-Host
    Write-Host "[$($script:CurrentStage)/$($script:TotalStages)] $Name" -ForegroundColor Cyan
    Write-Host ('=' * ($Name.Length + 8))
}

function Write-Step {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$Message
    )

    Write-Host $Message
}

function Open-StepUrl {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidatePattern('^https?://')]
        [string]$Uri
    )

    try {
        Start-Process -FilePath $Uri -ErrorAction Stop
    }
    catch {
        throw "Could not open the browser URL. Open it manually: $Uri. Cause: $($_.Exception.Message)"
    }
}

function Read-PublicValue {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$Prompt
    )

    do {
        $value = Read-Host -Prompt $Prompt
    } while ([string]::IsNullOrWhiteSpace($value))

    return $value
}

function Read-SecretValue {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$Prompt
    )

    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Set-DotEnvValue {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$Path,

        [Parameter(Mandatory)]
        [ValidatePattern('^[A-Z][A-Z0-9_]*$')]
        [string]$Name,

        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string]$Value
    )

    $fullPath = [IO.Path]::GetFullPath($Path)
    $lines = if (Test-Path -LiteralPath $fullPath) {
        [Collections.Generic.List[string]]::new([IO.File]::ReadAllLines($fullPath))
    }
    else {
        [Collections.Generic.List[string]]::new()
    }

    $replacement = "$Name=$Value"
    $pattern = '^' + [regex]::Escape($Name) + '='
    $matchingIndexes = @()
    for ($index = 0; $index -lt $lines.Count; $index += 1) {
        if ($lines[$index] -match $pattern) {
            $matchingIndexes += $index
        }
    }

    if ($matchingIndexes.Count -eq 0) {
        $lines.Add($replacement)
    }
    else {
        $lines[$matchingIndexes[0]] = $replacement
        for ($index = $matchingIndexes.Count - 1; $index -ge 1; $index -= 1) {
            $lines.RemoveAt($matchingIndexes[$index])
        }
    }

    [IO.File]::WriteAllLines($fullPath, $lines, [Text.UTF8Encoding]::new($false))
    Write-Host "Updated $Name in $fullPath" -ForegroundColor Green
}

function Assert-GitHubCli {
    [CmdletBinding()]
    param()

    if (-not (Get-Command -Name 'gh' -ErrorAction SilentlyContinue)) {
        throw 'GitHub CLI (gh) is required but was not found on PATH.'
    }

    & gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'GitHub CLI is not authenticated. Run gh auth login, then rerun the wizard.'
    }
}

function Set-GitHubSecret {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidatePattern('^[A-Z][A-Z0-9_]*$')]
        [string]$Name,

        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string]$Value
    )

    Assert-GitHubCli
    $Value | & gh secret set $Name
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI failed to set secret '$Name'. The secret value was not displayed."
    }
    Write-Host "Updated GitHub secret $Name" -ForegroundColor Green
}

function Set-GitHubVariable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidatePattern('^[A-Z][A-Z0-9_]*$')]
        [string]$Name,

        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string]$Value
    )

    Assert-GitHubCli
    & gh variable set $Name --body $Value
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI failed to set variable '$Name'."
    }
    Write-Host "Updated GitHub variable $Name" -ForegroundColor Green
}

function Confirm-Step {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$Prompt
    )

    $answer = Read-Host -Prompt "$Prompt [y/N]"
    if ($answer -notmatch '^(?i:y|yes)$') {
        throw 'The user declined the confirmation gate. No later wizard stage was run.'
    }
}

function Pause-Step {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$Prompt
    )

    Read-Host -Prompt $Prompt | Out-Null
}

# WIZARD-STAGES: keep the library above this line unchanged.

$script:TotalStages = 6
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot '.env'
if (-not (Test-Path -LiteralPath $environmentPath)) {
    throw "Create $environmentPath from .env.example before running this wizard."
}

Write-Host @'
Run this activation only inside the Operator organization's environment with
its authorized Entra, Exchange, and deployment-secret owners. Do not provide
tenant access, the private key, mailbox content, or the populated .env to the
supplier.
'@ -ForegroundColor Yellow

Start-WizardStage -Name 'Register the single-tenant Entra application'
Open-StepUrl -Uri 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade'
Write-Step -Message @'
In Microsoft Entra admin center select Entra ID > App registrations > New registration.
Create a single-tenant application named Project Maker. Do not add a redirect URI.

Captured public values:
- Directory (tenant) ID -> local .env GRAPH_TENANT_ID
- Application (client) ID -> local .env GRAPH_CLIENT_ID
- Enterprise application service-principal Object ID -> wizard memory only, for Exchange RBAC
'@
$tenantId = Read-PublicValue -Prompt 'Directory (tenant) ID'
$clientId = Read-PublicValue -Prompt 'Application (client) ID'
$servicePrincipalObjectId = Read-PublicValue -Prompt 'Enterprise application service-principal Object ID'
foreach ($identifier in @($tenantId, $clientId, $servicePrincipalObjectId)) {
    if ($identifier -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
        throw 'Tenant, client, and service-principal Object IDs must be GUID values.'
    }
}

Start-WizardStage -Name 'Register the certificate credential'
Open-StepUrl -Uri 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade'
Write-Step -Message @'
Open the Project Maker app registration, then Certificates & secrets > Certificates > Upload certificate.
Upload only the public .cer/.pem/.crt file. Never upload a PFX or another private-key container.

Captured values:
- certificate thumbprint (public operational identifier) -> local .env
- base64-encoded PEM private key (secret) -> requested only immediately before the local .env write
'@
$certificateThumbprint = (Read-PublicValue -Prompt 'Certificate SHA-1 thumbprint (40 hexadecimal characters)').Replace(' ', '')
if ($certificateThumbprint -notmatch '^[0-9a-fA-F]{40}$') {
    throw 'The certificate thumbprint must contain exactly 40 hexadecimal characters.'
}

Start-WizardStage -Name 'Grant send and mailbox-scoped read authority'
Open-StepUrl -Uri 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade'
Confirm-Step -Prompt 'Ready to grant tenant-wide Mail.Send and create the dedicated-mailbox Exchange RBAC assignments?'
Write-Step -Message @"
In the app registration grant Microsoft Graph application permission Mail.Send and tenant-admin consent.
Do not grant organization-wide Mail.Read in Entra. Entra and Exchange grants are additive, so that would defeat mailbox scoping.

In Exchange Online PowerShell, an Exchange/Organization administrator must create the service-principal pointer,
a resource scope selecting only the dedicated mailbox, and an Application Mail.Read role assignment:

New-ServicePrincipal -AppId $clientId -ObjectId $servicePrincipalObjectId -DisplayName 'Project Maker'
New-ManagementScope -Name 'Project Maker dedicated mailbox' -RecipientRestrictionFilter "PrimarySmtpAddress -eq '<dedicated-mailbox>'"
New-ManagementRoleAssignment -App $servicePrincipalObjectId -Role 'Application Mail.Read' -CustomResourceScope 'Project Maker dedicated mailbox'

Verify both the intended mailbox and a different mailbox:
Test-ServicePrincipalAuthorization -Identity $servicePrincipalObjectId -Resource <dedicated-mailbox>
Test-ServicePrincipalAuthorization -Identity $servicePrincipalObjectId -Resource <different-mailbox>

The intended mailbox must show Application Mail.Read in scope; the different mailbox must not.
Propagation can take from 30 minutes to 2 hours. Never compensate by adding unscoped Mail.Read.
"@
Confirm-Step -Prompt 'Has the administrator verified scoped Mail.Read and broad Mail.Send exactly as described?'

Start-WizardStage -Name 'Configure and prove the dedicated mailbox'
Open-StepUrl -Uri 'https://admin.exchange.microsoft.com/#/settings'
Write-Step -Message @'
Select the dedicated organization mailbox used only for Project Maker Customer communication.
The base address and display name are public configuration values written to local .env.
Exchange admin center > Settings > Mail flow must leave plus addressing enabled.
'@
$mailboxName = Read-PublicValue -Prompt 'Dedicated mailbox display name'
$mailboxAddress = (Read-PublicValue -Prompt 'Dedicated mailbox exact @pte.hu address').Trim().ToLowerInvariant()
if ($mailboxAddress -notmatch '^[^@+\s]+@pte\.hu$') {
    throw 'The dedicated mailbox must be one base address at the exact pte.hu domain.'
}
$plusAddress = $mailboxAddress.Replace('@', '+project-maker-provisioning@')
Confirm-Step -Prompt 'Ready to send one controlled provisioning message to the dedicated plus address?'
Write-Step -Message "Send a controlled message to $plusAddress and verify that it arrives in the dedicated mailbox."
Confirm-Step -Prompt 'Did the exact plus-address message arrive in the dedicated mailbox? A no answer stops rollout.'

Start-WizardStage -Name 'Write the approved local runtime configuration'
Write-Step -Message "Public identifiers and the secret private key will now be written only to $environmentPath."
$privateKeyBase64 = Read-SecretValue -Prompt 'Base64-encoded PEM private key (input is hidden)'
try {
    $decodedPrivateKey = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($privateKeyBase64))
} catch {
    throw 'The private key value is not valid base64.'
}
if ($decodedPrivateKey -notmatch '-----BEGIN (?:RSA )?PRIVATE KEY-----') {
    throw 'The decoded value is not a supported PEM private key.'
}
$decodedPrivateKey = $null
Set-DotEnvValue -Path $environmentPath -Name 'GRAPH_TENANT_ID' -Value $tenantId
Set-DotEnvValue -Path $environmentPath -Name 'GRAPH_CLIENT_ID' -Value $clientId
Set-DotEnvValue -Path $environmentPath -Name 'GRAPH_CLIENT_CERTIFICATE_THUMBPRINT' -Value $certificateThumbprint.ToUpperInvariant()
Set-DotEnvValue -Path $environmentPath -Name 'GRAPH_CLIENT_PRIVATE_KEY_BASE64' -Value $privateKeyBase64
Set-DotEnvValue -Path $environmentPath -Name 'CORRESPONDENCE_MAILBOX_NAME' -Value $mailboxName
Set-DotEnvValue -Path $environmentPath -Name 'CORRESPONDENCE_MAILBOX_ADDRESS' -Value $mailboxAddress
$privateKeyBase64 = $null

Start-WizardStage -Name 'Hand off the controlled tenant smoke'
Write-Step -Message @'
The wizard does not send mail or mutate Project Maker data.
Follow docs/microsoft-365-channel.md > Controlled Microsoft 365 tenant smoke.
Use dedicated test mailboxes and the real application, then record only the approved booleans, date, commit, and result in:
docs/evidence/m365-tenant-smoke.json

Run pnpm verify:m365-tenant-smoke afterward. A fake-Graph result is insufficient.
'@
Pause-Step -Prompt 'Press Enter after noting the smoke runbook and evidence path'

Write-Host 'Wizard complete. No tenant smoke was executed.' -ForegroundColor Green
