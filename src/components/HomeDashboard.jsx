import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Plane, Clock, MessageSquare, AlertCircle, LogOut } from 'lucide-react';

export function HomeDashboard({ token, closeDashboard }) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState('');

  // Fetch the shared trip document publicly using the token
  useEffect(() => {
    const fetchSharedTrip = async () => {
      setLoading(true);
      setError('');
      try {
        const docRef = doc(db, 'sharedTrips', token);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          throw new Error('This sharing link is invalid or has expired.');
        }

        const data = docSnap.data();
        const expiresAt = data.expiresAt?.toDate().getTime() || 0;
        
        // Rules double check client side
        if (expiresAt < Date.now()) {
          throw new Error('This sharing link has expired.');
        }

        setTrip(data);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to retrieve shared trip.');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedTrip();
  }, [token]);

  // ETA Countdown timer
  useEffect(() => {
    if (!trip || !trip.eta) return;

    const interval = setInterval(() => {
      const etaTime = new Date(trip.eta).getTime();
      const now = Date.now();
      const diff = etaTime - now;

      if (diff <= 0) {
        setCountdown('Landed');
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        let display = '';
        if (hours > 0) display += `${hours}h `;
        display += `${minutes}m ${seconds}s`;
        setCountdown(display);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [trip]);

  const formatTime = (timeString) => {
    if (!timeString) return 'TBD';
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-teal-400">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-semibold">Retrieving secure flight tracking details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 px-4 py-8 relative overflow-hidden">
      {/* Visual Accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-lg mx-auto z-10 space-y-6">
        
        {/* Header Logo */}
        <div className="text-center">
          <img src="/assets/Image/ODG_logo.png" alt="ONDAGO" className="h-14 w-14 mx-auto object-contain mb-3" />
          <h1 className="text-2xl font-black text-white tracking-wide font-display">ONDAGO</h1>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Caregiver Dashboard</p>
        </div>

        {error ? (
          /* Error display */
          <div className="bg-slate-900 border border-red-500/35 rounded-3xl p-8 shadow-2xl text-center space-y-4">
            <AlertCircle size={36} className="text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Access Link Invalid</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              {error} If you need current tracking details, please ask the traveling parent to send a fresh shareable link.
            </p>
            {closeDashboard && (
              <button
                onClick={closeDashboard}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl transition-colors focus-ring text-xs"
              >
                Go to Parent Sign-In
              </button>
            )}
          </div>
        ) : (
          /* Dashboard Content */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            {/* Status Header */}
            <div className="bg-slate-850 px-6 py-4.5 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Plane size={16} className="text-teal-400 rotate-45" />
                <span className="font-bold text-white text-sm">{trip.flightNumber}</span>
              </div>
              <span className="text-[10px] uppercase font-black px-2.5 py-1 bg-teal-500/20 text-teal-400 rounded-full">
                {trip.status}
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Route */}
              <div className="flex justify-between items-center text-center">
                <div>
                  <h3 className="text-2xl font-black text-white font-display">{trip.origin}</h3>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Departure</span>
                </div>
                <div className="h-0.5 border-t border-dashed border-slate-700 w-1/3"></div>
                <div>
                  <h3 className="text-2xl font-black text-white font-display">{trip.destination}</h3>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Arrival</span>
                </div>
              </div>

              {/* Countdown box */}
              <div className="bg-slate-850 border border-slate-800/80 p-5 rounded-2xl text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-slate-400">
                  <Clock size={14} />
                  <span className="text-[10px] uppercase font-bold tracking-wider">ETA Countdown</span>
                </div>
                <div className="text-3xl font-black text-teal-400 font-display">
                  {countdown || 'Calculating...'}
                </div>
                <div className="text-[10px] text-slate-500">
                  Scheduled Arrival: {formatTime(trip.departureTime)} → {formatTime(trip.eta)}
                </div>
              </div>

              {/* Parent Message Note */}
              {trip.note && (
                <div className="bg-teal-950/20 border border-teal-800/30 p-5 rounded-2xl flex gap-3">
                  <MessageSquare size={16} className="text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-[9px] font-bold text-teal-400 uppercase tracking-widest mb-1">Message from Parent</span>
                    <p className="text-xs text-slate-300 leading-relaxed italic">
                      "{trip.note}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Exit button */}
        {closeDashboard && (
          <button
            onClick={closeDashboard}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-300 border border-slate-800 font-bold rounded-2xl transition-colors text-xs flex items-center justify-center gap-2 focus-ring"
          >
            <LogOut size={14} />
            <span>Close caregiver view & Sign In</span>
          </button>
        )}
      </div>

      <div className="text-center text-[10px] text-slate-600 font-medium tracking-wide">
        Secure dashboard powered by ONDAGO. Expires automatically.
      </div>
    </div>
  );
}

export default HomeDashboard;
