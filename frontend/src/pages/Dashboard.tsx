import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { StatsCards } from '../components/StatsCards';
import { RecentCatalogs } from '../components/RecentCatalogs';
import { QuickActions } from '../components/QuickActions';


export const Dashboard: FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <Header />

      {/* Main Content */}
      <main className="ml-16 pt-20">
        <div className="p-8 max-w-[1600px] mx-auto">
          {/* Title Section */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-100 mb-2">Dashboard</h1>
              <p className="text-zinc-400">Gerencie seus catálogos e acompanhe o desempenho</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/studio')}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <svg className="size-4 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Katana Studio</span>
                <span className="text-[10px] font-mono font-semibold bg-zinc-200 text-zinc-900 px-1.5 py-0.5 rounded">v2.0</span>
              </button>
              <button
                onClick={() => navigate('/editor')}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg border border-zinc-700 transition-colors cursor-pointer text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Editor Manual (v0.0)
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="mb-8">
            <StatsCards />
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Recent Catalogs */}
            <div className="lg:col-span-2">
              <RecentCatalogs />
            </div>

            {/* Right Column - Quick Actions */}
            <div>
              <QuickActions />
            </div>
          </div>
        </div>
      </main>


    </div>
  );
};
