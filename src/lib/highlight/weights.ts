import fs from 'fs';
import path from 'path';
import { ContentType, ScoringWeights } from './types';

const WORKSPACE_DIR = path.resolve(process.cwd(), '.workspace');
const WEIGHTS_FILE = path.join(WORKSPACE_DIR, 'highlight_weights.json');

export const DEFAULT_WEIGHTS: Record<ContentType, ScoringWeights> = {
  streamer_gameplay: {
    hook_strength: 0.30,
    standalone_clarity: 0.20,
    payoff: 0.25,
    emotion_or_surprise: 0.20,
    brief_fit: 0.05,
    riskPenalty: 25,
  },
  talking_podcast: {
    hook_strength: 0.20,
    standalone_clarity: 0.35,
    payoff: 0.25,
    emotion_or_surprise: 0.10,
    brief_fit: 0.10,
    riskPenalty: 30,
  },
  other: {
    hook_strength: 0.25,
    standalone_clarity: 0.25,
    payoff: 0.25,
    emotion_or_surprise: 0.15,
    brief_fit: 0.10,
    riskPenalty: 25,
  },
};

export function loadScoringWeights(contentType: ContentType = 'other'): ScoringWeights {
  if (fs.existsSync(WEIGHTS_FILE)) {
    try {
      const raw = fs.readFileSync(WEIGHTS_FILE, 'utf-8');
      const allWeights = JSON.parse(raw);
      if (allWeights[contentType]) {
        return allWeights[contentType];
      }
    } catch {
      // Fall back to default
    }
  }
  return DEFAULT_WEIGHTS[contentType] || DEFAULT_WEIGHTS.other;
}

export function saveScoringWeights(contentType: ContentType, weights: ScoringWeights): void {
  let allWeights: Record<string, any> = { ...DEFAULT_WEIGHTS };
  if (fs.existsSync(WEIGHTS_FILE)) {
    try {
      allWeights = JSON.parse(fs.readFileSync(WEIGHTS_FILE, 'utf-8'));
    } catch {}
  }
  allWeights[contentType] = weights;
  fs.writeFileSync(WEIGHTS_FILE, JSON.stringify(allWeights, null, 2), 'utf-8');
}
