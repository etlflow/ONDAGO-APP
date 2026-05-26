import React from 'react';
import useAuth from '../hooks/useAuth';
import useTripStore from '../hooks/useTripStore';
import { Home, Plane, MessageSquare, BookOpen, Settings, LogOut, WifiOff } from 'lucide-react';

export function Layout({ children, activeTab, setActiveTab }) {
  const { signOut, user } = useAuth();
  const { isOnline } = useTripStore();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'mytrip', label: 'My Trip', icon: Plane },
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans antialiased text-slate-800 pb-16 md:pb-0">
      
      {/* Offline Status Bar */}
      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-white text-xs font-semibold py-1.5 px-4 flex items-center justify-center gap-2 shadow-md">
          <WifiOff size={14} className="animate-pulse" />
          <span>Offline Mode — Viewing cached travel details</span>
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shrink-0 border-r border-slate-850 py-6 px-4">
        {/* Header Logo */}
        <div className="flex items-center gap-3 px-2 mb-8">
          <img src="/assets/Image/ODG_logo.png" alt="ONDAGO logo" className="h-9 w-9 object-contain" />
          <div>
            <h1 className="font-extrabold tracking-wider text-teal-400 font-display text-lg">ONDAGO</h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">Family Travel</p>
          </div>
        </div>

        {/* User Info Card */}
        {user && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 mb-6">
            <p className="text-xs text-slate-400 font-medium">Traveling Parent</p>
            <p className="text-sm font-bold text-slate-200 truncate">{user.email}</p>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="space-y-1.5 flex-grow" aria-label="Desktop Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-label={`Go to ${item.label} page`}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 focus-ring ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-700/10'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sign Out Button */}
        <div className="pt-6 border-t border-slate-800">
          <button
            onClick={() => signOut()}
            aria-label="Sign out of your account"
            className="w-full flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-xl text-sm font-semibold transition-colors focus-ring"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-grow px-4 py-6 md:p-8 max-w-5xl mx-auto w-full ${!isOnline ? 'mt-7' : ''}`}>
        
        {/* Mobile Header Banner */}
        <header className="flex md:hidden items-center justify-between mb-6" aria-label="App banner">
          <div className="flex items-center gap-2">
            <img src="/assets/Image/ODG_logo.png" alt="ONDAGO" className="h-8 w-8 object-contain" />
            <h1 className="text-xl font-bold tracking-tight text-teal-700 font-display">ONDAGO</h1>
          </div>
          {user && (
            <div className="text-xs font-semibold text-teal-600 bg-teal-50 px-3 py-1 rounded-full border border-teal-100/50">
              Safe Connection
            </div>
          )}
        </header>

        <section aria-label="Active Tab View">
          {children}
        </section>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/90 backdrop-blur-lg border-t border-slate-100 py-1.5 shadow-lg flex justify-around items-center px-4"
        aria-label="Mobile Navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              aria-label={`Go to ${item.label}`}
              className={`flex flex-col items-center justify-center w-12 py-1 transition-all duration-200 focus-ring ${
                isActive ? 'text-teal-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={20} className={isActive ? 'stroke-[2.5px] scale-110' : 'stroke-[1.8px]'} />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
}

export default Layout;
