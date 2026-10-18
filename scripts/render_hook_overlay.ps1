param (
    [string]$projectJsonPath,
    [string]$outputPath
)

Add-Type -AssemblyName PresentationCore,PresentationFramework,WindowsBase,System.Drawing

if (![System.IO.File]::Exists($projectJsonPath)) {
    Write-Error "project.json not found at $projectJsonPath"
    exit 1
}

$projJson = [System.IO.File]::ReadAllText($projectJsonPath)
$project = ConvertFrom-Json $projJson

if (!$project.introHook -or !$project.introHook.enabled -or !$project.introHook.text) {
    Write-Output "Intro hook not enabled or text empty."
    exit 0
}

$hook = $project.introHook
$canvasW = if ($project.canvas.width) { [double]$project.canvas.width } else { 1080.0 }
$scale = $canvasW / 1080.0

# Sizing
$rawFontSize = if ($hook.fontSize) { [double]$hook.fontSize } else { 48.0 }
$fontSize = [Math]::Round($rawFontSize * 2.35 * $scale)
$rawOutline = if ($hook.outlineWidth) { [double]$hook.outlineWidth } else { 5.0 }
$outlineWidth = [Math]::Max(4.0, [Math]::Round($rawOutline * 1.8 * $scale))
$shadowOffset = [Math]::Max(3.0, [Math]::Round(4.0 * $scale))

# Colors
function HexToColor($hex, $defaultColor) {
    if (!$hex) { return $defaultColor }
    $clean = $hex.Replace('#', '').Trim()
    if ($clean.Length -eq 3) {
        $clean = ($clean.ToCharArray() | ForEach-Object { "$_$_" }) -join ''
    }
    if ($clean.Length -eq 6) {
        $r = [Convert]::ToByte($clean.Substring(0, 2), 16)
        $g = [Convert]::ToByte($clean.Substring(2, 2), 16)
        $b = [Convert]::ToByte($clean.Substring(4, 2), 16)
        return [System.Windows.Media.Color]::FromArgb(255, $r, $g, $b)
    }
    return $defaultColor
}

$textColor = HexToColor $hook.color ([System.Windows.Media.Colors]::White)
$highlightColor = HexToColor $hook.highlightColor ([System.Windows.Media.Color]::FromArgb(255, 251, 255, 0))
$outlineColor = HexToColor $hook.outlineColor ([System.Windows.Media.Colors]::Black)
$outlineBrush = [System.Windows.Media.SolidColorBrush]::new($outlineColor)
$outlinePen = [System.Windows.Media.Pen]::new($outlineBrush, $outlineWidth)
$outlinePen.LineJoin = [System.Windows.Media.PenLineJoin]::Round

# Font
$fontsDir = (Resolve-Path 'assets/fonts').Path
$montserratPath = "$fontsDir\Montserrat-Black.ttf"
$montserratUri = [System.Uri]::new($montserratPath)
$fontFamily = [System.Windows.Media.FontFamily]::new($montserratUri, '#Montserrat Black')
$typeface = [System.Windows.Media.Typeface]::new($fontFamily, [System.Windows.FontStyles]::Normal, [System.Windows.FontWeights]::Black, [System.Windows.FontStretches]::Normal)

# Emoji resolution helper
$emojisDir = (Resolve-Path 'assets/emojis').Path
if (![System.IO.Directory]::Exists($emojisDir)) {
    [System.IO.Directory]::CreateDirectory($emojisDir) | Out-Null
}

function GetEmojiImage($emojiChar) {
    $cp = [char]::ConvertToUtf32($emojiChar, 0)
    $hexCp = "{0:x}" -f $cp
    $pngPath = "$emojisDir\$hexCp.png"
    if ([System.IO.File]::Exists($pngPath)) {
        return [System.Windows.Media.Imaging.BitmapImage]::new([System.Uri]::new($pngPath))
    }
    # Check fallback names
    if ($emojiChar -eq '🦇' -and [System.IO.File]::Exists("$emojisDir\bat.png")) {
        return [System.Windows.Media.Imaging.BitmapImage]::new([System.Uri]::new("$emojisDir\bat.png"))
    }
    return $null
}

# Line formatting
$rawText = $hook.text -replace '\\n', "`n"
$wordsPerLine = if ($hook.wordsPerLine -ne $null) { [int]$hook.wordsPerLine } else { -1 }

$lines = @()
if ($rawText.Contains("`n")) {
    $lines = $rawText -split "`n" | Where-Object { $_.Trim().Length -gt 0 }
} elseif ($wordsPerLine -gt 0) {
    $words = $rawText -split '\s+' | Where-Object { $_.Trim().Length -gt 0 }
    for ($i = 0; $i -lt $words.Count; $i += $wordsPerLine) {
        $count = [Math]::Min($wordsPerLine, $words.Count - $i)
        $lines += ($words[$i..($i + $count - 1)] -join ' ')
    }
} else {
    $lines = @($rawText.Trim())
}

