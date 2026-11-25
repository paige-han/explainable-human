/**
 * eXplainable Human — exhibition server (2022, refreshed 2026)
 *
 * Original: Express server that logged visitor answers to JSON files and called
 * OpenAI GPT-3 (text-davinci-002) + Naver Papago to expand and translate the
 * "ego profile" sentence.
 *
 * 2026 refresh:
 *  - API keys come from environment variables (.env), never from source code.
 *  - text-davinci-002 is retired, so generation uses the Chat Completions API
 *    with a configurable model (OPENAI_MODEL).
 *  - DEMO mode: with no keys at all, the piece still runs end-to-end using
 *    deterministic fallbacks, so anyone can clone and experience it.
 *  - 14 copy-pasted logging routes collapsed into one whitelisted route.
 *
 * Run:  npm install && npm start  →  http://127.0.0.1:3000
 */
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const PAPAGO_ID = process.env.PAPAGO_CLIENT_ID;
const PAPAGO_SECRET = process.env.PAPAGO_CLIENT_SECRET;
const LOG_RESPONSES = process.env.LOG_RESPONSES !== 'false';
const DEMO = !OPENAI_API_KEY;

let openai = null;
if (!DEMO) {
  const OpenAI = require('openai');
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
}

const app = express();
app.use(express.json());
app.use('/', express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'start.html')));

/* ------------------------------------------------------------------ */
/* 1. Visitor answer logging                                           */
/*    Each question posts its raw answer to /<field>. Answers are      */
/*    appended to app/data/<field>.json (git-ignored: visitor data     */
/*    must never be committed).                                        */
/* ------------------------------------------------------------------ */
const FIELDS = [
  'gender', 'age', 'home', 'degree', 'marriage', // Lv1 — demographic
  'love', 'hate', 'season', 'important', 'friend', // Lv2 — values (3 random)
  'data', 'color', 'percent', 'secret', // Lv3 — self-image
  'accuracy', // post-experience: "did it match you?"
];
const DATA_DIR = path.join(__dirname, 'data');

