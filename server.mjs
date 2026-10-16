#!/usr/bin/env node
/**
 * server.mjs — GameForge AI proxy & LLM router + static file server
 * Serves GameForge_AI_Studio_Pro.html at root and provides /api endpoints.
 * Node 18+ recommended
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PROVIDER = process.env.PROVIDER || 'openai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || '';
const APP_ACCESS_CODE = process.env.APP_ACCESS_CODE || '';
const DISABLE_RATE = (process.env.DISABLE_RATE_LIMIT || 'false').toLowerCase() === 'true';
const MODEL = process.env.MODEL || 'gpt-4o-mini';

const app = express();
app.use(helmet());
// Allow same-origin requests from the served site; still allow CORS for other origins if needed
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(morgan('tiny'));

if (!DISABLE_RATE) {
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.MAX_REQ_PER_MIN || 25),
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
} else {
  console.warn('Rate limiting is DISABLED — ensure you understand costs and abuse risk.');
}

// Serve the static UI file and assets from repo root (or /public if you prefer)
app.use(express.static(path.join(__dirname)));
// Route root to the HTML studio file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'GameForge_AI_Studio_Pro.html'));
});

app.get('/api/status', (req, res) => {
  res.json({
    ok: PROVIDER === 'openai' ? !!OPENAI_API_KEY : !!LOCAL_LLM_URL,
    configured: PROVIDER === 'openai' ? !!OPENAI_API_KEY : !!LOCAL_LLM_URL,
    provider: PROVIDER,
    model: PROVIDER === 'openai' ? MODEL : 'local-llm',
    accessCodeRequired: !!APP_ACCESS_CODE,
  });
});

async function streamOpenAIChat(res, messages, model, signal) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: 3000, temperature: 0.7, stream: true }),
    signal,
  });

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => '<no body>');
    throw new Error('Upstream OpenAI error: ' + upstream.status + ' — ' + txt.slice(0, 200));
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.replace(/^data:\s*/, '').trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      } catch (e) {
        // forward raw payload if parsing fails
        res.write(`data: ${JSON.stringify({ content: payload })}\n\n`);
      }
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
}

app.post('/api/generate', async (req, res) => {
  try {
    const providedCode = req.headers['x-gameforge-code'] || '';
    if (APP_ACCESS_CODE && providedCode !== APP_ACCESS_CODE) {
      return res.status(401).json({ error: 'Access code required or incorrect.' });
    }

    const { idea = '', gameType = '3D', style = 'stylized low-poly', unlimited = false } = req.body || {};
    if (!idea || idea.length < 8) {
      return res.status(400).json({ error: 'Idea too short' });
    }

    const system = {
      role: 'system',
      content: 'You are an expert game developer. Output only one single-file playable HTML document from <!doctype html> to </html>. No extra commentary, no markdown fences.',
    };

    const user = {
      role: 'user',
      content: `Create a compact, playable, single-file HTML5 game.\nType: ${gameType}\nStyle: ${style}\nIdea: ${idea}\nRequirements:\n- Single HTML file only, from <!doctype html> to </html>\n- Inline CSS/JS only\n- Include controls, score, start/restart\n- Keep it compact and robust\n- Prefer 2D canvas if 3D is not feasible\n- unlimited mode: ${unlimited ? 'true' : 'false'}`,
    };

    if (PROVIDER === 'openai') {
      if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Server not configured with OPENAI_API_KEY' });
      await streamOpenAIChat(res, [system, user], MODEL, req.signal);
      return;
    }

    // Local LLM path
    if (!LOCAL_LLM_URL) return res.status(500).json({ error: 'LOCAL_LLM_URL not configured' });

    const upstream = await fetch(LOCAL_LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: user.content, type: gameType, style, unlimited }),
      signal: req.signal,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '<no body>');
      return res.status(502).json({ error: 'Local LLM error', detail: text.slice(0, 1000) });
    }

    const ct = upstream.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await upstream.json();
      const html = data.html || data.output || data.result || '';
      return res.json({ html });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      res.write(`data: ${JSON.stringify({ content: buf })}\n\n`);
      buf = '';
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Generate error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message || String(err) }); else res.end();
  }
});

// Simple health endpoint
app.get('/healthz', (req, res) => res.json({ ok: true, provider: PROVIDER }));

app.listen(PORT, () => {
  console.log(`GameForge AI server listening on http://localhost:${PORT} (PROVIDER=${PROVIDER})`);
});
