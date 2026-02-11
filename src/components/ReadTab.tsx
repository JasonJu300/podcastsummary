import { useState } from 'react';
import { usePodcasts } from '../hooks/usePodcasts';
import { useAuth } from '../hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ReadTab() {
  const { user } = useAuth();
  const { podcasts, isLoading, deletePodcast, reprocessPodcast } = usePodcasts(user?.token || null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个播客摘要吗？')) {
      await deletePodcast(id);
    }
  };

  const handleReprocess = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await reprocessPodcast(id);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-ink-muted text-sm">加载中...</p>
      </div>
    );
  }

  if (podcasts.length === 0) {
    return (
      <div className="text-center py-16 sm:py-24 animate-fade-in">
        <div className="inline-flex w-20 h-20 rounded-3xl bg-paper-warm items-center justify-center mb-5">
          <span className="text-3xl">📚</span>
        </div>
        <h3 className="text-lg font-serif font-bold text-ink mb-2">
          还没有播客摘要
        </h3>
        <p className="text-ink-muted text-sm max-w-xs mx-auto">
          切换到"添加播客"标签页，粘贴小宇宙链接开始生成
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {podcasts.map((podcast, index) => {
        const isExpanded = expandedId === podcast.id;
        const statusBadge = getStatusBadge(podcast.status);

        return (
          <div
            key={podcast.id}
            className="glass-card overflow-hidden animate-fade-in cursor-pointer"
            style={{ animationDelay: `${index * 0.06}s` }}
            onClick={() => setExpandedId(isExpanded ? null : podcast.id)}
          >
            {/* Card Header */}
            <div className="p-5 sm:p-6">
              <div className="flex gap-4">
                {/* Cover */}
                {podcast.coverUrl ? (
                  <img
                    src={podcast.coverUrl}
                    alt=""
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0 shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-paper-warm flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🎙️</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-serif font-bold text-ink leading-snug line-clamp-2">
                        {podcast.title || '未命名播客'}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-ink-muted">{formatDate(podcast.createdAt)}</span>
                        {podcast.duration > 0 && (
                          <>
                            <span className="text-ink-muted/40">·</span>
                            <span className="text-xs text-ink-muted">{formatDuration(podcast.duration)}</span>
                          </>
                        )}
                        {statusBadge}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {podcast.status === 'failed' && (
                        <button
                          onClick={(e) => handleReprocess(podcast.id, e)}
                          className="p-2 text-ink-muted hover:text-accent rounded-lg hover:bg-accent/5 transition-all"
                          title="重新处理"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(podcast.id, e)}
                        className="p-2 text-ink-muted hover:text-error rounded-lg hover:bg-error/5 transition-all"
                        title="删除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Preview / Status */}
                  {podcast.status === 'completed' && podcast.summary && !isExpanded && (
                    <p className="mt-3 text-sm text-ink-muted line-clamp-2 leading-relaxed">
                      {podcast.summary.replace(/[#*>\-_`]/g, '').substring(0, 150)}...
                    </p>
                  )}

                  {(podcast.status === 'processing' || podcast.status === 'pending') && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-[1.5px] border-accent border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-accent">正在处理中...</span>
                    </div>
                  )}

                  {podcast.status === 'failed' && (
                    <p className="mt-3 text-xs text-error">
                      处理失败 — 点击重试按钮重新处理
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Summary */}
            {isExpanded && podcast.status === 'completed' && podcast.summary && (
              <div className="border-t border-paper-dark/50">
                <div className="p-5 sm:p-6 prose-summary animate-fade-in">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {podcast.summary}
                  </ReactMarkdown>
                </div>

                {/* Footer */}
                <div className="px-5 sm:px-6 py-3 bg-paper-warm/40 border-t border-paper-dark/30 flex items-center justify-between">
                  {podcast.originalUrl && (
                    <a
                      href={podcast.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      在小宇宙中查看
                    </a>
                  )}
                  <span className="text-xs text-ink-muted">点击收起 ↑</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <span className="badge badge-success">✓ 已完成</span>;
    case 'processing':
    case 'pending':
      return <span className="badge badge-processing">● 处理中</span>;
    case 'failed':
      return <span className="badge badge-failed">✕ 失败</span>;
    default:
      return null;
  }
}
