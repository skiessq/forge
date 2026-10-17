import { NextRequest, NextResponse } from 'next/server';
import { getScoringEngine } from '@/lib/highlight/stage4_scoring';
import { Window, HighlightConfig } from '@/lib/highlight/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { candidate, config, angle } = await req.json();

    if (!candidate || !candidate.text) {
      return NextResponse.json({ error: 'Missing candidate or transcript text' }, { status: 400 });
    }

    const windowMock: Window = {
      id: candidate.id || 'cand_regen',
      start: candidate.start,
      end: candidate.end,
      duration: candidate.duration,
      text: candidate.text,
      words: candidate.words || [],
      sentences: [],
      signalScore: candidate.score,
      speechRatio: 0.9,
      wordsPerSecond: 2.5,
      avgRms: -18,
      maxSpike: 4,
      sceneChangeCount: 0,
    };

    const brief = (config?.campaignBrief || '') + ` (Angle: Focus on high-retention viral curiosity)`;
    const engine = getScoringEngine(config || {});
    const batchResult = await engine.scoreBatch([windowMock], brief, config?.contentType || 'other');

    const updated = batchResult[windowMock.id];
    return NextResponse.json({
      success: true,
      title: updated?.suggested_title || candidate.title,
      reason: updated?.reason || candidate.reason,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
