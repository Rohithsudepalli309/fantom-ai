import React from 'react';
import { type Feature } from '../types';
import { HomeIcon } from './Icons';
import { Logo } from './Logo';
import ThemeSwitcher from './ThemeSwitcher';
import { FEATURES, SIDEBAR_NAV, SIDEBAR_FOOTER } from '@/data/features';

interface SidebarProps {
  activeFeature: Feature | null;
  setActiveFeature: (feature: Feature | null) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const navItems = SIDEBAR_NAV.map((id) => ({ id, name: FEATURES[id].name, icon: FEATURES[id].icon }));
const footerItems = SIDEBAR_FOOTER.map((id) => ({ id, name: FEATURES[id].name, icon: FEATURES[id].icon }));

const Sidebar: React.FC<SidebarProps> = ({ activeFeature, setActiveFeature, isOpen, setIsOpen }) => {
  const preloadMap: Partial<Record<Feature, () => void>> = {
    text: () => { import('./TextGeneration'); },
    chat: () => { import('./Chat'); },
    image: () => { import('./ImageGeneration'); },
    vision: () => { import('./Vision'); },
    status: () => { import('./SystemStatus'); },
    settings: () => { import('./Settings'); },
    activity: () => { import('./ActivityViewer'); },
  };

  const handleFeatureClick = (feature: Feature | null) => {
    setActiveFeature(feature);
    setIsOpen(false); // Close sidebar on selection in mobile view
  };

  const NavItem: React.FC<{item: typeof navItems[number] | typeof footerItems[number]}> = ({ item }) => {
      const Icon = item.icon;
      const isActive = activeFeature === item.id;
      return (
          <li className="relative group">
              <button
                  onClick={() => handleFeatureClick(item.id)}
                  onMouseEnter={() => preloadMap[item.id]?.()}
                  onFocus={() => preloadMap[item.id]?.()}
                  className={`w-full flex items-center gap-3 p-3 my-1 rounded-lg transition-colors duration-200 text-sm font-medium ${
                      isActive 
                      ? "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300" 
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                  }`}
              >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {item.name}
              </div>
          </li>
      )
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/50 z-30 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      ></div>
      <aside
        id="sidebar"
        className={`fixed top-0 left-0 h-full w-64 bg-slate-50 dark:bg-[#1C1C1F] flex flex-col p-4 transition-transform z-40 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between mb-8">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setActiveFeature(null)}
          >
            <Logo size={48} className="flex-shrink-0" />
            <span className="text-xl font-bold text-slate-800 dark:text-slate-200">FANTOM AI</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-slate-500 dark:text-slate-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"
            aria-label="Toggle sidebar"
          >
            {/* Reuse menu icon for both open/close semantics */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

  {/* Home section to return to the Welcome screen; keep gap equal to other items */}
  <div className="mb-0">
          <button
            onClick={() => handleFeatureClick(null)}
            className={`w-full flex items-center gap-3 p-3 my-1 rounded-lg transition-colors duration-200 text-sm font-medium ${
              activeFeature === null
                ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
            aria-label="Home"
          >
            <HomeIcon className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">Home</span>
          </button>
        </div>

        <nav className="flex-grow">
          <ul>
            {navItems.map((item) => <NavItem key={item.id} item={item} />)}
          </ul>
        </nav>

        <div className="mt-auto">
          <ul>
            {footerItems.map((item) => <NavItem key={item.id} item={item} />)}
          </ul>
          <ThemeSwitcher />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
