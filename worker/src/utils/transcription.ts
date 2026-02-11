import type { Env } from '../types';

// 火山引擎语音识别 API
// 拆分为 submit 和 query 两个独立函数，支持分步处理

export async function submitTranscription(audioUrl: string, env: Env): Promise<string | null> {
  try {
    const submitResponse = await fetch('https://openspeech.bytedance.com/api/v1/auc/bigmodel/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.VOLC_ACCESS_TOKEN}`,
        'X-App-Id': env.VOLC_APP_ID,
      },
      body: JSON.stringify({
        appid: env.VOLC_APP_ID,
        secret_key: env.VOLC_SECRET_KEY,
        audio_url: audioUrl,
        language: 'zh-CN',
        enable_punctuation: true,
        enable_word_time: false,
      }),
    });

    if (!submitResponse.ok) {
      const error = await submitResponse.text();
      console.error('Transcription submit error:', submitResponse.status, error);
      return null;
    }

    const submitData = await submitResponse.json() as { task_id?: string; id?: string };
    const taskId = submitData.task_id || submitData.id;

    if (!taskId) {
      console.error('No task ID returned:', JSON.stringify(submitData));
      return null;
    }

    return taskId;
  } catch (error) {
    console.error('Transcription submit exception:', error);
    return null;
  }
}

export interface TranscriptionResult {
  state: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING';
  text?: string;
}

export async function queryTranscription(taskId: string, env: Env): Promise<TranscriptionResult> {
  try {
    const queryResponse = await fetch('https://openspeech.bytedance.com/api/v1/auc/bigmodel/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.VOLC_ACCESS_TOKEN}`,
        'X-App-Id': env.VOLC_APP_ID,
      },
      body: JSON.stringify({
        appid: env.VOLC_APP_ID,
        secret_key: env.VOLC_SECRET_KEY,
        task_id: taskId,
      }),
    });

    if (!queryResponse.ok) {
      console.error('Transcription query error:', queryResponse.status);
      return { state: 'RUNNING' }; // Treat network errors as still running
    }

    const queryData = await queryResponse.json() as {
      state?: string;
      utterances?: Array<{ text: string }>;
    };

    if (queryData.state === 'SUCCESS') {
      const utterances = queryData.utterances || [];
      const text = utterances.map(u => u.text).join('\n');
      return { state: 'SUCCESS', text };
    } else if (queryData.state === 'FAILED') {
      return { state: 'FAILED' };
    }

    return { state: 'RUNNING' };
  } catch (error) {
    console.error('Transcription query exception:', error);
    return { state: 'RUNNING' };
  }
}
