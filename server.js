'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const { MAGI } = require('./prompts');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

function normalizeVote(raw) {
  const v = String(raw || '').trim();
  if (v === '赞成' || v === '反对' || v === '保留') return v;
  const lower = v.toLowerCase();
  if (['approve', 'yes', 'for', 'agree', '赞成'].includes(lower)) return '赞成';
  if (['oppose', 'no', 'against', 'disagree', '反对'].includes(lower)) return '反对';
  return '保留';
}

async function callDeepSeek(systemPrompt, question) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    const err = new Error('DEEPSEEK_API_KEY is not set');
    err.code = 'NO_KEY';
    throw err;
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`DeepSeek HTTP ${res.status}`);
    err.status = res.status;
    err.body = body.slice(0, 200);
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(content);
  if (!parsed) {
    return { vote: '保留', reason: '未能解析结构化回复', raw: content.slice(0, 120) };
  }
  return {
    vote: normalizeVote(parsed.vote),
    reason: String(parsed.reason || '无理由').slice(0, 80),
  };
}

function majorityDecision(votes) {
  const counts = { 赞成: 0, 反对: 0, 保留: 0 };
  for (const v of votes) {
    counts[v.vote] = (counts[v.vote] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topLabel, topCount] = entries[0];
  const secondCount = entries[1][1];
  // Majority = at least 2; if top is tied with second → 决议保留
  if (topCount >= 2 && topCount > secondCount) {
    return { decision: topLabel, tie: false, counts };
  }
  return { decision: '决议保留', tie: true, counts };
}

app.post('/api/vote', async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) {
    return res.status(400).json({ error: '请输入议题问题' });
  }
  if (question.length > 2000) {
    return res.status(400).json({ error: '问题过长（最多 2000 字）' });
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(503).json({
      error: '服务器未配置 DEEPSEEK_API_KEY，请在 .env 中设置后重启',
    });
  }

  try {
    const results = await Promise.all(
      MAGI.map(async (magi) => {
        const out = await callDeepSeek(magi.system, question);
        return {
          id: magi.id,
          name: magi.name,
          label: magi.label,
          vote: out.vote,
          reason: out.reason,
        };
      })
    );

    const { decision, tie, counts } = majorityDecision(results);
    return res.json({
      question,
      results,
      decision,
      tie,
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[magi] vote failed:', err.message, err.status || '', err.code || '');
    const status = err.code === 'NO_KEY' ? 503 : err.status && err.status < 500 ? 502 : 500;
    return res.status(status).json({
      error: 'MAGI 决议请求失败，请稍后重试',
    });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(process.env.DEEPSEEK_API_KEY),
    magi: MAGI.map((m) => m.name),
  });
});

app.listen(PORT, () => {
  console.log(`MAGI vote listening on http://localhost:${PORT}`);
  console.log(`DeepSeek key: ${process.env.DEEPSEEK_API_KEY ? 'configured' : 'MISSING'}`);
});
