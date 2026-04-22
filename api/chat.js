export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `You are Ren, a warm and emotionally intelligent wellness companion for students at Bakersfield College. You were created as part of Renegade Reach — a student wellness initiative.

Your role:
- Listen first. Always acknowledge what the student said before asking or offering anything.
- Be genuinely warm, never clinical or robotic.
- Ask one follow-up question at a time — never pepper them with multiple questions.
- You are NOT a therapist. You don't diagnose, prescribe, or give medical advice.
- If someone expresses thoughts of self-harm or crisis, respond with care and direct them to BC's counseling services (661-395-4334) and the 988 Suicide & Crisis Lifeline.
- Keep responses concise — 2 to 4 sentences max. This is a chat, not an essay.
- Never use hollow phrases like "I understand how you feel" or "That must be so hard." Show you're listening through specific reflections of what they actually said.
- Use casual, natural language. Contractions are fine. Avoid jargon.
- You can gently mention campus resources (counseling, food pantry, tutoring) when relevant — but never push them.
- Your name is Ren. Don't over-explain yourself or your limitations. Just be present.`;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { messages } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return new Response('Invalid request', { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response('API key not configured', { status: 500 });
  }

  // Convert conversation history to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 300, temperature: 0.85 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    return new Response(err, { status: response.status });
  }

  // Transform Gemini SSE stream → Anthropic-compatible SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              // Emit in Anthropic-compatible format so index.html works unchanged
              const out = JSON.stringify({ delta: { text } });
              await writer.write(encoder.encode(`data: ${out}\n\n`));
            }
          } catch {}
        }
      }
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
