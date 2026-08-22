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

$script:TotalStages = 4
$repositoryDirectory = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryDirectory '.env'

Start-WizardStage -Name 'Confirm the local destination'
Write-Step -Message "This wizard writes only to $environmentPath."
Write-Step -Message 'Have the Operator organization mail administrator provide the dedicated mailbox and gateway values.'
Confirm-Step -Prompt 'Continue and update the local .env file'

Start-WizardStage -Name 'Capture public gateway values'
$mailboxName = Read-PublicValue -Prompt 'Dedicated correspondence mailbox display name'
$mailboxAddress = Read-PublicValue -Prompt 'Dedicated correspondence mailbox address'
$smtpHost = Read-PublicValue -Prompt 'SMTP host'
$smtpPort = Read-PublicValue -Prompt 'SMTP port'
$smtpSecurity = Read-PublicValue -Prompt 'SMTP security (STARTTLS_REQUIRED or IMPLICIT_TLS)'
$smtpUsername = Read-PublicValue -Prompt 'SMTP username'
$imapHost = Read-PublicValue -Prompt 'IMAP host'
$imapPort = Read-PublicValue -Prompt 'IMAP port'
$imapSecurity = Read-PublicValue -Prompt 'IMAP security (STARTTLS_REQUIRED or IMPLICIT_TLS)'
$imapUsername = Read-PublicValue -Prompt 'IMAP username'
$imapFolder = Read-PublicValue -Prompt 'IMAP folder (usually INBOX)'

if ($smtpSecurity -notin @('STARTTLS_REQUIRED', 'IMPLICIT_TLS')) {
    throw 'SMTP security must be STARTTLS_REQUIRED or IMPLICIT_TLS.'
}
if ($imapSecurity -notin @('STARTTLS_REQUIRED', 'IMPLICIT_TLS')) {
    throw 'IMAP security must be STARTTLS_REQUIRED or IMPLICIT_TLS.'
}

Start-WizardStage -Name 'Capture secrets without displaying them'
$smtpPassword = Read-SecretValue -Prompt 'SMTP password'
$imapPassword = Read-SecretValue -Prompt 'IMAP password'
$customCaAnswer = Read-PublicValue -Prompt 'Does this gateway require a private CA certificate? (yes/no)'
$tlsCaCertificateBase64 = if ($customCaAnswer -match '^(?i:y|yes)$') {
    Read-SecretValue -Prompt 'Base64-encoded PEM CA certificate'
}
else {
    ''
}

Start-WizardStage -Name 'Write the approved local configuration'
$values = [ordered]@{
    CORRESPONDENCE_MAILBOX_NAME = $mailboxName
    CORRESPONDENCE_MAILBOX_ADDRESS = $mailboxAddress
    MAIL_GATEWAY_SMTP_HOST = $smtpHost
    MAIL_GATEWAY_SMTP_PORT = $smtpPort
    MAIL_GATEWAY_SMTP_SECURITY = $smtpSecurity
    MAIL_GATEWAY_SMTP_USERNAME = $smtpUsername
    MAIL_GATEWAY_SMTP_PASSWORD = $smtpPassword
    MAIL_GATEWAY_IMAP_HOST = $imapHost
    MAIL_GATEWAY_IMAP_PORT = $imapPort
    MAIL_GATEWAY_IMAP_SECURITY = $imapSecurity
    MAIL_GATEWAY_IMAP_USERNAME = $imapUsername
    MAIL_GATEWAY_IMAP_PASSWORD = $imapPassword
    MAIL_GATEWAY_IMAP_FOLDER = $imapFolder
    MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64 = $tlsCaCertificateBase64
}
foreach ($entry in $values.GetEnumerator()) {
    Set-DotEnvValue -Path $environmentPath -Name $entry.Key -Value $entry.Value
}
$smtpPassword = $null
$imapPassword = $null
$tlsCaCertificateBase64 = $null
Write-Step -Message 'The local configuration is ready for the documented SMTP/IMAP activation checks.'
Pause-Step -Prompt 'Press Enter to finish'

Write-Host 'Wizard complete.' -ForegroundColor Green
