/**
 * NewMark Platform Ultra: Autonomous Multi-Agent Distributed Enterprise Operating System
 * Omni-Surface React Client Entry
 */

import React, { useState } from 'react';
import { Providers } from './providers';
import { HeaderNav } from './components/HeaderNav';
import { AgentWorkspace } from './components/AgentWorkspace';
import { InventoryRestockEngine } from './components/InventoryRestockEngine';
import { DynamicSchemaManager } from './components/DynamicSchemaManager';
import { KafkaEventTerminal } from './components/KafkaEventTerminal';
import { ArchitectureView } from './components/ArchitectureView';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('agents');

  return (
    <Providers>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* Navigation & Header */}
        <HeaderNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
          {activeTab === 'agents' && <AgentWorkspace />}
          {activeTab === 'inventory' && <InventoryRestockEngine />}
          {activeTab === 'schemas' && <DynamicSchemaManager />}
          {activeTab === 'events' && <KafkaEventTerminal />}
          {activeTab === 'arch' && <ArchitectureView />}
        </main>
      </div>
    </Providers>
  );
}
