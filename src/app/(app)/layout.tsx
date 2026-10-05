import { Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';
import { WarmUp } from '@/components/WarmUp';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="app">
        <Sidebar />
        <main className="main">
          <div className="container">{children}</div>
        </main>
      </div>
      <WarmUp />
    </ToastProvider>
  );
}
