// scripts/generate-content.js
// Runs once a day via GitHub Actions, alongside generate-vocab.js.
// Calls OpenAI four times (reading / listening / speaking / writing) and writes
// data/daily-reading.json, data/daily-listening.json, data/daily-speaking.json,
// data/daily-writing.json. These files are OVERWRITTEN each day (unlike
// word-bank.json, which accumulates) because they represent "today's practice set".

import fs from 'fs';
import path from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable.');
  process.exit(1);
}

const DATA_DIR = path.join(process.cwd(), 'data');

async function callOpenAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8
    })
  });
  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/* ---------- READING ---------- */
async function generateReading() {
  const prompt = `You are creating TOEFL iBT (2026 adaptive format) reading practice content for one day.
Return ONLY a raw JSON object, no markdown, in this exact schema:

{
  "cloze": {
    "segments": [ {"text":"..."} , {"blank":"answeredSuffix"} , {"text":"..."} , ... ]
  },
  "academic": {
    "passage": "a ~200 word academic passage on any university-level topic",
    "questions": [ {"q":"...", "options":["...","...","...","..."], "correctIndex":0, "explain":"short Traditional Chinese explanation of why this is correct"} ]
  },
  "daily": {
    "passage": "a short (~60 word) campus notice / announcement style text",
    "questions": [ {"q":"...", "options":["...","...","...","..."], "correctIndex":0, "explain":"short Traditional Chinese explanation"} ]
  }
}

Rules:
- "cloze.segments" must alternate readable text chunks and blanks. Each blank's "blank" value is the part of the word the learner must type. For variety, MIX two styles across the ~9 blanks: (a) prefix-hint style — the preceding "text" chunk ends with the word's first few letters, and "blank" is the rest of the word (e.g. text ends "...sur", blank "face" for "surface"); (b) suffix-hint style — the "blank" is the first part of the word, and the FOLLOWING "text" chunk starts with the word's last few letters (e.g. blank "proce", next text starts "ss..." for "process"). Use roughly half of each style, not all prefix-hint. Build one coherent ~120 word passage about any academic topic (water cycle, coral reefs, and dog domestication have already been used — pick a different topic).
- "academic.questions" must have exactly 4 items: one main-idea, one detail, one inference, one vocabulary-in-context question.
- "daily.questions" must have exactly 2 detail questions.
- All "options" arrays must have exactly 4 items, with "correctIndex" pointing to the correct one.
- Keep passages original and at a register typical of TOEFL reading (not overly difficult).`;

  return await callOpenAI(prompt);
}

/* ---------- LISTENING ---------- */
async function generateListening() {
  const prompt = `You are creating TOEFL iBT (2026 adaptive format) listening practice content for one day, as TEXT TRANSCRIPTS (no audio).
Return ONLY a raw JSON object, no markdown, in this exact schema:

{
  "chooseResponse": [
    {"q":"a short spoken statement or question (~5-10 words)", "options":["...","...","...","..."], "correctIndex":0}
  ],
  "conversation": {
    "transcript": "a short campus conversation between two speakers, formatted as alternating lines like 'Student: ...\\nAdvisor: ...'",
    "questions": [ {"q":"...", "options":["...","...","...","..."], "correctIndex":0, "explain":"short Traditional Chinese explanation"} ]
  },
  "announcement": {
    "transcript": "a short (~50-80 word) campus or public announcement",
    "questions": [ {"q":"...", "options":["...","...","...","..."], "correctIndex":0, "explain":"short Traditional Chinese explanation"} ]
  },
  "talk": {
    "transcript": "a short (~150 word) academic mini-lecture explaining one concept",
    "questions": [ {"q":"...", "options":["...","...","...","..."], "correctIndex":0, "explain":"short Traditional Chinese explanation"} ]
  }
}

Rules:
- "chooseResponse" must have exactly 4 items, each testing natural conversational reply choice.
- "conversation.questions" exactly 2 items, "announcement.questions" exactly 2 items, "talk.questions" exactly 4 items.
- All "options" arrays exactly 4 items.
- Use a different topic/scenario than: switching majors to Computer Science, a shuttle schedule change, or the "mere exposure effect" in psychology — pick something new each time.`;

  return await callOpenAI(prompt);
}

