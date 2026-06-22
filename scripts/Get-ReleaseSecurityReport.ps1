param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath
)

$resolvedPath = Resolve-Path -LiteralPath $InstallerPath
$signature = Get-AuthenticodeSignature -FilePath $resolvedPath
$hash = Get-FileHash -Algorithm SHA256 -Path $resolvedPath

[PSCustomObject]@{
  Path = $resolvedPath.Path
  AuthenticodeStatus = $signature.Status
  Signer = $signature.SignerCertificate.Subject
  Sha256 = $hash.Hash
}
