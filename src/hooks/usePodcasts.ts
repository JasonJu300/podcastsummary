import { useState, useEffect, useCallback } from 'react';
import type { PodcastSummary, ProcessStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export function usePodcasts(token: string | null) {
  const [podcasts, setPodcasts] = useState<PodcastSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPodcasts = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/podcasts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json() as { podcasts: any[] };
      // Map snake_case from DB to camelCase
      setPodcasts((data.podcasts || []).map((p: any) => ({
        id: p.id,
        title: p.title || '',
        description: p.description || '',
        coverUrl: p.cover_url || p.coverUrl || '',
        audioUrl: p.audio_url || p.audioUrl || '',
        originalUrl: p.original_url || p.originalUrl || '',
        summary: p.summary || '',
        transcript: p.transcript || '',
        duration: p.duration || 0,
        createdAt: p.created_at || p.createdAt || '',
        status: p.status || 'pending',
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPodcasts();
  }, [fetchPodcasts]);

  const submitPodcast = useCallback(async (url: string): Promise<string | null> => {
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/podcasts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || 'Submit failed');
      }

      const data = await response.json() as { id: string };
      return data.id;
    } catch (err) {
      console.error('Submit error:', err);
      return null;
    }
  }, [token]);

  const checkStatus = useCallback(async (id: string): Promise<ProcessStatus | null> => {
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/podcasts/${id}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return null;

      const data = await response.json() as { status: ProcessStatus };
      return data.status;
    } catch {
      return null;
    }
  }, [token]);

  const deletePodcast = useCallback(async (id: string) => {
    if (!token) return;

    try {
      await fetch(`${API_BASE_URL}/api/podcasts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      setPodcasts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  }, [token]);

  const reprocessPodcast = useCallback(async (id: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/podcasts/${id}/reprocess`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setPodcasts(prev => prev.map(p =>
          p.id === id ? { ...p, status: 'pending' as const } : p
        ));
        // Refresh after a short delay
        setTimeout(() => fetchPodcasts(), 2000);
      }
    } catch (err) {
      console.error('Reprocess error:', err);
    }
  }, [token, fetchPodcasts]);

  return { podcasts, isLoading, error, fetchPodcasts, submitPodcast, checkStatus, deletePodcast, reprocessPodcast };
}
