' Lancia sorveglia-feed.ps1 senza aprire finestre: lo usa l'attività pianificata.
Set fso = CreateObject("Scripting.FileSystemObject")
ps1 = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "sorveglia-feed.ps1")
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -NonInteractive -File """ & ps1 & """", 0, False
