# The stem dumps the analysis scripts read, rebuilt from the song's stems with ffmpeg.
# The originals were typed by hand when the project started and were not kept; these lines are reconstructed from
# what the readers expect (kicks.mjs: mono float32 at 4 kHz, the drum stem also lowpassed at 180 Hz;
# align-ctc.py and whisper: mono 16-bit PCM at 16 kHz). Run from the repository root:
#   powershell -File analysis/dump-stems.ps1 -Stems "C:\path\to\the\stems"
# where the folder holds "OOM.wav" (the mix), "0 Drum Kit.wav", "1 Backing Vocals.wav" and "2 Lead Vocal.wav".
param([Parameter(Mandatory = $true)][string]$Stems)
$A = Split-Path -Parent $MyInvocation.MyCommand.Path
$f32 = @{ "mix" = "OOM.wav"; "drum_low" = "0 Drum Kit.wav"; "backing" = "1 Backing Vocals.wav"; "lead" = "2 Lead Vocal.wav" }
foreach ($k in $f32.Keys) {
    $in = Join-Path $Stems $f32[$k]
    $filter = if ($k -eq "drum_low") { "lowpass=f=180" } else { "anull" }
    ffmpeg -v error -y -i $in -ac 1 -ar 4000 -af $filter -f f32le (Join-Path $A "$k.f32")
}
foreach ($p in @(@("lead", "2 Lead Vocal.wav"), @("backing", "1 Backing Vocals.wav"))) {
    ffmpeg -v error -y -i (Join-Path $Stems $p[1]) -ac 1 -ar 16000 -c:a pcm_s16le (Join-Path $A "whisper\$($p[0])16k.wav")
}
# then, in this folder:  node kicks.mjs  ->  node build-timing.mjs  (writes ../timing.js)
# and, with whisper/words.json in place:  python align-ctc.py  (writes lyrics-aligned.json; tools/prep-assets.py copies it into data/lyrics.js)