# Parse each line into segments (Text or Emoji, with highlight flag)
$parsedLines = @()
foreach ($line in $lines) {
    $segments = @()
    # Match surrogate pairs (emojis) or standard text
    $emojiPattern = "([\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])"
    $pattern = "((?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])+|[^\uD800-\uDBFF\u2600-\u27BF]+)"
    $matches = [regex]::Matches($line, $pattern)
    foreach ($m in $matches) {
        $val = $m.Value
        if ([regex]::IsMatch($val, $emojiPattern)) {
            $segments += @{ type = 'emoji'; value = $val }
        } else {
            # Check for asterisk highlights: *word*
            if ($val.Contains('*')) {
                $parts = $val.Split('*')
                for ($p = 0; $p -lt $parts.Length; $p++) {
                    if ($parts[$p].Length -gt 0) {
                        $isHigh = ($p % 2 -eq 1)
                        $segments += @{ type = 'text'; value = $parts[$p].ToUpper(); isHighlight = $isHigh }
                    }
                }
            } else {
                $segments += @{ type = 'text'; value = $val.ToUpper(); isHighlight = $false }
            }
        }
    }
    $parsedLines += ,$segments
}

# Measure layout
$lineMetrics = @()
$maxLineWidth = 0.0
$lineHeight = $fontSize * 1.25

foreach ($segs in $parsedLines) {
    $measuredSegs = @()
    $currentLineW = 0.0
    foreach ($seg in $segs) {
        if ($seg.type -eq 'text') {
            $ft = [System.Windows.Media.FormattedText]::new(
                $seg.value,
                [System.Globalization.CultureInfo]::InvariantCulture,
                [System.Windows.FlowDirection]::LeftToRight,
                $typeface,
                $fontSize,
                [System.Windows.Media.Brushes]::Transparent,
                1.0
            )
            $w = $ft.WidthIncludingTrailingWhitespace
            $geom = $ft.BuildGeometry([System.Windows.Point]::new(0, 0))
            $measuredSegs += @{
                type = 'text';
                width = $w;
                geometry = $geom;
                isHighlight = $seg.isHighlight;
            }
            $currentLineW += $w
        } else {
            # Emoji
            $emojiImg = GetEmojiImage $seg.value
            $emojiW = $fontSize * 1.05
            $measuredSegs += @{
                type = 'emoji';
                width = $emojiW;
                image = $emojiImg;
                value = $seg.value;
            }
            $currentLineW += $emojiW
        }
    }
    if ($currentLineW -gt $maxLineWidth) { $maxLineWidth = $currentLineW }
    $lineMetrics += @{ width = $currentLineW; segments = $measuredSegs }
}

$totalHeight = [Math]::Max(200.0, [Math]::Ceiling($lineMetrics.Count * $lineHeight + 60.0))
$canvasH = [int]$totalHeight

# Render to DrawingVisual
$visual = [System.Windows.Media.DrawingVisual]::new()
$dc = $visual.RenderOpen()

$currentY = 20.0

$centerNormX = if ($hook.positionX -ne $null) { [double]$hook.positionX } else { 0.5 }

foreach ($lm in $lineMetrics) {
    $startX = ($canvasW * $centerNormX) - ($lm.width / 2.0)
    $curX = $startX

    foreach ($seg in $lm.segments) {
        if ($seg.type -eq 'text') {
            $geom = $seg.geometry
            $fillColor = if ($seg.isHighlight) { $highlightColor } else { $textColor }
            
            # Position transform
            $trans = [System.Windows.Media.TranslateTransform]::new($curX, $currentY)
            $geomTrans = $geom.Clone()
            $geomTrans.Transform = $trans

            # Drop shadow
            $shadowTrans = $geom.Clone()
            $shadowTrans.Transform = [System.Windows.Media.TranslateTransform]::new($curX + $shadowOffset, $currentY + $shadowOffset)
            $shadowBrush = [System.Windows.Media.SolidColorBrush]::new([System.Windows.Media.Color]::FromArgb(210, 0, 0, 0))
            $shadowPen = [System.Windows.Media.Pen]::new($shadowBrush, $outlineWidth)
            $shadowPen.LineJoin = [System.Windows.Media.PenLineJoin]::Round
            $dc.DrawGeometry($shadowBrush, $shadowPen, $shadowTrans)

            # Black outline
            $dc.DrawGeometry($null, $outlinePen, $geomTrans)

            # Fill
            $fillBrush = [System.Windows.Media.SolidColorBrush]::new($fillColor)
            $dc.DrawGeometry($fillBrush, $null, $geomTrans)

            $curX += $seg.width
        } else {
            # Emoji
            $emojiSize = $seg.width
            $emojiY = $currentY + ($fontSize - $emojiSize) / 2.0 - 4.0
            if ($seg.image) {
                $dc.DrawImage($seg.image, [System.Windows.Rect]::new($curX, $emojiY, $emojiSize, $emojiSize))
            }
            $curX += $seg.width
        }
    }
    $currentY += $lineHeight
}

$dc.Close()

# Save bitmap
$rtb = [System.Windows.Media.Imaging.RenderTargetBitmap]::new(
    [int]$canvasW, [int]$canvasH, 96, 96,
    [System.Windows.Media.PixelFormats]::Pbgra32
)
$rtb.Render($visual)

$encoder = [System.Windows.Media.Imaging.PngBitmapEncoder]::new()
$encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($rtb))
$stream = [System.IO.File]::Create($outputPath)
$encoder.Save($stream)
$stream.Close()

Write-Output "Successfully generated hook overlay: $outputPath ($canvasW x $canvasH)"
