# SORVEGLIA pubblica-feed.mjs — la sera del voto, da un'attività pianificata di Windows.
#
# Lo script del feed gira in un terminale dell'app di Claude: se l'app si chiude o si riavvia,
# lo script muore senza dire niente (la notte del 27 ottobre è successo due volte, e la seconda
# i lettori sono rimasti fermi sette ore). Questo controllo gira fuori dall'app, ogni due minuti,
# e manda una notifica di Windows se:
#   - nessun processo node sta eseguendo pubblica-feed.mjs;
#   - in Download c'è un expc/expb scaricato da più di 5 minuti e mai pubblicato.
#
# Si attiva e si toglie con:
#   powershell -File strumenti\sorveglia-feed.ps1 -Installa
#   powershell -File strumenti\sorveglia-feed.ps1 -Rimuovi
# L'attività si chiama «Sorveglia feed Israele» e parte da strumenti\sorveglia-feed.vbs, che
# lancia questo script senza aprire finestre.
param([switch]$Installa, [switch]$Rimuovi, [switch]$Prova)

$NOME = 'Sorveglia feed Israele'

if ($Installa) {
  $vbs = Join-Path $PSScriptRoot 'sorveglia-feed.vbs'
  $azione = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + $vbs + '"')
  $quando = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration ([datetime]'2026-11-05' - (Get-Date))
  $imp = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $NOME -Action $azione -Trigger $quando -Settings $imp -Description 'Avvisa se strumenti/pubblica-feed.mjs (risultati-israele) si ferma' -Force | Out-Null
  Write-Host "Attività «$NOME» registrata: controlla ogni 2 minuti fino al 5 novembre."
  exit 0
}
if ($Rimuovi) {
  Unregister-ScheduledTask -TaskName $NOME -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Attività «$NOME» rimossa."
  exit 0
}

function Notifica([string]$titolo, [string]$testo) {
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
  $x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
  $t = $x.GetElementsByTagName('text')
  $t.Item(0).AppendChild($x.CreateTextNode($titolo)) > $null
  $t.Item(1).AppendChild($x.CreateTextNode($testo)) > $null
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))
}

if ($Prova) { Notifica 'Feed Israele: prova' 'Le notifiche del controllo arrivano.'; exit 0 }

# dal 5 novembre lo script del feed si ferma da solo: niente più avvisi
if ((Get-Date) -ge [datetime]'2026-11-05') { exit 0 }

$vivo = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'pubblica-feed\.mjs' }
if (-not $vivo) {
  Notifica 'Feed Israele FERMO' 'pubblica-feed.mjs non gira: i lettori non ricevono più i voti. Riavvialo dalla cartella del progetto.'
  exit 0
}

$dl = Join-Path $env:USERPROFILE 'Downloads'
$vecchi = Get-ChildItem -Path $dl -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^(expc|expb) ?(\(\d+\))?\.csv$' -and $_.LastWriteTime -lt (Get-Date).AddMinutes(-5) }
if ($vecchi) {
  $n = @($vecchi).Count
  Notifica 'Feed Israele bloccato' "$n file in Download da più di 5 minuti non sono stati pubblicati: guarda il terminale dello script."
}
