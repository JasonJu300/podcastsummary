import type { Env } from '../types';

// 火山方舟 LLM API
const DEFAULT_MODEL = 'ep-20260116190645-55rqn'; // Doubao model

// Max characters per segment (approx 6k tokens)
const MAX_SEGMENT_CHARS = 12000;

export async function summarizeTranscript(transcript: string, env: Env): Promise<string | null> {
  try {
    // For long transcripts, split and summarize in segments
    if (transcript.length > MAX_SEGMENT_CHARS) {
      return await summarizeLongTranscript(transcript, env);
    }

    return await callLLM(transcript, getMainPrompt(), env);
  } catch (error) {
    console.error('Summarization error:', error);
    return null;
  }
}

async function summarizeLongTranscript(transcript: string, env: Env): Promise<string | null> {
  // Split into segments
  const segments = splitIntoSegments(transcript, MAX_SEGMENT_CHARS);
  const segmentSummaries: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const prompt = `这是一段播客转录文本的第 ${i + 1}/${segments.length} 部分。请提取这部分的关键内容和要点：\n\n${segments[i]}`;
    const summary = await callLLM(prompt, '你是一个播客内容分析助手，请提取输入文本的关键信息和要点。', env);
    if (summary) {
      segmentSummaries.push(summary);
    }
  }

  if (segmentSummaries.length === 0) return null;

  // Merge segment summaries into final summary
  const combined = segmentSummaries.join('\n\n---\n\n');
  const mergePrompt = `以下是一个播客各段落的要点摘要，请将它们整合为一篇完整的结构化摘要文章：\n\n${combined}`;
  return await callLLM(mergePrompt, getMainPrompt(), env);
}

function splitIntoSegments(text: string, maxChars: number): string[] {
  const segments: string[] = [];
  const lines = text.split('\n');
  let current = '';

  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars && current.length > 0) {
      segments.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  if (current) segments.push(current);
  return segments;
}

function getMainPrompt(): string {
  return '你是一个专业的播客内容分析师，擅长提取关键信息并生成结构化的摘要文章。请用 Markdown 格式输出。';
}

async function callLLM(content: string, systemPrompt: string, env: Env): Promise<string | null> {
  const prompt = content.includes('请按照以下格式输出') ? content : `请对以下播客内容进行总结，生成一篇结构化的摘要文章：

${content}

请按照以下格式输出：

## 📌 核心观点
（列出 3-5 个核心观点，用简洁有力的语言）

## 📝 内容摘要
（详细的段落摘要，包含主要讨论内容和见解，分多个段落）

## 💡 关键要点
（列出关键要点和可执行的建议，使用有序列表）

## 🎯 适合人群
（描述这个播客适合哪些听众）

请用中文输出，保持专业但易读的写作风格。使用 Markdown 格式。`;

  const response = await fetch(`${env.ARK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.ARK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('LLM API error:', response.status, error);
    return null;
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content || null;
}
