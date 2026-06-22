// scripts/generate-vocab.js
// Runs once a day via GitHub Actions. Calls OpenAI, appends new (deduped) words
// to data/word-bank.json, and writes data/last-updated.json for the UI to display.
//
// Requires Node 18+ (for global fetch). The GitHub Actions workflow sets up Node 20.

import fs from 'fs';
import path from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable. Did you add it to repo Secrets?');
  process.exit(1);
}

// Rotate through themes by day-of-year so content stays varied without manual scheduling.
const THEMES = [
  'environmental science',
  'economics',
  'psychology',
  'technology and innovation',
  'history',
  'linguistics',
  'art and architecture',
  'biology',
  'sociology',
  'astronomy and space science',
  'philosophy',
  'public health',
  'political science',
  'anthropology'
];

const WORDS_PER_DAY = 40;
const BANK_PATH = path.join(process.cwd(), 'data', 'word-bank.json');
const META_PATH = path.join(process.cwd(), 'data', 'last-updated.json');

function loadBank() {
  try {
    return JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

async function main() {
  const bank = loadBank();
  const existing = new Set(bank.map(w => (w.word || '').toLowerCase()));

  const today = new Date();
  const theme = THEMES[dayOfYear(today) % THEMES.length];

  const prompt = `Generate ${WORDS_PER_DAY} TOEFL-level academic English vocabulary words related to the theme "${theme}".
Return ONLY a raw JSON array, no markdown, no preamble, no explanation — just the array, in this exact schema:
[{"word":"...", "pos":"adj./n./v./adv.", "root":"short root breakdown in Chinese+English, or \\"—\\" if not a clear root pattern", "zh":"Traditional Chinese meaning", "ex":"one academic-style English example sentence"}]
All ${WORDS_PER_DAY} words must be different from each other, genuinely useful in academic reading/listening contexts, and not extremely obscure or archaic.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });

  if (!res.ok) {
    console.error('OpenAI API error:', res.status, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const clean = text.replace(/```json|```/g, '').trim();

  let words;
  try {
    words = JSON.parse(clean);
  } catch (e) {
    console.error('Failed to parse model output as JSON:\n', text);
    process.exit(1);
  }

  const catName = `📰 每日新詞：${theme}`;
  const fresh = words
    .filter(w => w && w.word && !existing.has(String(w.word).toLowerCase()))
    .map(w => ({ ...w, cat: catName }));

  const updatedBank = bank.concat(fresh);

  fs.mkdirSync(path.dirname(BANK_PATH), { recursive: true });
  fs.writeFileSync(BANK_PATH, JSON.stringify(updatedBank, null, 2));
  fs.writeFileSync(META_PATH, JSON.stringify({
    lastUpdated: today.toISOString(),
    theme,
    added: fresh.length,
    totalWords: updatedBank.length
  }, null, 2));

  console.log(`Added ${fresh.length} new words on theme "${theme}". Bank size is now ${updatedBank.length}.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
