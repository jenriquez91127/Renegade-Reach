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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    res.status(400).send('Invalid request'); return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).send('API key not configured'); return; }

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    console.error('Anthropic error:', err);
    res.status(anthropicRes.status).send(err);
    return;
  }

  const data = await anthropicRes.json();
  const text = data.content?.[0]?.text || "I'm here — something went quiet on my end. Try again?";

  res.status(200).json({ text });
}
