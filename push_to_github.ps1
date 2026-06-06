param (
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken,
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

Write-Host "Initializing Git..."
git init
git add .
git commit -m "Initial commit - Daily Card iOS ready"

Write-Host "Creating GitHub repository..."
$headers = @{
    "Authorization" = "token $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
}
$body = @{
    "name" = $RepoName
    "private" = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body $body
    $cloneUrl = $response.clone_url
    Write-Host "Successfully created repository: $cloneUrl"

    Write-Host "Pushing to GitHub..."
    git remote add origin $cloneUrl
    git branch -M main
    git push -u origin main
    
    Write-Host "Done! The GitHub Actions workflow will now start building the iOS app."
    Write-Host "Please remember to add your Apple Developer secrets to the repository settings."
} catch {
    Write-Host "Failed to create repository. Check your token and repository name."
    Write-Host $_.Exception.Message
}
