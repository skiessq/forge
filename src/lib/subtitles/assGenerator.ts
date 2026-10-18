import { SubtitleItem, SubtitleStyle, Project } from '../types';

// Convert CSS Hex #RRGGBB, #RGB, rgba(r,g,b,a) or rgb(r,g,b) to ASS &HAABBGGRR
export function hexToAssColor(color: string, defaultAlpha = '00'): string {
  if (!color) return `&H${defaultAlpha}000000&`;
  const trimmed = color.trim().toLowerCase();
  if (trimmed === 'transparent') {
    return '&HFF000000&';
  }

  // Parse rgba(r, g, b, a) or rgb(r, g, b)
  const rgbaMatch = trimmed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = Math.max(0, Math.min(255, parseInt(rgbaMatch[1], 10))).toString(16).padStart(2, '0');
    const g = Math.max(0, Math.min(255, parseInt(rgbaMatch[2], 10))).toString(16).padStart(2, '0');
    const b = Math.max(0, Math.min(255, parseInt(rgbaMatch[3], 10))).toString(16).padStart(2, '0');
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1.0;
    // In ASS, 00 is fully opaque, FF is fully transparent
    const assAlpha = Math.max(0, Math.min(255, Math.round((1 - a) * 255))).toString(16).padStart(2, '0');
    return `&H${assAlpha}${b}${g}${r}&`.toUpperCase();
  }

  let clean = trimmed.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length === 8) {
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    const aHex = clean.substring(6, 8);
    const aVal = parseInt(aHex, 16);
    const assAlpha = (255 - aVal).toString(16).padStart(2, '0');
    return `&H${assAlpha}${b}${g}${r}&`.toUpperCase();
  }
  if (clean.length === 6) {
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    return `&H${defaultAlpha}${b}${g}${r}&`.toUpperCase();
  }

  // Fallback to pure black, NEVER white!
  return `&H${defaultAlpha}000000&`;
}

// Convert seconds (e.g. 12.345) to ASS timestamp format H:MM:SS.cc
export function secondsToAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);

  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  const ccs = (cs >= 100 ? 99 : cs).toString().padStart(2, '0');

  return `${h}:${mm}:${ss}.${ccs}`;
}

// Regex matching emoji characters (Unicode Extended Pictographic, Emoji Presentation)
const EMOJI_REGEX = /(\p{Extended_Pictographic}+|\p{Emoji_Presentation}+)/gu;

export function wrapEmojisInAss(text: string, baseFont: string): string {
  return text.replace(EMOJI_REGEX, (match) => `{\\fnSegoe UI Emoji}${match}{\\fn${baseFont}}`);
}

// Map editor font choice to exact font family name recognized by libass with bundled TTF files
export function resolveAssFont(fontFamily: string = 'Montserrat'): { fontName: string; isBold: string } {
  const clean = (fontFamily || 'Montserrat').trim();
  switch (clean) {
    case 'Montserrat':
      // Montserrat-Black.ttf has family 'Montserrat Black', giving thick viral typography matching preview
      return { fontName: 'Montserrat Black', isBold: '0' };
    case 'Anton':
      return { fontName: 'Anton', isBold: '0' };
    case 'Bebas Neue':
      return { fontName: 'Bebas Neue', isBold: '0' };
    case 'Luckiest Guy':
      return { fontName: 'Luckiest Guy', isBold: '0' };
    case 'Bangers':
      return { fontName: 'Bangers', isBold: '0' };
    case 'Russo One':
      return { fontName: 'Russo One', isBold: '0' };
    case 'Titan One':
      return { fontName: 'Titan One', isBold: '0' };
    case 'Rubik Glitch':
      return { fontName: 'Rubik Glitch', isBold: '0' };
    case 'Oswald':
      return { fontName: 'Oswald', isBold: '-1' };
    case 'Inter':
      return { fontName: 'Inter', isBold: '-1' };
    case 'Impact':
      return { fontName: 'Impact', isBold: '0' };
    case 'Arial Black':
      return { fontName: 'Arial Black', isBold: '0' };
    default:
      return { fontName: clean, isBold: '-1' };
  }
}

