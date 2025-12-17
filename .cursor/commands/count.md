# Count Lines Command

This command counts the total number of lines in all files in the project.

## Usage

Run this command to count lines across the entire project:

```powershell
Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\\.(git|cursor|node_modules)' } | Get-Content | Measure-Object -Line | Select-Object -ExpandProperty Lines
```

## Alternative: Count lines per file type

To see a breakdown by file type:

```powershell
Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\\.(git|cursor|node_modules)' } | Group-Object Extension | ForEach-Object { 
    $lines = ($_.Group | Get-Content | Measure-Object -Line).Lines
    [PSCustomObject]@{ Extension = $_.Name; Lines = $lines }
} | Format-Table -AutoSize
```

## Simple one-liner

```powershell
(Get-ChildItem -Recurse -File -Exclude .git*,node_modules* | Get-Content | Measure-Object -Line).Lines
```

