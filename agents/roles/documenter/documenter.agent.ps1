# ------------------------------------------------------------------------------------------------------ #
# Deployment script for the Databricks Notebook Documenter agent.                                        #
# This script handles the deployment of the Databricks Notebook Documenter agent to a local environment. #
# ------------------------------------------------------------------------------------------------------ #

[CmdletBinding()]
param(
	[switch]$SkipReload
)

function Invoke-VSCodeReload {
	try {
		$codeCmd = Get-Command code -ErrorAction SilentlyContinue
		if ($codeCmd) {
			# Best path: ask the running VS Code window to reload.
			Start-Process -FilePath $codeCmd.Source -ArgumentList '--reuse-window', '--command', 'workbench.action.reloadWindow' | Out-Null
			Write-Host "Triggered VS Code reload using 'code --command'." -ForegroundColor Green
			return $true
		}

		# Fallback: use command URI handler when the code CLI is unavailable.
		Start-Process "vscode://command/workbench.action.reloadWindow" | Out-Null
		Write-Host "Triggered VS Code reload using vscode:// command URI." -ForegroundColor Green
		return $true
	}
	catch {
		Write-Host "Unable to trigger VS Code reload automatically: $($_.Exception.Message)" -ForegroundColor Yellow
		return $false
	}
}

function Get-MarkdownFileReferences {
	param(
		[string[]]$MarkdownLines
	)

	$references = New-Object System.Collections.Generic.List[string]
	$linkRegex = [regex]'\[[^\]]+\]\(([^)]+)\)'

	foreach ($line in $MarkdownLines) {
		$matches = $linkRegex.Matches($line)
		foreach ($match in $matches) {
			$linkTarget = $match.Groups[1].Value.Trim()

			if ([string]::IsNullOrWhiteSpace($linkTarget)) {
				continue
			}

			# Skip external and anchor-only links.
			if ($linkTarget -match '^(https?:|mailto:|#)') {
				continue
			}

			# Remove optional markdown title part: path/to/file.md "Title".
			$linkTarget = $linkTarget -replace '\s+"[^"]*"\s*$', ''

			# Remove optional fragment or query from local file links.
			$linkTarget = ($linkTarget -split '#', 2)[0]
			$linkTarget = ($linkTarget -split '\?', 2)[0]

			# Normalize path style for downstream path math.
			$linkTarget = $linkTarget -replace '\\', '/'

			if (-not [string]::IsNullOrWhiteSpace($linkTarget) -and -not $references.Contains($linkTarget)) {
				$references.Add($linkTarget)
			}
		}
	}

	return $references.ToArray()
}

# Get the Windows Username
$WindowsUsername = [System.Environment]::UserName
$TargetRoot = "C:\Users\$WindowsUsername\AppData\Roaming\Code\User\prompts\"

# Show the target deployment path
Write-Host "Target deployment path: $TargetRoot" -ForegroundColor Yellow

# Detertime name of the *.agent.md, based on file content, for the variable named name, open the file search for "name:" the string that follows is the agent name.
$agentMdPath = Get-ChildItem -Path $PSScriptRoot -Filter "*.agent.md" -File | Select-Object -First 1 -ExpandProperty FullName
if (-not $agentMdPath) {
	throw "No *.agent.md file found in $PSScriptRoot"
}
$agentFile = Get-Content -Path $agentMdPath
$agentNameLine = $agentFile | Where-Object { $_ -match "^name:" }
$agentName = $agentNameLine -replace "^name:\s*""", "" -replace """", ""

# clean up existing agent folder if it exists
if (Test-Path -LiteralPath $TargetAgentPath) {
	Remove-Item -LiteralPath $TargetAgentPath -Recurse -Force
}

# create folder with name of agent in target deployment path.
$TargetAgentPath = Join-Path $TargetRoot $agentName
if (-not (Test-Path -LiteralPath $TargetAgentPath)) {
	New-Item -ItemType Directory -Path $TargetAgentPath -Force | Out-Null
}

# copy the agent file to $TargetRoot
$targetAgentMdPath = Join-Path $TargetRoot (Split-Path -Leaf $agentMdPath)
Copy-Item -LiteralPath $agentMdPath -Destination $targetAgentMdPath -Force

# Set the target deployment path to include the agent folder
$TargetRoot = $TargetAgentPath

Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host "Agent name: $agentName" -ForegroundColor Yellow
Write-Host "Agent MD path: $agentMdPath" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow

# Determine list of files referenced in *.agent.md markdown links.
$agentFiles = Get-MarkdownFileReferences -MarkdownLines $agentFile
Write-Host "Detected $($agentFiles.Count) local markdown file reference(s)." -ForegroundColor Yellow

# determine the full paths of the files and folders to be copied
$list_source_ref_files = @()
$list_target_ref_files = @()
	
foreach ($file in $agentFiles) {

	# Set New Source Path of file
	$FileSourcePath = $PSScriptRoot

	# count "..\" in the $file and remove equal number of folders from the $FileSourcePath
	$relativePath = $file
	while ($relativePath -like "../*") {

		$relativePath = $relativePath.Substring(3, $relativePath.Length - 3)
		$FileSourcePath = Split-Path -Parent $FileSourcePath

	}

	# change "/" to "\"
	$relativePath = $relativePath -replace "/", "\"
	
	$source_ref_file = Join-Path $FileSourcePath $relativePath
	$target_ref_file = Join-Path $TargetRoot $relativePath
	Write-Host "Source full path: $source_ref_file" -ForegroundColor Yellow
	#Write-Host "Target full path: $target_ref_file" -ForegroundColor Yellow
	
	$list_source_ref_files += $source_ref_file
	$list_target_ref_files += $target_ref_file
}

# Copy files to $TargetRoot while maintaining folder structure
foreach ($i in 0..($list_source_ref_files.Count - 1)) {
	$sourceFile = $list_source_ref_files[$i]
	$targetFile = $list_target_ref_files[$i]
	Write-Host "Copying $sourceFile to $targetFile" -ForegroundColor Yellow

	$targetFolder = Split-Path -Parent $targetFile
	if ($targetFolder -and -not (Test-Path -LiteralPath $targetFolder)) {
		New-Item -ItemType Directory -Path $targetFolder -Force | Out-Null
	}
	Copy-Item -LiteralPath $sourceFile -Destination $targetFile -Force
}

# Update file content of *.agent.md with
# Add "./$agentName/" to all the filepaths 
# then remove all "../" from the file paths
$agentMdContent = Get-Content -LiteralPath $targetAgentMdPath
$updatedContent = $agentMdContent -replace "\]\((?!\./)", "](./$agentName/"
$updatedContent = $updatedContent -replace "\.\./", ""
Set-Content -LiteralPath $targetAgentMdPath -Value $updatedContent

Write-Host ""
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Yellow
Write-Host "Deployment of agent '$agentName' completed successfully to '$TargetRoot'." -ForegroundColor Green
Write-Host "`nReload VS Code manually (Ctrl+Shift+P -> Developer: Reload Window)." -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Yellow


