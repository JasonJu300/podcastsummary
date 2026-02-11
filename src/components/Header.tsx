import { useAuth } from '../hooks/useAuth';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-paper/80 border-b border-paper-dark/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shadow-md shadow-accent/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-serif font-bold text-ink leading-tight tracking-tight">
              播客摘要
            </h1>
            <p className="text-[11px] text-ink-muted leading-none hidden sm:block">
              Podcast Summarizer
            </p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper-warm/60">
              <div className="w-5 h-5 rounded-full bg-accent-light flex items-center justify-center">
                <span className="text-[10px] font-bold text-accent-hover">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-ink-secondary text-sm">{user.username}</span>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm text-ink-muted hover:text-error rounded-lg hover:bg-error/5 transition-all"
            >
              退出
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