export function generateAssSubtitles(project: Project, options?: { includeIntroHook?: boolean }): string {
  const { subtitles, subtitleStyle, canvas } = project;

  const { fontName, isBold } = resolveAssFont(subtitleStyle.fontFamily || 'Montserrat');
  // Proportional font sizing: 2.25x matches the bold, punchy ~70-75% screen width seen in preview
  const scale = (canvas.width || 1080) / 1080;
  const fontSize = Math.round((subtitleStyle.fontSize || 54) * 2.25 * scale);
  const primaryColor = hexToAssColor(subtitleStyle.primaryColor || '#FFFFFF', '00');
  const highlightColor = hexToAssColor(subtitleStyle.highlightColor || '#FFE600', '00');
  const outlineColor = hexToAssColor(subtitleStyle.outlineColor || '#000000', '00');
  // Dark semi-transparent shadow (&H90000000&): NEVER white! Completely eliminates white backdrop halo
  const shadowColor = subtitleStyle.shadowColor
    ? hexToAssColor(subtitleStyle.shadowColor, '90')
    : '&H90000000&';

  // Sleek, clean stroke matching TikTok / CapCut (no bloated letter-filling black blob)
  const rawOutline = (subtitleStyle.outlineWidth || 4) * 0.9 * scale;
  const outlineWidth = Math.max(2, Math.round(rawOutline * 10) / 10);
  const shadowDistance = Math.max(1, Math.round((subtitleStyle.shadowDistance || 2) * 0.6 * scale * 10) / 10);

  // Alignment: 2 = Bottom-center, 5 = Middle-center, 8 = Top-center
  let alignment = 2;
  // Match preview: 22% from bottom in vertical 9:16 video (approx 420px on 1920h)
  let marginV = Math.round(canvas.height * 0.22);
  let marginL = Math.round(canvas.width * 0.06);
  let marginR = Math.round(canvas.width * 0.06);

  if (subtitleStyle.horizontalOffset) {
    const hOff = subtitleStyle.horizontalOffset * scale * 2.8;
    if (hOff > 0) {
      marginL = Math.round(marginL + hOff);
      marginR = Math.max(20, Math.round(marginR - hOff));
    } else {
      marginR = Math.round(marginR + Math.abs(hOff));
      marginL = Math.max(20, Math.round(marginL - Math.abs(hOff)));
    }
  }

  const vOffsetPx = Math.round((subtitleStyle.verticalOffset || 0) * scale * 2.2);
  if (subtitleStyle.position === 'top') {
    alignment = 8;
    marginV = Math.round(canvas.height * 0.15 + vOffsetPx);
  } else if (subtitleStyle.position === 'middle') {
    alignment = 5;
    marginV = vOffsetPx;
  } else {
    // bottom
    alignment = 2;
    marginV = Math.max(60, Math.round(canvas.height * 0.22 - vOffsetPx));
  }

  // Intro Hook Style and Event (only included if not overlaid directly via FFmpeg)
  let introHookStyle = '';
  let introHookDialogue = '';
  const shouldIncludeHook = options?.includeIntroHook !== false;

  if (shouldIncludeHook && project.introHook?.enabled && project.introHook.text) {
    const hookChoice = project.introHook.fontFamily || subtitleStyle.fontFamily || 'Montserrat';
    const hookFontName = hookChoice === 'Montserrat' ? 'Montserrat Black' : resolveAssFont(hookChoice).fontName;
    const hookFontSize = Math.round((project.introHook.fontSize || 42) * 2.35 * scale);
    const hookPrimaryColor = hexToAssColor(project.introHook.color || '#FFFFFF', '00');
    const hookHighlightColor = hexToAssColor(project.introHook.highlightColor || '#FFE600', '00');
    const hookOutlineColor = hexToAssColor(project.introHook.outlineColor || '#000000', '00');
    const hookShadowColor = hexToAssColor('#000000', '80');
    const hookOutlineW = Math.max(2, Math.round((project.introHook.outlineWidth ?? 5) * 0.9 * scale * 10) / 10);
    const hookShadowD = Math.max(1, Math.round(3 * 0.75 * scale * 10) / 10);

    introHookStyle = `Style: IntroHook,${hookFontName},${hookFontSize},${hookPrimaryColor},${hookHighlightColor},${hookOutlineColor},${hookShadowColor},0,0,0,0,100,100,0,0,1,${hookOutlineW},${hookShadowD},5,10,10,10,1\n`;

    const allTracks = project.tracks || (project as any).timeline?.tracks || [];
    const videoTrack = allTracks.find((t: any) => t.type === 'video');
    const clips = videoTrack?.clips || [];
    const totalDuration = clips.length > 0
      ? clips.reduce((acc: number, c: any) => acc + c.duration, 0)
      : (project.source.probe?.duration || 30);
    const hookDur = project.introHook.stayWholeVideo
      ? totalDuration
      : Math.min(totalDuration, project.introHook.duration || 2.5);

    const posX = Math.round(canvas.width * (project.introHook.positionX ?? 0.5));
    const posY = Math.round(canvas.height * (project.introHook.positionY ?? 0.22));

    const { formatHookLines } = require('../utils/hookText');
    const hookLines: string[] = formatHookLines(project.introHook.text, project.introHook.wordsPerLine);

    const formattedLines = hookLines.map((line) => {
      let formattedLine = '';
      if (line.includes('*')) {
        const parts = line.split('*');
        formattedLine = parts
          .map((part, i) => {
            const upper = part.toUpperCase();
            const withEmoji = wrapEmojisInAss(upper, hookFontName);
            return i % 2 === 1
              ? `{\\c${hookHighlightColor}}${withEmoji}{\\c${hookPrimaryColor}}`
              : withEmoji;
          })
          .join('');
      } else {
        const upper = line.toUpperCase();
        formattedLine = wrapEmojisInAss(upper, hookFontName);
      }
      return formattedLine;
    });

    const hookBody = formattedLines.join('\\N');

    let animTag = `{\\an5\\pos(${posX},${posY})\\fad(150,350)}`;
    const tr = project.introHook.transition || 'bounce_drop';
    if (tr === 'static') {
      animTag = project.introHook.stayWholeVideo
        ? `{\\an5\\pos(${posX},${posY})}`
        : `{\\an5\\pos(${posX},${posY})\\fad(0,200)}`;
    } else if (tr === 'bounce_drop') {
      animTag = `{\\an5\\move(${posX},${posY - 140},${posX},${posY},0,400)\\fad(150,350)}`;
    } else if (tr === 'slide_down') {
      animTag = `{\\an5\\move(${posX},${posY - 120},${posX},${posY},0,350)\\fad(150,350)}`;
    } else if (tr === 'zoom_pop') {
      animTag = `{\\an5\\pos(${posX},${posY})\\fscx135\\fscy135\\t(0,300,\\fscx100\\fscy100)\\fad(150,350)}`;
    } else if (tr === 'pop_in') {
      animTag = `{\\an5\\pos(${posX},${posY})\\fscx50\\fscy50\\t(0,250,\\fscx100\\fscy100)\\fad(150,350)}`;
    } else if (tr === 'fade_zoom') {
      animTag = `{\\an5\\pos(${posX},${posY})\\fad(350,350)}`;
    }

    const startAss = secondsToAssTime(0);
    const endAss = secondsToAssTime(hookDur);
    introHookDialogue = `Dialogue: 1,${startAss},${endAss},IntroHook,,0,0,0,,${animTag}${hookBody}\n`;
  }

  const header = `[Script Info]
; Script generated by ClipForge
Title: ClipForge Subtitles
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: ${canvas.width}
PlayResY: ${canvas.height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${highlightColor},${outlineColor},${shadowColor},${isBold},0,0,0,100,100,0,0,1,${outlineWidth},${shadowDistance},${alignment},${marginL},${marginR},${marginV},1
${introHookStyle}
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${introHookDialogue}`;

  // 1. Sort valid cues by start time
  const validSubtitles = (subtitles || [])
    .filter((s) => s.text && s.text.trim().length > 0)
    .sort((a, b) => a.start - b.start);
  const sanitizedSubtitles: SubtitleItem[] = JSON.parse(JSON.stringify(validSubtitles));

  // 2. Pre-sanitize subtitles to guarantee STRICT non-overlapping sequential cues
  // (Prevents libass from ever stacking adjacent cues on top of each other)
  for (let idx = 0; idx < sanitizedSubtitles.length; idx++) {
    const curr = sanitizedSubtitles[idx];
    const next = sanitizedSubtitles[idx + 1];
    if (next && curr.end >= next.start) {
      curr.end = Math.max(curr.start + 0.05, next.start - 0.01);
      if (curr.words && curr.words.length > 0) {
        curr.words = curr.words.filter((w) => w.start < curr.end);
        for (const w of curr.words) {
          if (w.end > curr.end) {
            w.end = curr.end;
          }
        }
      }
    }
  }

  const dialogueLines: string[] = [];

  for (let sIdx = 0; sIdx < sanitizedSubtitles.length; sIdx++) {
    const item = sanitizedSubtitles[sIdx];
    const nextItem = sanitizedSubtitles[sIdx + 1];
    if (!item.text.trim()) continue;

    const transform = subtitleStyle.textTransform;
    let baseText = item.text.trim();
    if (transform === 'uppercase') baseText = baseText.toUpperCase();
    if (transform === 'lowercase') baseText = baseText.toLowerCase();

    // Cue boundary strictly clamped with guaranteed non-overlapping gap to next cue
    const cueLimit = nextItem ? Math.min(item.end, nextItem.start - 0.01) : item.end;

    // Karaoke active word animation with individual word color support
    if (subtitleStyle.animation === 'karaoke_highlight' && item.words && item.words.length > 0) {
      for (let i = 0; i < item.words.length; i++) {
        const currentWord = item.words[i];
        const nextWord = item.words[i + 1];
        const wordStartSec = Math.max(item.start, currentWord.start);
        if (wordStartSec >= cueLimit) continue;

        let wordEndSec: number;
        if (nextWord && nextWord.start < cueLimit) {
          // Word stays active until the next word in the same cue starts
          wordEndSec = Math.min(nextWord.start, cueLimit);
        } else {
          // LAST word in cue: MUST end strictly at cueLimit (NEVER add +0.15s padding into next cue!)
          wordEndSec = cueLimit;
        }

        // Clamp to prevent negative/zero duration
        if (wordEndSec <= wordStartSec) {
          wordEndSec = Math.min(wordStartSec + 0.05, cueLimit);
        }

        const wordStart = secondsToAssTime(wordStartSec);
        const wordEnd = secondsToAssTime(wordEndSec);

        // Build line where word i is highlighted and individual word colors are respected
        const lineParts = item.words.map((w, idx) => {
          let wordStr = w.word;
          if (transform === 'uppercase') wordStr = wordStr.toUpperCase();
          if (transform === 'lowercase') wordStr = wordStr.toLowerCase();
          wordStr = wrapEmojisInAss(wordStr, fontName);

          const customColor = w.color ? hexToAssColor(w.color) : null;

          if (idx === i) {
            const activeColor = customColor || highlightColor;
            return `{\\c${activeColor}}${wordStr}{\\c${primaryColor}}`;
          }
          if (customColor) {
            return `{\\c${customColor}}${wordStr}{\\c${primaryColor}}`;
          }
          return wordStr;
        });

        const lineText = lineParts.join(' ');
        dialogueLines.push(
          `Dialogue: 0,${wordStart},${wordEnd},Default,,0,0,0,,${lineText}`
        );
      }
    } else {
      const cueStartSec = item.start;
      const cueEndSec = cueLimit;
      if (cueEndSec > cueStartSec) {
        const cueStart = secondsToAssTime(cueStartSec);
        const cueEnd = secondsToAssTime(cueEndSec);

        // Build base text with any custom individual word colors preserved
        let styledText = wrapEmojisInAss(baseText, fontName);
        if (item.words && item.words.length > 0) {
          styledText = item.words
            .map((w) => {
              let wordStr = w.word;
              if (transform === 'uppercase') wordStr = wordStr.toUpperCase();
              if (transform === 'lowercase') wordStr = wordStr.toLowerCase();
              wordStr = wrapEmojisInAss(wordStr, fontName);
              if (w.color) {
                return `{\\c${hexToAssColor(w.color)}}${wordStr}{\\c${primaryColor}}`;
              }
              return wordStr;
            })
            .join(' ');
        }

        dialogueLines.push(
          `Dialogue: 0,${cueStart},${cueEnd},Default,,0,0,0,,${styledText}`
        );
      }
    }
  }

  return header + dialogueLines.join('\n') + '\n';
}

