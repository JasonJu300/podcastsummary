import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Header } from './components/Header';
import { UploadTab } from './components/UploadTab';
import { ReadTab } from './components/ReadTab';

type Tab = 'upload' | 'read';

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const { user, isLoading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-ink-muted text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // import { Login } from './components/Login';

  const handleProcessed = () => {
    setRefreshKey(k => k + 1);
    setActiveTab('read');
  };

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Tab Navigation */}
        <div className="flex justify-center mb-8 sm:mb-10">
          <div className="glass-card !rounded-full p-1 inline-flex gap-1">
            <TabButton
              active={activeTab === 'upload'}
              onClick={() => setActiveTab('upload')}
              icon={
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
              label="添加播客"
            />
            <TabButton
              active={activeTab === 'read'}
              onClick={() => setActiveTab('read')}
              icon={
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              }
              label="阅读摘要"
            />
          </div>
        </div>

        {/* Content */}
        <div className="animate-fade-in" key={activeTab}>
          {activeTab === 'upload'
            ? <UploadTab onProcessed={handleProcessed} />
            : <ReadTab key={refreshKey} />
          }
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-ink-muted text-xs tracking-wide">
          播客摘要 · AI 驱动的播客内容提炼
        </p>
      </footer>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-5 sm:px-7 py-2.5 rounded-full text-sm font-medium transition-all duration-300
        flex items-center gap-2
        ${active
          ? 'bg-accent text-white shadow-lg shadow-accent/25'
          : 'text-ink-muted hover:text-ink hover:bg-paper-warm/60'
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