/* ---------- SPEAKING ---------- */
async function generateSpeaking() {
  const prompt = `You are creating TOEFL iBT (2026 format) speaking practice content for one day.
The new Speaking section has two task types: "Listen and Repeat" (short sentence, no prep time, repeat exactly) and "Take an Interview" (a SINGLE simulated interview topic with FOUR CONNECTED questions on that same topic, no prep time, 45 seconds per answer — the four questions typically progress: personal experience -> a related aspect or challenge -> opinion -> recommendation/advice).
Return ONLY a raw JSON object, no markdown, in this exact schema:

{
  "shadowSentences": [ "short natural English sentence (6-12 words)", ... ],
  "interviewScenarios": [
    {
      "topic": "short Traditional Chinese label for the topic, e.g. 通勤習慣",
      "intro": "one English sentence introducing the simulated interview, e.g. 'You have agreed to take part in a research study about ___.'",
      "questions": [
        "Q1: about personal experience related to the topic",
        "Q2: about a related aspect, detail, or challenge",
        "Q3: asking for an opinion on the topic",
        "Q4: asking for a recommendation, prediction, or advice related to the topic"
      ]
    }
  ]
}

Rules:
- "shadowSentences": exactly 10 sentences, simple to medium difficulty, natural spoken English (not academic essay style), increasing slightly in length.
- "interviewScenarios": exactly 3 scenarios, each with EXACTLY 4 questions following the experience -> aspect/challenge -> opinion -> recommendation progression. Use varied everyday/academic topics (commuting, technology, social media, study habits, city life, hobbies, etc.) — don't reuse: commuting habits, urban life, smartphone usage, summer camp planning, study habits, or social media habits (these are already covered by the static fallback set, so pick different topics).`;

  return await callOpenAI(prompt);
}

/* ---------- WRITING ---------- */
async function generateWriting() {
  const prompt = `You are creating TOEFL iBT (2026 format) writing practice content for one day.
The new Writing section has three task types: "Build a Sentence" (rearrange given words into a correct sentence), "Write an Email" (respond to a scenario), and "Write for an Academic Discussion" (reply to a professor's discussion prompt).
Return ONLY a raw JSON object, no markdown, in this exact schema:

{
  "buildSentences": [
    { "words": ["lowercase","word","tokens","in","correct","order","no","punctuation"], "display": "The properly capitalized and punctuated reference sentence." }
  ],
  "emailPrompts": [ "a short Traditional-Chinese description of an email-writing scenario" ],
  "discussionPrompts": [ "教授問：「...」" ]
}

Rules:
- "buildSentences": exactly 8 items. Each "words" array must be the CORRECT lowercase word order with NO punctuation (8-16 words long), and "display" is the same sentence properly capitalized and punctuated.
- "emailPrompts": exactly 6 items, varied scenarios (professor, dorm office, library, club, customer service, etc.), written in Traditional Chinese, mirroring this style: "寄信給教授，說明因病無法參加期中考，詢問補考事宜。".
- "discussionPrompts": exactly 6 items, in Traditional Chinese, formatted exactly like: 教授問：「...」, covering varied academic/social debate topics.`;

  return await callOpenAI(prompt);
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const tasks = [
    { name: 'reading', fn: generateReading, file: 'daily-reading.json' },
    { name: 'listening', fn: generateListening, file: 'daily-listening.json' },
    { name: 'speaking', fn: generateSpeaking, file: 'daily-speaking.json' },
    { name: 'writing', fn: generateWriting, file: 'daily-writing.json' }
  ];

  for (const task of tasks) {
    try {
      const data = await task.fn();
      fs.writeFileSync(path.join(DATA_DIR, task.file), JSON.stringify(data, null, 2));
      console.log(`✓ ${task.name} updated -> ${task.file}`);
    } catch (err) {
      // If one section fails (bad JSON from the model, rate limit, etc.), don't block the others.
      console.error(`✗ ${task.name} failed:`, err.message);
    }
  }
}

main();
