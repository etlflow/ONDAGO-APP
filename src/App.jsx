import React, { useEffect, useState } from 'react';
import useAuth from './hooks/useAuth';
import useTripStore from './hooks/useTripStore';

// UI components
import Layout from './components/Layout';
import Auth from './components/Auth';
import HomeDashboard from './components/HomeDashboard';

// Subviews
import FlightSearch from './components/FlightSearch';
import FlightCard from './components/FlightCard';
import WeatherWidget from './components/WeatherWidget';
import AICompanion from './components/AICompanion';
import PackingList from './components/PackingList';
import TripJournal from './components/TripJournal';
import AISettings from './components/AISettings';

export function App() {
  const { user, loading, isIdle, reauthenticate, signOut } = useAuth();
  const { isOnline, setOnlineStatus, syncOfflineQueue, activeTrip } = useTripStore();
  const [activeTab, setActiveTab] = useState('home'); // home, mytrip, chat, journal, settings
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [caregiverToken, setCaregiverToken] = useState(null);

  // Check for public share token on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setCaregiverToken(token);
    }
  }, []);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setOnlineStatus(true);
      if (user) {
        syncOfflineQueue(async () => {
          return user.getIdToken();
        });
      }
    };
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  // Sync offline queue if user loads the page while online
  useEffect(() => {
    if (isOnline && user) {
      syncOfflineQueue(async () => {
        return user.getIdToken();
      });
    }
  }, [isOnline, user]);

  // Handle re-authentication unlock
  const handleUnlock = async (e) => {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError('');
    try {
      await reauthenticate(unlockPassword);
      setUnlockPassword('');
    } catch (err) {
      setUnlockError('Incorrect password. Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-teal-400">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-medium tracking-wide">Securing travel connection...</p>
      </div>
    );
  }

  // Render Caregiver Public Dashboard if share token is present in URL
  if (caregiverToken) {
    return <HomeDashboard token={caregiverToken} closeDashboard={() => setCaregiverToken(null)} />;
  }

  // Render Auth screen if user is guest
  if (!user) {
    return <Auth />;
  }

  return (
    <>
      {/* Idle Lock Overlay */}
      {isIdle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-lg px-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
            <div className="mx-auto w-16 h-16 bg-teal-500/10 flex items-center justify-center rounded-2xl mb-4">
              <span className="text-2xl text-teal-400">🔒</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 font-display">Session Locked</h2>
            <p className="text-slate-400 text-sm mb-6">
              You've been idle for 30 minutes. To protect your family's travel details, please enter your password to unlock.
            </p>
            <form onSubmit={handleUnlock} className="space-y-4">
              <input
                type="password"
                required
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-2xl px-4 py-3 text-center focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="Enter password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
              />
              {unlockError && <p className="text-red-400 text-xs font-medium">{unlockError}</p>}
              <button
                type="submit"
                disabled={unlocking}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-2xl transition-colors duration-200"
              >
                {unlocking ? 'Verifying...' : 'Unlock Session'}
              </button>
            </form>
            <button
              onClick={() => signOut()}
              className="mt-6 text-slate-500 hover:text-slate-400 text-xs font-semibold uppercase tracking-wider"
            >
              Or Log Out
            </button>
          </div>
        </div>
      )}

      {/* Main Layout containing active pages */}
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {/* Render Tab Contents */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <FlightSearch onViewTrip={() => setActiveTab('mytrip')} />
            {activeTrip && (
              <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Active Flight Info</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-2xl font-bold text-teal-700">{activeTrip.flight?.flightNumber}</h4>
                    <p className="text-sm text-slate-500">{activeTrip.flight?.origin} → {activeTrip.flight?.destination}</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('mytrip')}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl shadow transition-colors"
                  >
                    View Trip Details
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'mytrip' && (
          <div className="space-y-6">
            {activeTrip ? (
              <>
                <FlightCard />
                {activeTrip.weather && <WeatherWidget />}
                <PackingList />
              </>
            ) : (
              <div className="text-center py-12 glass-card p-8">
                <span className="text-4xl text-teal-500">✈️</span>
                <h3 className="text-lg font-semibold text-slate-700 mt-4">No active flight loaded</h3>
                <p className="text-slate-400 text-sm mt-2 mb-6">Search and select a flight from the home tab to start tracking.</p>
                <button
                  onClick={() => setActiveTab('home')}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-2xl shadow transition-all duration-200"
                >
                  Go Search Flights
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && <AICompanion />}

        {activeTab === 'journal' && <TripJournal />}

        {activeTab === 'settings' && <AISettings />}
      </Layout>
    </>
  );
}

export default App;
