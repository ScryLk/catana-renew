import React, { useState } from 'react';
import { StudioHeader } from '../components/studio/StudioHeader';
import { AgentCoPilot } from '../components/studio/AgentCoPilot';
import { CatalogCanvasWorkspace } from '../components/studio/CatalogCanvasWorkspace';
import { StudioHomeChat } from '../components/studio/StudioHomeChat';
import { KatanaSplashScreen } from '../components/studio/KatanaSplashScreen';
import { useStudioStore } from '../store/studioStore';

export const KatanaStudio: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const { hasStartedSession } = useStudioStore();

  return (
    <div className="h-screen w-screen flex flex-col bg-[#09090b] text-zinc-100 overflow-hidden font-sans antialiased">
      {/* Splash Screen with signature drawing animation from usecatana.com.br */}
      {showSplash && (
        <KatanaSplashScreen
          durationMs={3400}
          onComplete={() => setShowSplash(false)}
        />
      )}

      {/* Studio Top Navigation Bar */}
      <StudioHeader />

      {/* Main Workspace: Either Antigravity-style Home Chat or Split-Screen (Agent + Living Canvas) */}
      {!hasStartedSession ? (
        <StudioHomeChat />
      ) : (
        <div className="flex-1 w-full flex overflow-hidden animate-in fade-in duration-300">
          {/* Left: AI Agent Studio */}
          <AgentCoPilot />

          {/* Right: Living Catalog Canvas & Artifact Preview */}
          <CatalogCanvasWorkspace />
        </div>
      )}
    </div>
  );
};