export function exportToSrt(subtitles: SubtitleItem[]): string {
  let srt = '';
  subtitles.forEach((s, idx) => {
    const startH = Math.floor(s.start / 3600).toString().padStart(2, '0');
    const startM = Math.floor((s.start % 3600) / 60).toString().padStart(2, '0');
    const startS = Math.floor(s.start % 60).toString().padStart(2, '0');
    const startMs = Math.round((s.start % 1) * 1000).toString().padStart(3, '0');

    const endH = Math.floor(s.end / 3600).toString().padStart(2, '0');
    const endM = Math.floor((s.end % 3600) / 60).toString().padStart(2, '0');
    const endS = Math.floor(s.end % 60).toString().padStart(2, '0');
    const endMs = Math.round((s.end % 1) * 1000).toString().padStart(3, '0');

    srt += `${idx + 1}\n${startH}:${startM}:${startS},${startMs} --> ${endH}:${endM}:${endS},${endMs}\n${s.text}\n\n`;
  });
  return srt;
}

export function parseSrt(srtText: string): SubtitleItem[] {
  const items: SubtitleItem[] = [];
  const blocks = srtText.trim().split(/\r?\n\r?\n/);

  blocks.forEach((block, idx) => {
    const lines = block.split(/\r?\n/);
    if (lines.length >= 2) {
      const timeLine = lines[1].includes('-->') ? lines[1] : lines[0];
      const textLines = lines.slice(lines.indexOf(timeLine) + 1).join(' ');

      const parts = timeLine.split('-->');
      if (parts.length === 2) {
        const parseTime = (tStr: string) => {
          const [hms, ms] = tStr.trim().replace(',', '.').split('.');
          const [h, m, s] = hms.split(':').map(Number);
          return h * 3600 + m * 60 + s + (Number(ms) || 0) / 1000;
        };

        const start = parseTime(parts[0]);
        const end = parseTime(parts[1]);

        items.push({
          id: `sub_import_${idx + 1}`,
          start,
          end,
          text: textLines.trim(),
        });
      }
    }
  });

  return items;
}
