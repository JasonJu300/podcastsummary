import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, ProcessStatus } from './types';
import { hashPassword, verifyPassword, generateToken, verifyToken, getAuthToken } from './utils/auth';
import { parseXiaoyuzhouUrl } from './utils/parser';
import { submitTranscription, queryTranscription } from './utils/transcription';
import { summarizeTranscript } from './utils/summarizer';

type HonoEnv = {
  Bindings: Env;
  Variables: {
    user: { userId: string; username: string };
  };
};

const app = new Hono<HonoEnv>();

// Enable CORS
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'podcast-summarizer' }));

// ============ Auth Routes ============

app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const db = c.env.DB;
  const user = await db.prepare(
    'SELECT * FROM users WHERE username = ?'
  ).bind(username).first();

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const isValid = await verifyPassword(password, user.password_hash as string);
  if (!isValid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await generateToken(user.id as string, user.username as string, c.env);

  return c.json({
    userId: user.id,
    username: user.username,
    token,
  });
});

// ============ Auth Middleware ============

// ============ Auth Middleware (No-Auth Mode) ============

async function authMiddleware(c: any, next: any) {
  // In No-Auth mode, we bypass token check and inject a guest user
  // This allows the frontend to work without login, while keeping backend logic (user_id) intact
  const guestUser = {
    userId: 'guest-user',
    username: 'guest'
  };

  c.set('user', guestUser);
  await next();
}

// ============ Podcast Routes ============

// List all podcasts for user
app.get('/api/podcasts', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const podcasts = await db.prepare(
    'SELECT id, user_id, original_url, title, description, cover_url, audio_url, summary, duration, status, created_at, updated_at FROM podcasts WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.userId).all();

  return c.json({ podcasts: podcasts.results });
});

// Submit new podcast URL
app.post('/api/podcasts', authMiddleware, async (c) => {
  const user = c.get('user');
  const { url } = await c.req.json();

  if (!url) {
    return c.json({ error: 'URL is required' }, 400);
  }

  // Validate URL format
  if (!url.includes('xiaoyuzhoufm.com/episode/')) {
    return c.json({ error: '请提供有效的小宇宙播客链接' }, 400);
  }

  const db = c.env.DB;
  const id = crypto.randomUUID();

  await db.prepare(
    `INSERT INTO podcasts (id, user_id, original_url, status, processing_step, created_at, updated_at) 
     VALUES (?, ?, ?, 'pending', 'init', datetime('now'), datetime('now'))`
  ).bind(id, user.userId, url).run();

  // Start first step in background
  c.executionCtx.waitUntil(processStep(id, c.env));

  return c.json({ id, status: 'pending' });
});

// Get podcast status
app.get('/api/podcasts/:id/status', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const db = c.env.DB;

  const podcast = await db.prepare(
    'SELECT status, logs, processing_step FROM podcasts WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first();

  if (!podcast) {
    return c.json({ error: 'Not found' }, 404);
  }

  const status: ProcessStatus = {
    stage: mapStatusToStage(podcast.status as string),
    progress: getProgress(podcast.status as string),
    message: getStatusMessage(podcast.status as string, podcast.logs as string),
  };

  // If processing is in a pollable state, trigger next step
  if (['pending', 'transcribe_polling'].includes(podcast.status as string)) {
    c.executionCtx.waitUntil(processStep(id, c.env));
  }

  return c.json({ status });
});

