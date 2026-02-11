export interface Env {
  DB: D1Database;
  VOLC_APP_ID: string;
  VOLC_ACCESS_TOKEN: string;
  VOLC_SECRET_KEY: string;
  ARK_API_KEY: string;
  ARK_BASE_URL: string;
  JWT_SECRET: string;
  INIT_SECRET: string;
}

export interface Podcast {
  id: string;
  user_id: string;
  title: string;
  description: string;
  cover_url: string;
  audio_url: string;
  original_url: string;
  summary: string;
  transcript: string;
  duration: number;
  logs: string;
  status: 'pending' | 'parsing' | 'transcribing' | 'transcribe_polling' | 'summarizing' | 'completed' | 'failed';
  processing_step: string;
  transcription_task_id: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface PodcastInfo {
  title: string;
  description: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
}

export interface ProcessStatus {
  stage: 'pending' | 'parsing' | 'transcribing' | 'summarizing' | 'completed' | 'failed';
  progress: number;
  message: string;
}
