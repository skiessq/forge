import fs from 'fs';
import path from 'path';
import { LlmScoreOutput } from './types';

const WORKSPACE_DIR = path.resolve(process.cwd(), '.workspace');
const FEEDBACK_FILE = path.join(WORKSPACE_DIR, 'highlight_feedback.json');

export interface CandidateFeedbackEntry {
  id: string;
  candidateId: string;
  projectId?: string;
  sourceHash?: string;
  timestamp: string;
  rating: 'good' | 'bad';
  score: number;
  title: string;
  reason: string;
  rawScores: LlmScoreOutput;
  duration: number;
  userNotes?: string;
}

export interface FeedbackSummary {
  total: number;
  goodCount: number;
  badCount: number;
  goodAvgScore: number;
  badAvgScore: number;
  insights: string[];
}

export function listFeedback(): CandidateFeedbackEntry[] {
  if (!fs.existsSync(FEEDBACK_FILE)) return [];
  try {
    const raw = fs.readFileSync(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function recordFeedback(entry: Omit<CandidateFeedbackEntry, 'id' | 'timestamp'>): CandidateFeedbackEntry {
  const all = listFeedback();
  const existingIdx = all.findIndex((f) => f.candidateId === entry.candidateId);

  const fullEntry: CandidateFeedbackEntry = {
    ...entry,
    id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    all[existingIdx] = fullEntry;
  } else {
    all.push(fullEntry);
  }

  const dir = path.dirname(FEEDBACK_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(all, null, 2), 'utf-8');

  return fullEntry;
}

export function getFeedbackSummary(): FeedbackSummary {
  const feedback = listFeedback();
  const total = feedback.length;
  if (total === 0) {
    return {
      total: 0,
      goodCount: 0,
      badCount: 0,
      goodAvgScore: 0,
      badAvgScore: 0,
      insights: ['No feedback recorded yet. Rate candidates 👍 or 👎 to generate weight tuning insights.'],
    };
  }

  const goods = feedback.filter((f) => f.rating === 'good');
  const bads = feedback.filter((f) => f.rating === 'bad');

  const goodAvg = goods.length > 0 ? goods.reduce((acc, g) => acc + g.score, 0) / goods.length : 0;
  const badAvg = bads.length > 0 ? bads.reduce((acc, b) => acc + b.score, 0) / bads.length : 0;

  const insights: string[] = [];
  if (goods.length > 0) {
    insights.push(`Average score for approved/good candidates: ${Math.round(goodAvg * 10) / 10}`);
  }
  if (bads.length > 0) {
    insights.push(`Average score for rejected/bad candidates: ${Math.round(badAvg * 10) / 10}`);
  }

  if (goods.length >= 3 && bads.length >= 2) {
    // Check if bad clips had lower standalone clarity or weak hooks
    const badHookAvg = bads.reduce((a, b) => a + (b.rawScores?.hook_strength || 0), 0) / bads.length;
    const goodHookAvg = goods.reduce((a, b) => a + (b.rawScores?.hook_strength || 0), 0) / goods.length;
    if (goodHookAvg - badHookAvg > 1.5) {
      insights.push('User strongly favors high hook_strength. Consider increasing hook_strength weight.');
    }
  }

  return {
    total,
    goodCount: goods.length,
    badCount: bads.length,
    goodAvgScore: Math.round(goodAvg * 10) / 10,
    badAvgScore: Math.round(badAvg * 10) / 10,
    insights,
  };
}
