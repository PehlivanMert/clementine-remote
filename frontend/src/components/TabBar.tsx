import React from 'react';
import { Disc3, ListMusic, Library, Search, Sliders } from 'lucide-react';

export type TabType = 'player' | 'queue' | 'library' | 'search' | 'system';

interface TabBarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  queueCount?: number;
}

export const TabBar: React.FC<TabBarProps> = ({ currentTab, onTabChange, queueCount = 0 }) => {
  const tabs = [
    { id: 'player' as TabType, label: 'Now Playing', icon: Disc3 },
    { id: 'queue' as TabType, label: 'Queue', icon: ListMusic, badge: queueCount },
    { id: 'library' as TabType, label: 'Library', icon: Library },
    { id: 'search' as TabType, label: 'Search', icon: Search },
    { id: 'system' as TabType, label: 'System', icon: Sliders },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-nav safe-bottom">
      <div className="max-w-md mx-auto px-3 h-16 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${
                isActive ? 'text-amber-500' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1 -right-2 bg-amber-500 text-black text-[9px] font-bold px-1 rounded-full min-w-3.5 text-center leading-3">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium tracking-tight ${isActive ? 'text-amber-500 font-semibold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
