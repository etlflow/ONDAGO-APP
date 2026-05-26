import React, { useState, useEffect } from 'react';
import useTripStore from '../hooks/useTripStore';
import { auth, db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { AlertTriangle, Sparkles, Smile, BookOpen, Coffee, HelpCircle } from 'lucide-react';

export function DelaySurvivalKit() {
  const { activeTrip, isOnline } = useTripStore();
  const [kitData, setKitData] = useState(activeTrip?.delaySurvivalKit || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const flight = activeTrip?.flight;
  const tripId = activeTrip?.id;
  const delayMinutes = flight?.delayMinutes || 0;
  
  // Auto-trigger if delay is > 30 minutes and kit is not already generated
  useEffect(() => {
    if (delayMinutes > 30 && !activeTrip?.delaySurvivalKit && isOnline && tripId) {
      generateSurvivalKit();
    } else if (activeTrip?.delaySurvivalKit) {
      setKitData(activeTrip.delaySurvivalKit);
    }
  }, [delayMinutes, activeTrip?.delaySurvivalKit, tripId]);

  const generateSurvivalKit = async () => {
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not logged in');
      const token = await user.getIdToken();

      const prompt = `My flight ${flight.flightNumber} from ${flight.origin} to ${flight.destination} is delayed by ${delayMinutes} minutes at ${flight.origin}. Generate a comforting "Delay Survival Kit" for a parent traveling with kids. Include:
1. "Toddler Calm-down Script" (a brief script parents can read to calm their child).
2. "Terminal Play & Exploration Ideas" (activities to do at ${flight.origin} airport).
3. "Offline Travel Games" (games requiring no screen or internet).
4. "Quick Snack Hacks".
Respond in a friendly, practical tone. Keep it structured.`;

      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          context: { flightData: flight }
        })
      });

      if (!res.ok) throw new Error('AI search failed');
      const reply = await res.json();

      const generatedKit = {
        content: reply.content,
        timestamp: Date.now()
      };

      // Save to Firestore
      const tripRef = doc(db, 'users', user.uid, 'trips', tripId);
      await updateDoc(tripRef, { delaySurvivalKit: generatedKit });

      // Save to Zustand
      useTripStore.setState(state => {
        if (state.activeTrip && state.activeTrip.id === tripId) {
          return { activeTrip: { ...state.activeTrip, delaySurvivalKit: generatedKit } };
        }
        return {};
      });

      setKitData(generatedKit);
    } catch (err) {
      console.error('Failed to generate survival kit:', err);
      setError('Could not generate survival guide at this time.');
    } finally {
      setLoading(false);
    }
  };

  // Only display if flight has > 30 min delay
  if (delayMinutes <= 30) return null;

  return (
    <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-6 md:p-8 shadow-premium space-y-6 relative overflow-hidden">
      
      {/* Background Graphic */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>

      {/* Warning Header */}
      <div className="flex items-center gap-3.5">
        <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl animate-pulse">
          <AlertTriangle size={22} />
        </div>
        <div>
          <h2 className="text-lg font-black text-amber-900 font-display">Delay Survival Kit</h2>
          <p className="text-xs text-amber-700/80 font-semibold uppercase tracking-wider">Auto-triggered: flight delay is {delayMinutes} minutes</p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center text-amber-700 font-semibold gap-3 text-xs">
          <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Drafting toddler calm-down scripts & play zones...</span>
        </div>
      ) : kitData ? (
        /* Markdown / Content Display Box */
        <div className="bg-white border border-amber-200/60 p-5 rounded-2xl shadow-sm text-xs text-slate-700 leading-relaxed font-medium space-y-4 max-h-[300px] overflow-y-auto scrollbar-hide">
          <div className="flex items-center gap-2 text-amber-600 font-bold uppercase tracking-wider">
            <Sparkles size={14} />
            <span>AI Guided Reassurance Plan</span>
          </div>
          <div className="whitespace-pre-wrap font-sans text-slate-600">
            {kitData.content}
          </div>
        </div>
      ) : (
        /* Error or Try again panel */
        <div className="text-center py-4 space-y-3">
          <p className="text-xs text-amber-700 font-medium">{error || 'Guide is ready to compile.'}</p>
          <button
            onClick={generateSurvivalKit}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm focus-ring"
          >
            Generate Survival Kit
          </button>
        </div>
      )}

      {/* Helpful Parent Script shortcut */}
      <div className="flex gap-2.5 bg-white border border-amber-100 p-4 rounded-xl text-slate-500 text-xs leading-relaxed">
        <Smile size={16} className="text-amber-500 mt-0.5 shrink-0 animate-bounce" />
        <div>
          <strong className="text-slate-700">Quick Toddler Reassurance:</strong> "We are on an airport adventure! The airplane is taking a short rest so it can fly us very safely later."
        </div>
      </div>

    </div>
  );
}

export default DelaySurvivalKit;
