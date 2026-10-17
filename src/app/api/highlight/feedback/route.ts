import { NextRequest, NextResponse } from 'next/server';
import { recordFeedback, listFeedback, getFeedbackSummary } from '@/lib/highlight/feedback';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const feedback = listFeedback();
    const summary = getFeedbackSummary();
    return NextResponse.json({ feedback, summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidateId, rating, score, title, reason, rawScores, duration, projectId } = body;

    if (!candidateId || !rating) {
      return NextResponse.json({ error: 'Missing candidateId or rating' }, { status: 400 });
    }

    const saved = recordFeedback({
      candidateId,
      rating,
      score: score || 0,
      title: title || '',
      reason: reason || '',
      rawScores: rawScores || ({} as any),
      duration: duration || 0,
      projectId,
    });

    const summary = getFeedbackSummary();
    return NextResponse.json({ success: true, entry: saved, summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
