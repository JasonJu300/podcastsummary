import { useState, useEffect, useRef } from 'react';
import { usePodcasts } from '../hooks/usePodcasts';
import { useAuth } from '../hooks/useAuth';
import type { ProcessStatus } from '../types';

interface UploadTabProps {
  onProcessed?: () => void;
}

export function UploadTab({ onProcessed }: UploadTabProps) {
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const { user } = useAuth();
  const { submitPodcast, checkStatus, fetchPodcasts } = usePodcasts(user?.token || null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentJobId) {
      intervalRef.current = setInterval(async () => {
        const newStatus = await checkStatus(currentJobId);
        if (newStatus) {
          setStatus(newStatus);
          if (newStatus.stage === 'completed' || newStatus.stage === 'failed') {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsSubmitting(false);
            if (newStatus.stage === 'completed') {
              fetchPodcasts();
              // Delay a bit then notify parent
              setTimeout(() => onProcessed?.(), 1500);
            }
          }
        }
      }, 3000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentJobId, checkStatus, fetchPodcasts, onProcessed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsSubmitting(true);
    setStatus({ stage: 'parsing', progress: 5, message: '正在提交...' });

    const jobId = await submitPodcast(url.trim());
    if (jobId) {
      setCurrentJobId(jobId);
    } else {
      setIsSubmitting(false);
      setStatus({ stage: 'failed', progress: 0, message: '提交失败，请检查链接后重试' });
    }
  };

  const handleReset = () => {
    setUrl('');
    setStatus(null);
    setCurrentJobId(null);
    setIsSubmitting(false);
  };

  const steps = [
    { key: 'parsing', icon: '🔍', label: '解析', desc: '获取播客信息' },
    { key: 'transcribing', icon: '🎙️', label: '转录', desc: '语音转文字' },
    { key: 'summarizing', icon: '✨', label: '总结', desc: 'AI 摘要生成' },
  ];

  const getStepState = (stepKey: string) => {
    if (!status) return 'idle';
    const stageOrder = ['pending', 'parsing', 'transcribing', 'summarizing', 'completed'];
    const currentIdx = stageOrder.indexOf(status.stage);
    const stepIdx = stageOrder.indexOf(stepKey);
    if (status.stage === 'failed') return 'idle';
    if (stepIdx < currentIdx) return 'done';
    if (stepIdx === currentIdx) return 'active';
    return 'idle';
  };

  return (
    <div className="max-w-xl mx-auto">
      {/* Input Card */}
      <div className="glass-card p-6 sm:p-8">
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-ink mb-2">
            添加播客
          </h2>
          <p className="text-ink-muted text-sm">
            粘贴小宇宙播客单集链接，AI 自动生成摘要
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">
              播客链接
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.xiaoyuzhoufm.com/episode/..."
              className="input-field"
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="btn-primary w-full"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                开始生成摘要
              </>
            )}
          </button>
        </form>

        {/* Status */}
        {status && (
          <div className="mt-6 animate-fade-in">
            {status.stage === 'completed' ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-success/5 border border-success/15">
                <span className="text-2xl">✅</span>
                <div className="flex-1">
                  <p className="font-medium text-ink text-sm">摘要生成完成！</p>
                  <p className="text-ink-muted text-xs mt-0.5">即将跳转至阅读页面...</p>
                </div>
              </div>
            ) : status.stage === 'failed' ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-error/5 border border-error/15">
                <span className="text-2xl">❌</span>
                <div className="flex-1">
                  <p className="font-medium text-error text-sm">{status.message}</p>
                </div>
                <button onClick={handleReset} className="text-xs text-ink-muted hover:text-ink underline">
                  重新提交
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-paper-warm/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="font-medium text-ink text-sm">{status.message}</p>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${status.progress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Processing Steps */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {steps.map((step, i) => {
          const state = getStepState(step.key);
          return (
            <div
              key={step.key}
              className={`
                glass-card !rounded-2xl p-4 text-center transition-all duration-500
                ${state === 'active' ? '!bg-accent/5 !border-accent/20 scale-[1.02]' : ''}
                ${state === 'done' ? 'opacity-60' : ''}
              `}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`text-2xl mb-1.5 ${state === 'active' ? 'animate-pulse' : ''}`}>
                {state === 'done' ? '✅' : step.icon}
              </div>
              <h3 className="text-sm font-semibold text-ink">{step.label}</h3>
              <p className="text-xs text-ink-muted mt-0.5">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
