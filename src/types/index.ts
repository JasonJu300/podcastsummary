export interface PodcastSummary {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  audioUrl: string;
  originalUrl: string;
  summary: string;
  transcript: string;
  duration: number;
  createdAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface User {
  id: string;
  username: string;
  token: string;
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
