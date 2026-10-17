import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { engine, ollamaHost, ollamaModel, geminiApiKey } = await req.json();

    if (engine === 'local') {
      const host = (ollamaHost || 'http://127.0.0.1:11434').replace(/\/+$/, '');
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${host}/api/tags`, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
          return NextResponse.json({
            connected: false,
            message: `Ollama returned status ${res.status}: ${res.statusText}`,
          });
        }

        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name);
        const hasModel = models.some((m: string) => m.includes(ollamaModel || 'llama'));

        return NextResponse.json({
          connected: true,
          models,
          message: `Ollama is running with ${models.length} installed model(s)${
            hasModel ? ` (includes '${ollamaModel}')` : ''
          }.`,
        });
      } catch (e: any) {
        return NextResponse.json({
          connected: false,
          message: `Cannot reach Ollama at ${host}: ${e.message}. If Ollama is not installed, install it or switch to Gemini API / offline mode.`,
        });
      }
    } else if (engine === 'api') {
      const key = geminiApiKey || process.env.GEMINI_API_KEY;
      if (!key) {
        return NextResponse.json({
          connected: false,
          message: 'No Gemini API key provided in input or in .env (GEMINI_API_KEY).',
        });
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash?key=${key}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!res.ok) {
          const errText = await res.text();
          return NextResponse.json({
            connected: false,
            message: `Gemini API authentication failed (${res.status}): ${errText.slice(0, 150)}`,
          });
        }

        return NextResponse.json({
          connected: true,
          message: 'Gemini 1.5 Flash API connection verified successfully!',
        });
      } catch (e: any) {
        return NextResponse.json({
          connected: false,
          message: `Failed to contact Gemini API: ${e.message}`,
        });
      }
    }

    return NextResponse.json({ connected: true, message: 'Deterministic offline scoring engine ready.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