FIELDS.forEach((field) => {
  app.post(`/${field}`, (req, res) => {
    if (!LOG_RESPONSES) return res.send('success');
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const file = path.join(DATA_DIR, `${field}.json`);
      const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8') || '[]') : [];
      list.push(req.body.data);
      fs.writeFileSync(file, JSON.stringify(list, null, 0));
      res.send('success');
    } catch (err) {
      console.error(`[log:${field}]`, err.message);
      res.send('success'); // never block the visitor's experience on a logging error
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. Sentence expansion — rule-based profile → LLM paragraph          */
/* ------------------------------------------------------------------ */
// Same one-shot prompt the team used in 2022, kept verbatim.
function generateSentencePrompt(sentence) {
  return `Source: You are the person 100% pure, enjoying other people's attention and thinking of the world as your stage, honest with myself than anyone else.
Result: (1) You are the person 100% pure, enjoying other people's attention and thinking of the world as your stage, honest with myself than anyone else. (2) You are confident and enjoy being the center of attention. (3) You are honest with yourself and others, and you have a strong sense of self. (4) You are independent and unique, and you think of the world as your stage. (5) You are always learning and growing, and you are open to new experiences. (6) You are kind and compassionate, and you care about making a difference in the world. (7) You are a true individual, and you are always true to yourself.

Source: ${sentence}
Result:`;
}

function demoExpansion(sentence) {
  return ` (1) ${sentence} (2) You notice more than you say out loud. (3) You hold your own story carefully, and share it only when it feels true. (4) You are still becoming who you are.`;
}

app.post('/generate', async (req, res) => {
  const sentence = req.body.sentence || '';
  if (DEMO) return res.json({ result: demoExpansion(sentence) });
  try {
    const r = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 1,
      max_tokens: 500,
      messages: [
        { role: 'system', content: 'Continue the pattern exactly. Output only the numbered "Result" list, (1) to (7).' },
        { role: 'user', content: generateSentencePrompt(sentence) },
      ],
    });
    res.json({ result: r.choices[0].message.content });
  } catch (err) {
    console.error('[generate]', err.message);
    res.json({ result: demoExpansion(sentence) });
  }
});

/* ------------------------------------------------------------------ */
/* 3. "What color is your inner self?" → HEX                            */
/* ------------------------------------------------------------------ */
const DEMO_COLORS = [
  [['빨', '붉', 'red'], 'D7263D'], [['주황', 'orange'], 'F46036'], [['노랑', '노란', 'yellow'], 'F2C14E'],
  [['초록', 'green'], '2E933C'], [['청록', 'teal', 'turquoise'], '1B998B'], [['남색', '군청', 'navy'], '1D2D6B'],
  [['파랑', '파란', '푸른', '청색', 'blue'], '2E86DE'], [['보라', 'purple', 'violet'], '7B2CBF'],
  [['분홍', '핑크', 'pink'], 'F7A1C4'], [['검', '블랙', 'black'], '111111'], [['흰', '하얀', '화이트', 'white'], 'F5F5F5'],
  [['회색', 'gray', 'grey'], '8D8D8D'], [['갈색', 'brown'], '7F5539'],
];
function demoColor(text = '') {
  const t = text.toLowerCase();
  const hit = DEMO_COLORS.find(([keys]) => keys.some((k) => t.includes(k)));
  return hit ? hit[1] : '6C5B7B';
}

app.post('/get_color', async (req, res) => {
  const color = req.body.color || '';
  if (DEMO) return res.json({ result: demoColor(color) });
  try {
    const r = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 10,
      messages: [
        { role: 'system', content: 'Reply with a single 6-digit hex color code only, no #, no words.' },
        { role: 'user', content: `The CSS code for a color like ${color}\nbackground-color: #` },
      ],
    });
    res.json({ result: r.choices[0].message.content.trim() });
  } catch (err) {
    console.error('[get_color]', err.message);
    res.json({ result: demoColor(color) });
  }
});

/* ------------------------------------------------------------------ */
/* 4. Translation (ko ↔ en)                                             */
/*    Papago if configured (as in 2022) → else the LLM → else passthrough */
/*    Response keeps Papago's shape: { message: { result: { translatedText } } } */
/* ------------------------------------------------------------------ */
const papagoShape = (text) => ({ message: { result: { translatedText: text } } });

app.post('/translate', async (req, res) => {
  const { sentence = '', source = 'en', target = 'ko' } = req.body;
  try {
    if (PAPAGO_ID && PAPAGO_SECRET) {
      const r = await fetch('https://naveropenapi.apigw.ntruss.com/nmt/v1/translation', {
        method: 'POST',
        headers: {
          'X-NCP-APIGW-API-KEY-ID': PAPAGO_ID,
          'X-NCP-APIGW-API-KEY': PAPAGO_SECRET,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: new URLSearchParams({ source, target, text: sentence }),
      });
      if (r.ok) return res.json(await r.json());
    }
    if (!DEMO) {
      const lang = { ko: 'Korean', en: 'English' };
      const r = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: `Translate from ${lang[source] || source} to ${lang[target] || target}. Keep line breaks. Output only the translation.` },
          { role: 'user', content: sentence },
        ],
      });
      return res.json(papagoShape(r.choices[0].message.content));
    }
  } catch (err) {
    console.error('[translate]', err.message);
  }
  res.json(papagoShape(sentence)); // demo / failure: show the original text
});

app.listen(PORT, () => {
  console.log(`eXplainable Human → http://127.0.0.1:${PORT}`);
  console.log(DEMO ? '  DEMO mode (no OPENAI_API_KEY): deterministic fallbacks' : `  LLM: ${OPENAI_MODEL}`);
  console.log(`  Logging visitor answers: ${LOG_RESPONSES ? 'on → app/data/' : 'off'}`);
});
