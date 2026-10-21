$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
(Get-Counter '\Processor Information(*)\% Processor Time' -SampleInterval 1 -MaxSamples 1).CounterSamples |
  Where-Object { $_.InstanceName -match '^\d+,\d+$' } |
  ForEach-Object { '{0}:{1}' -f $_.InstanceName, $_.CookedValue.ToString('F1', [Globalization.CultureInfo]::InvariantCulture) }
