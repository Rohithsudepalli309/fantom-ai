import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HomeIcon } from './Icons';
import { Logo } from './Logo';
import ThemeSwitcher from './ThemeSwitcher';
import { FEATURES, SIDEBAR_NAV, SIDEBAR_FOOTER } from '@/data/features';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const navItems = SIDEBAR_NAV.map((id) => ({ id, name: FEATURES[id].name, icon: FEATURES[id].icon, path: `/${id}` }));
const footerItems = SIDEBAR_FOOTER.map((id) => ({ id, name: FEATURES[id].name, icon: FEATURES[id].icon, path: `/${id}` }));

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const location = useLocation();

  const NavItem: React.FC<{ item: typeof navItems[number] | typeof footerItems[number] }> = ({ item }) => {
    const Icon = item.icon;
    return (
      <li className="relative group">
        <NavLink
          to={item.path}
          onClick={() => setIsOpen(false)}
          className={({ isActive }) => cn(
            "w-full flex items-center gap-3 p-3 my-1 rounded-lg transition-colors duration-200 text-sm font-medium",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className="truncate">{item.name}</span>
        </NavLink>
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-border">
          {item.name}
        </div>
      </li>
    )
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <motion.aside
        id="sidebar"
        initial={false}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-card border-r border-border flex flex-col p-4 z-40 lg:transform-none lg:translate-x-0"
        )}
        style={{ x: isOpen ? 0 : '-100%' }} // Fallback/Initial state handling
      >
        <div className="flex items-center justify-between mb-8">
          <NavLink
            to="/"
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setIsOpen(false)}
          >
            <Logo size={48} className="flex-shrink-0" />
            <span className="text-xl font-bold text-foreground">FANTOM AI</span>
          </NavLink>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-muted-foreground rounded-md hover:bg-accent hover:text-accent-foreground lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="mb-0">
          <NavLink
            to="/"
            onClick={() => setIsOpen(false)}
            end
            className={({ isActive }) => cn(
              "w-full flex items-center gap-3 p-3 my-1 rounded-lg transition-colors duration-200 text-sm font-medium",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            aria-label="Home"
          >
            <HomeIcon className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">Home</span>
          </NavLink>
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
      </motion.aside>
    </>
  );
};

export default Sidebar;