// Reprocess a failed podcast
app.post('/api/podcasts/:id/reprocess', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const db = c.env.DB;

  const podcast = await db.prepare(
    'SELECT * FROM podcasts WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first();

  if (!podcast) {
    return c.json({ error: 'Not found' }, 404);
  }

  if (podcast.status !== 'failed') {
    return c.json({ error: 'Only failed podcasts can be reprocessed' }, 400);
  }

  // Reset to pending
  await db.prepare(
    `UPDATE podcasts SET status = 'pending', processing_step = 'init', logs = '', 
     transcription_task_id = '', updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run();

  c.executionCtx.waitUntil(processStep(id, c.env));

  return c.json({ status: 'pending' });
});

// Delete podcast
app.delete('/api/podcasts/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const db = c.env.DB;

  await db.prepare(
    'DELETE FROM podcasts WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).run();

  return c.json({ success: true });
});

// ============ Step-based Processing ============

async function processStep(id: string, env: Env) {
  const db = env.DB;

  const podcast = await db.prepare(
    'SELECT * FROM podcasts WHERE id = ?'
  ).bind(id).first();

  if (!podcast) return;

  const status = podcast.status as string;
  const step = podcast.processing_step as string;

  try {
    if (status === 'pending' && step === 'init') {
      await stepParse(id, podcast, env);
    } else if (status === 'transcribing' && step === 'submit_transcription') {
      await stepSubmitTranscription(id, podcast, env);
    } else if (status === 'transcribe_polling' && step === 'poll_transcription') {
      await stepPollTranscription(id, podcast, env);
    } else if (status === 'summarizing' && step === 'summarize') {
      await stepSummarize(id, podcast, env);
    }
  } catch (error) {
    await appendLog(db, id, `处理错误: ${error}`);
    await db.prepare(
      `UPDATE podcasts SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();
  }
}

async function stepParse(id: string, podcast: any, env: Env) {
  const db = env.DB;

  await db.prepare(
    `UPDATE podcasts SET status = 'parsing', updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run();

  await appendLog(db, id, '开始解析播客信息...');

  const info = await parseXiaoyuzhouUrl(podcast.original_url as string);

  if (!info) {
    await appendLog(db, id, '无法解析播客页面，请检查链接是否有效');
    await db.prepare(
      `UPDATE podcasts SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();
    return;
  }

  await appendLog(db, id, `解析成功: ${info.title}`);

  if (!info.audioUrl) {
    await appendLog(db, id, '无法获取音频链接');
    await db.prepare(
      `UPDATE podcasts SET status = 'failed', title = ?, description = ?, cover_url = ?,
       updated_at = datetime('now') WHERE id = ?`
    ).bind(info.title, info.description, info.coverUrl, id).run();
    return;
  }

  await db.prepare(
    `UPDATE podcasts SET title = ?, description = ?, cover_url = ?, audio_url = ?, duration = ?,
     status = 'transcribing', processing_step = 'submit_transcription',
     updated_at = datetime('now') WHERE id = ?`
  ).bind(info.title, info.description, info.coverUrl, info.audioUrl, info.duration, id).run();

  // Continue to next step immediately
  await stepSubmitTranscription(id, { ...podcast, audio_url: info.audioUrl }, env);
}

async function stepSubmitTranscription(id: string, podcast: any, env: Env) {
  const db = env.DB;
  await appendLog(db, id, '正在提交音频转录任务...');

  const taskId = await submitTranscription(podcast.audio_url as string, env);

  if (!taskId) {
    await appendLog(db, id, '提交转录任务失败');
    await db.prepare(
      `UPDATE podcasts SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();
    return;
  }

  await appendLog(db, id, `转录任务已提交，taskId: ${taskId}`);
  await db.prepare(
    `UPDATE podcasts SET transcription_task_id = ?, status = 'transcribe_polling',
     processing_step = 'poll_transcription', updated_at = datetime('now') WHERE id = ?`
  ).bind(taskId, id).run();
}

async function stepPollTranscription(id: string, podcast: any, env: Env) {
  const db = env.DB;
  const taskId = podcast.transcription_task_id as string;

  if (!taskId) {
    await appendLog(db, id, '无转录任务ID');
    await db.prepare(
      `UPDATE podcasts SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();
    return;
  }

  const result = await queryTranscription(taskId, env);

  if (result.state === 'SUCCESS') {
    await appendLog(db, id, `转录完成，文本长度: ${result.text?.length || 0}`);
    await db.prepare(
      `UPDATE podcasts SET transcript = ?, status = 'summarizing', processing_step = 'summarize',
       updated_at = datetime('now') WHERE id = ?`
    ).bind(result.text, id).run();

    // Continue to summarize immediately
    await stepSummarize(id, { ...podcast, transcript: result.text }, env);
  } else if (result.state === 'FAILED') {
    await appendLog(db, id, '音频转录失败');
    await db.prepare(
      `UPDATE podcasts SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();
  }
  // if RUNNING/PENDING, do nothing — frontend will poll again and trigger another check
}

async function stepSummarize(id: string, podcast: any, env: Env) {
  const db = env.DB;
  const transcript = podcast.transcript as string;

  if (!transcript) {
    await appendLog(db, id, '无转录文本可供摘要');
    await db.prepare(
      `UPDATE podcasts SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();
    return;
  }

  await appendLog(db, id, '正在生成摘要...');

  const summary = await summarizeTranscript(transcript, env);

  if (!summary) {
    await appendLog(db, id, '摘要生成失败');
    await db.prepare(
      `UPDATE podcasts SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();
    return;
  }

  await appendLog(db, id, '摘要生成完成');
  await db.prepare(
    `UPDATE podcasts SET summary = ?, status = 'completed', updated_at = datetime('now') WHERE id = ?`
  ).bind(summary, id).run();
}

async function appendLog(db: D1Database, id: string, message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  await db.prepare(
    `UPDATE podcasts SET logs = CASE 
       WHEN logs IS NULL OR logs = '' THEN ? 
       ELSE logs || char(10) || ? 
     END, updated_at = datetime('now') WHERE id = ?`
  ).bind(logEntry, logEntry, id).run();
}

// ============ Status Helpers ============

function mapStatusToStage(status: string): ProcessStatus['stage'] {
  switch (status) {
    case 'pending': return 'pending';
    case 'parsing': return 'parsing';
    case 'transcribing':
    case 'transcribe_polling': return 'transcribing';
    case 'summarizing': return 'summarizing';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    default: return 'pending';
  }
}

function getProgress(status: string): number {
  switch (status) {
    case 'pending': return 5;
    case 'parsing': return 15;
    case 'transcribing': return 30;
    case 'transcribe_polling': return 50;
    case 'summarizing': return 80;
    case 'completed': return 100;
    case 'failed': return 0;
    default: return 0;
  }
}

function getStatusMessage(status: string, logs?: string): string {
  switch (status) {
    case 'pending': return '等待处理...';
    case 'parsing': return '正在解析播客信息...';
    case 'transcribing': return '正在提交转录任务...';
    case 'transcribe_polling': return '正在进行语音转录（可能需要几分钟）...';
    case 'summarizing': return '正在生成 AI 摘要...';
    case 'completed': return '摘要生成完成！';
    case 'failed': {
      // Extract last log line for error details
      if (logs) {
        const lines = logs.split('\n');
        const lastLine = lines[lines.length - 1] || '';
        const msg = lastLine.replace(/^\[.*?\]\s*/, '');
        return msg || '处理失败，请重试';
      }
      return '处理失败，请重试';
    }
    default: return '等待处理...';
  }
}

// ============ DB Init (protected) ============

// Debug Auth (Temporary)
app.get('/api/debug-auth', async (c) => {
  const secret = c.req.query('secret');
  if (!secret || secret !== c.env.INIT_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = c.env.DB;
  const password = 'admin123';

  // 1. Test Hash/Verify Logic in current env
  const testHash = await hashPassword(password);
  const verifySelf = await verifyPassword(password, testHash);

  // 2. Check DB Content
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind('admin').first();

  let verifyDb = false;
  let dbHash = null;

  if (user) {
    dbHash = user.password_hash as string;
    verifyDb = await verifyPassword(password, dbHash);
  }

  return c.json({
    env_check: {
      generated_hash: testHash,
      verify_self_result: verifySelf, // Should be true
    },
    db_check: {
      user_exists: !!user,
      stored_hash_len: dbHash ? dbHash.length : 0,
      verify_db_result: verifyDb, // Should be true
      stored_hash_preview: dbHash ? dbHash.substring(0, 10) + '...' : null
    }
  });
});

app.get('/api/init', async (c) => {
  // Require secret for init
  const secret = c.req.query('secret');
  if (!secret || secret !== c.env.INIT_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = c.env.DB;

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS podcasts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      description TEXT,
      cover_url TEXT,
      audio_url TEXT,
      original_url TEXT NOT NULL,
      summary TEXT,
      transcript TEXT,
      duration INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      processing_step TEXT DEFAULT '',
      transcription_task_id TEXT DEFAULT '',
      logs TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();

  // Create default guest user (for no-auth mode)
  // use INSERT OR IGNORE to avoid error if exists
  await db.prepare(
    `INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)`
  ).bind('guest-user', 'guest', 'nopass').run();

  // Create default user (admin/admin123)
  const existingUser = await db.prepare(
    'SELECT * FROM users WHERE username = ?'
  ).bind('admin').first();

  if (!existingUser) {
    const hashedPassword = await hashPassword('admin123');
    await db.prepare(
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)'
    ).bind(crypto.randomUUID(), 'admin', hashedPassword).run();
  } else {
    // Force reset password if user exists
    const hashedPassword = await hashPassword('admin123');
    await db.prepare(
      'UPDATE users SET password_hash = ? WHERE username = ?'
    ).bind(hashedPassword, 'admin').run();
  }

  return c.json({ message: 'Database initialized' });
});

export default app;
