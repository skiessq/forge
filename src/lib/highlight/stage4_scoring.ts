import {
  Window,
  ScoredWindow,
  LlmScoreOutput,
  HighlightConfig,
  ContentType,
} from './types';
import { loadScoringWeights } from './weights';
import {
  loadCachedScores,
  saveCachedScores,
  computeScoringConfigHash,
} from './cache';

export interface ScoringEngine {
  name: string;
  scoreBatch(
    windows: Window[],
    campaignBrief?: string,
    contentType?: ContentType
  ): Promise<Record<string, LlmScoreOutput>>;
}

/**
 * Checks if opening words represent conversational filler that weakens the hook.
 */
export function isFillerOpening(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  const fillerRegex = /^(so|um|uh|yeah|well|like|and|okay|wait|alright|you know|i mean|hm|hmm)[\s,.]/i;
  return fillerRegex.test(trimmed);
}

/**
 * Hard Rule: The first 3 seconds of a window must work as a hook;
 * if the opening line is a filler, shift start forward to the first strong sentence.
 */
export function applyHookStartFix(
  window: Window,
  minLength = 20
): { adjustedStart: number; hookShifted: boolean } {
  if (!window.sentences || window.sentences.length < 2) {
    return { adjustedStart: window.start, hookShifted: false };
  }

  const firstSentence = window.sentences[0];
  const firstDuration = firstSentence.end - firstSentence.start;

  // If first sentence is short (<= 3.5s) and starts with filler phrases
  if (firstDuration <= 3.5 && isFillerOpening(firstSentence.text)) {
    const secondSentence = window.sentences[1];
    const remainingDuration = window.end - secondSentence.start;

    // Only shift if remaining duration still satisfies minimum clip duration
    if (remainingDuration >= minLength - 3) {
      return {
        adjustedStart: secondSentence.start,
        hookShifted: true,
      };
    }
  }

  return { adjustedStart: window.start, hookShifted: false };
}

/**
 * Formats a batch of windows into the prompt for the scoring LLM.
 */
function buildBatchPrompt(
  windows: Window[],
  campaignBrief?: string,
  contentType: ContentType = 'other'
): string {
  const briefSection = campaignBrief && campaignBrief.trim()
    ? `\nCAMPAIGN BRIEF & TONE REQUIREMENTS:\n${campaignBrief.trim()}\n`
    : `\nCAMPAIGN BRIEF: None provided. Evaluate for general high-virality short-form video engagement.\n`;

  const windowsFormatted = windows
    .map((w, idx) => {
      const context = w.contextBefore ? `[Context prior to clip: "${w.contextBefore}"]\n` : '';
      return `--- WINDOW #${idx + 1} (ID: "${w.id}") ---
Duration: ${w.duration}s
Energy Hint: Avg RMS ${w.avgRms} dB, Peak Spike +${w.maxSpike} dB, Speech Rate ${w.wordsPerSecond} words/sec
${context}Transcript:
"${w.text}"`;
    })
    .join('\n\n');

  return `You are an elite short-form video editor for TikTok, YouTube Shorts, and Reels.
Analyze each candidate clip window below for virality, standalone sense, and hook strength.${briefSection}
CONTENT TYPE: ${contentType}

For EACH window, output a JSON object adhering STRICTLY to this schema:
{
  "hook_strength": <0-10 rating: how captivating the first 3 seconds are>,
  "standalone_clarity": <0-10 rating: makes complete sense with zero prior video context>,
  "payoff": <0-10 rating: delivers an entertaining, informative, or punchy climax>,
  "emotion_or_surprise": <0-10 rating: shock, humor, high skill, drama, or curiosity>,
  "brief_fit": <0-10 rating: adherence to campaign brief or universal viral standards>,
  "risk_flags": [<list of risk warnings if present, e.g. "copyright music", "profanity", "incomplete thought">],
  "suggested_title": "<punchy viral caption/title, maximum 8 words>",
  "reason": "<one concise sentence explaining why this clip will perform or flop>"
}

CRITICAL: Return a single JSON dictionary mapping window ID to its scoring object:
{
  "${windows[0]?.id || 'win_1'}": { ... },
  ...
}
Strict JSON only. No explanations, no markdown intro, no extra text.`;
}

/**
 * Validates and parses raw LLM output into typed scoring records.
 */
export function parseAndValidateBatchResponse(
  rawText: string,
  expectedIds: string[]
): Record<string, LlmScoreOutput> {
  let cleaned = rawText.trim();
  // Strip markdown code fences if model returned ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e: any) {
    // Attempt to extract the outermost JSON object if trailing text was attached
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch {
        throw new Error(`Failed to parse LLM JSON: ${e.message}`);
      }
    } else {
      throw new Error(`Invalid JSON output: ${e.message}`);
    }
  }

  const results: Record<string, LlmScoreOutput> = {};

  for (const id of expectedIds) {
    const item = parsed[id] || parsed;
    if (item && typeof item === 'object') {
      results[id] = {
        hook_strength: clampScore(item.hook_strength),
        standalone_clarity: clampScore(item.standalone_clarity),
        payoff: clampScore(item.payoff),
        emotion_or_surprise: clampScore(item.emotion_or_surprise),
        brief_fit: clampScore(item.brief_fit),
        risk_flags: Array.isArray(item.risk_flags) ? item.risk_flags.map(String) : [],
        suggested_title: sanitizeTitle(item.suggested_title || 'Viral Highlight Moment'),
        reason: String(item.reason || 'Strong candidate moment with engaging delivery.').trim(),
      };
    } else {
      // Missing this ID in model response, generate default fallback
      results[id] = createDefaultFallbackScore(id);
    }
  }

  return results;
}

