/**
 * NewMark Platform Ultra: Global Executive Navigation Header
 * Provides cluster status, active tenant indicator, RBAC role switcher,
 * internationalized navigation labels, and LanguageSwitcher dropdown.
 */

import React from 'react';
import { 
  Cpu, 
  Database, 
  Layers, 
  Activity, 
  Radio,
  Building2,
  Server
} from 'lucide-react';
import { useTenant } from '../providers';
import { useLanguage } from '../i18n/context';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function HeaderNav({ activeTab, setActiveTab }: HeaderNavProps) {
  const { tenantId, userRole, setUserRole } = useTenant();
  const { t, dictionary } = useLanguage();

  const navItems = [
    { 
      id: 'agents', 
      label: dictionary.navigation.supervisorAgent, 
      icon: Cpu, 
      badge: dictionary.navigation.supervisorAgentBadge 
    },
    { 
      id: 'inventory', 
      label: dictionary.navigation.inventoryFefo, 
      icon: Layers, 
      badge: dictionary.navigation.inventoryFefoBadge 
    },
    { 
      id: 'schemas', 
      label: dictionary.navigation.dynamicObjects, 
      icon: Database, 
      badge: dictionary.navigation.dynamicObjectsBadge 
    },
    { 
      id: 'events', 
      label: dictionary.navigation.kafkaEventMesh, 
      icon: Radio, 
      badge: dictionary.navigation.kafkaEventMeshBadge 
    },
    { 
      id: 'arch', 
      label: dictionary.navigation.architectureSpec, 
      icon: Server 
    }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      {/* Top Telemetry Strip */}
      <div className="px-6 py-1.5 border-b border-slate-800/80 bg-slate-900/50 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-white font-bold">{dictionary.navigation.tenantLabel}</span>
            <span className="text-cyan-400">{tenantId}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{dictionary.navigation.clusterNodeActive}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">{dictionary.navigation.roleLabel}</span>
            <select
              value={userRole}
              onChange={e => setUserRole(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-cyan-300 font-mono text-[11px] focus:outline-none"
            >
              <option value="SUPER_ADMIN">{dictionary.navigation.superAdminRole}</option>
              <option value="ENTERPRISE_ARCHITECT">{dictionary.navigation.enterpriseArchitectRole}</option>
              <option value="OPS_MANAGER">{dictionary.navigation.opsManagerRole}</option>
              <option value="FINANCE_CONTROLLER">{dictionary.navigation.financeControllerRole}</option>
            </select>
          </div>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-400 font-bold">{dictionary.navigation.redlockMutexReady}</span>
          <span className="text-slate-700">|</span>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white font-sans">
                NEWMARK PLATFORM ULTRA
              </h1>
              <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-[10px] font-mono text-cyan-400 font-semibold">
                v4.8 ENTERPRISE
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {dictionary.navigation.platformSubtitle}
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <nav className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                    isActive ? 'bg-black/30 text-cyan-200' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