function clampScore(val: any): number {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return 6.0;
  return Math.max(0, Math.min(10, Math.round(num * 10) / 10));
}

function sanitizeTitle(title: string): string {
  const clean = String(title).replace(/["\n\r]/g, '').trim();
  const words = clean.split(/\s+/).slice(0, 8);
  return words.join(' ') || 'Highlight Clip';
}

function createDefaultFallbackScore(id: string): LlmScoreOutput {
  return {
    hook_strength: 6.5,
    standalone_clarity: 7.0,
    payoff: 6.8,
    emotion_or_surprise: 6.0,
    brief_fit: 7.0,
    risk_flags: [],
    suggested_title: 'Key Gameplay Highlight',
    reason: 'Segment displays steady engagement and clear speech boundaries.',
  };
}

/**
 * Local Ollama Scoring Engine
 */
export class OllamaScoringEngine implements ScoringEngine {
  name = 'ollama';
  private host: string;
  private model: string;

  constructor(host = 'http://127.0.0.1:11434', model = 'llama3.2') {
    this.host = host.replace(/\/+$/, '');
    this.model = model;
  }

  async scoreBatch(
    windows: Window[],
    campaignBrief?: string,
    contentType: ContentType = 'other'
  ): Promise<Record<string, LlmScoreOutput>> {
    const prompt = buildBatchPrompt(windows, campaignBrief, contentType);
    const expectedIds = windows.map((w) => w.id);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      const res = await fetch(`${this.host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a professional video editor. Output valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          format: 'json',
          stream: false,
          options: {
            temperature: 0.3,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const content = data?.message?.content || '{}';
      return parseAndValidateBatchResponse(content, expectedIds);
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Gemini API Scoring Engine
 */
export class GeminiScoringEngine implements ScoringEngine {
  name = 'gemini';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async scoreBatch(
    windows: Window[],
    campaignBrief?: string,
    contentType: ContentType = 'other'
  ): Promise<Record<string, LlmScoreOutput>> {
    const prompt = buildBatchPrompt(windows, campaignBrief, contentType);
    const expectedIds = windows.map((w) => w.id);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return parseAndValidateBatchResponse(candidateText, expectedIds);
  }
}

/**
 * Deterministic Mock Engine for tests & offline runs without API key or Ollama
 */
export class DeterministicRuleScoringEngine implements ScoringEngine {
  name = 'deterministic';

  async scoreBatch(
    windows: Window[],
    campaignBrief?: string,
    contentType: ContentType = 'other'
  ): Promise<Record<string, LlmScoreOutput>> {
    const results: Record<string, LlmScoreOutput> = {};

    for (const w of windows) {
      const textLower = w.text.toLowerCase();
      // Signals:
      const hasClutch = /clutch|insane|unbelievable|no way|omg|look at this|win|champion|ace/i.test(w.text);
      const hasQuestion = /\?/.test(w.text);
      const isShort = w.duration >= 20 && w.duration <= 45;

      const hook = Math.min(9.8, Math.max(5.0, (hasClutch ? 8.8 : 6.5) + (w.maxSpike > 3 ? 1.0 : 0)));
      const clarity = Math.min(9.5, Math.max(5.5, 7.0 + (hasQuestion ? 0.8 : 0)));
      const payoff = Math.min(9.8, Math.max(5.0, (hasClutch ? 9.0 : 6.8) + (isShort ? 0.5 : 0)));
      const emotion = Math.min(9.5, Math.max(4.5, 6.0 + (w.maxSpike > 4 ? 2.5 : 0.5)));
      const briefFit = campaignBrief ? (textLower.includes(campaignBrief.toLowerCase().slice(0, 6)) ? 9.0 : 7.5) : 8.0;

      // Extract a clean title from first sentence
      const firstWords = w.text.split(/\s+/).slice(0, 6).join(' ').replace(/[^\w\s]/g, '');
      const suggestedTitle = hasClutch ? `Insane Clutch: ${firstWords}` : `Highlight: ${firstWords}`;

      results[w.id] = {
        hook_strength: Math.round(hook * 10) / 10,
        standalone_clarity: Math.round(clarity * 10) / 10,
        payoff: Math.round(payoff * 10) / 10,
        emotion_or_surprise: Math.round(emotion * 10) / 10,
        brief_fit: Math.round(briefFit * 10) / 10,
        risk_flags: [],
        suggested_title: sanitizeTitle(suggestedTitle),
        reason: hasClutch ? 'High energy clutch moment with strong peak audio.' : 'Consistent pacing and clear narrative.',
      };
    }

    return results;
  }
}

/**
 * Computes the final weighted score (0-100) based on content type weights and risk penalties.
 */
export function computeFinalScore(
  raw: LlmScoreOutput,
  contentType: ContentType = 'other'
): { finalScore: number; scoreBreakdown: Record<string, number> } {
  const weights = loadScoringWeights(contentType);

  const weightedSum =
    raw.hook_strength * weights.hook_strength +
    raw.standalone_clarity * weights.standalone_clarity +
    raw.payoff * weights.payoff +
    raw.emotion_or_surprise * weights.emotion_or_surprise +
    raw.brief_fit * weights.brief_fit;

  // Scale from 0..10 to 0..100
  let score = weightedSum * 10;

  // Penalize risk flags
  const riskPenalty = (raw.risk_flags?.length || 0) * (weights.riskPenalty || 25);
  score = Math.max(0, Math.min(100, Math.round(score - riskPenalty)));

  const breakdown: Record<string, number> = {
    hook: Math.round(raw.hook_strength * weights.hook_strength * 10),
    clarity: Math.round(raw.standalone_clarity * weights.standalone_clarity * 10),
    payoff: Math.round(raw.payoff * weights.payoff * 10),
    emotion: Math.round(raw.emotion_or_surprise * weights.emotion_or_surprise * 10),
    brief: Math.round(raw.brief_fit * weights.brief_fit * 10),
    riskPenalty,
  };

  return { finalScore: score, scoreBreakdown: breakdown };
}

/**
 * Factory to instantiate the chosen scoring engine.
 */
export function getScoringEngine(config: Partial<HighlightConfig>): ScoringEngine {
  if (config.scoringEngine === 'api') {
    const key = config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (key) {
      return new GeminiScoringEngine(key);
    }
  }

  if (config.scoringEngine === 'local') {
    const host = config.ollamaHost || 'http://127.0.0.1:11434';
    const model = config.ollamaModel || 'llama3.2';
    return new OllamaScoringEngine(host, model);
  }

  // Fallback to deterministic rule-based engine
  return new DeterministicRuleScoringEngine();
}

/**
 * Stage 4 Orchestrator:
 * Scores windows in batches using the configured LLM engine,
 * computes weighted scores, and applies hook-start fixes.
 */
export async function scoreCandidateWindows(
  windows: Window[],
  config: Partial<HighlightConfig>,
  sourceHash: string,
  onProgress?: (progress: number, stage: string) => void,
  isCancelled?: () => boolean
): Promise<ScoredWindow[]> {
  if (windows.length === 0) return [];

  const scoringConfigHash = computeScoringConfigHash(config);
  const cached = loadCachedScores(sourceHash, scoringConfigHash);
  if (cached && cached.length === windows.length) {
    onProgress?.(100, 'Using cached LLM window scores');
    return cached;
  }

  const engine = getScoringEngine(config);
  const batchSize = 4; // 4 windows per LLM call
  const batches: Window[][] = [];

  for (let i = 0; i < windows.length; i += batchSize) {
    batches.push(windows.slice(i, i + batchSize));
  }

  const scoredWindows: ScoredWindow[] = [];
  const contentType = config.contentType || 'other';

  for (let b = 0; b < batches.length; b++) {
    if (isCancelled?.()) throw new Error('Scoring cancelled by user.');

    const batch = batches[b];
    const pct = Math.round(((b + 1) / batches.length) * 100);
    onProgress?.(pct, `Scoring candidate batch ${b + 1}/${batches.length} with ${engine.name}...`);

    let rawScores: Record<string, LlmScoreOutput>;
    try {
      rawScores = await engine.scoreBatch(batch, config.campaignBrief, contentType);
    } catch (e: any) {
      console.warn(`Scoring engine ${engine.name} batch ${b + 1} failed (${e.message}), falling back to rule-based:`, e);
      // Never crash on engine failure; fallback to deterministic scoring
      const fallbackEngine = new DeterministicRuleScoringEngine();
      rawScores = await fallbackEngine.scoreBatch(batch, config.campaignBrief, contentType);
    }

    for (const win of batch) {
      const raw = rawScores[win.id] || createDefaultFallbackScore(win.id);
      const { finalScore, scoreBreakdown } = computeFinalScore(raw, contentType);
      const { adjustedStart, hookShifted } = applyHookStartFix(win, config.minLength ?? 20);

      scoredWindows.push({
        ...win,
        rawScores: raw,
        finalScore,
        scoreBreakdown,
        adjustedStart,
        adjustedEnd: win.end,
        hookShifted,
      });
    }
  }

  saveCachedScores(sourceHash, scoringConfigHash, scoredWindows);
  onProgress?.(100, `Scoring completed for ${scoredWindows.length} windows.`);

  return scoredWindows;
}
