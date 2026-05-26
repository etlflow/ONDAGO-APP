import React, { useState, useEffect } from 'react';
import useTripStore from '../hooks/useTripStore';
import { auth, db } from '../services/firebase';
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { flightNumberSchema } from '../utils/validation';
import { Search, History, HelpCircle, AlertCircle, MapPin } from 'lucide-react';

export function FlightSearch({ onViewTrip }) {
  const { setFlightData, setWeatherData, setActiveTrip, isOnline, setLoadingTrip } = useTripStore();
  const [flightNum, setFlightNum] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  // Load recent searches from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentFlightSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const saveRecentSearch = (num) => {
    const uppercaseNum = num.toUpperCase();
    const updated = [uppercaseNum, ...recentSearches.filter((s) => s !== uppercaseNum)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentFlightSearches', JSON.stringify(updated));
  };

  const handleSearch = async (e, customFlightNum = null) => {
    if (e) e.preventDefault();
    setError('');
    const targetFlightNum = (customFlightNum || flightNum).trim().toUpperCase();

    // 1. Validate Input client-side via Zod
    const validationResult = flightNumberSchema.safeParse(targetFlightNum);
    if (!validationResult.success) {
      setError(validationResult.error.errors[0].message);
      return;
    }

    if (!isOnline) {
      setError('Cannot search flights while offline. Please connect to the internet.');
      return;
    }

    setLoading(true);
    setLoadingTrip(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();

      // 2. Fetch Flight Schedule Details
      const flightRes = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/flight-lookup?flightNumber=${encodeURIComponent(targetFlightNum)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!flightRes.ok) {
        const errorData = await flightRes.json();
        throw new Error(errorData.error || 'Failed to fetch flight data');
      }

      const flightData = await flightRes.json();

      // 3. Resolve Airport codes to get destination city
      let destinationCity = flightData.destination;
      try {
        const airportRes = await fetch(
          `${import.meta.env.VITE_API_URL || ''}/api/airport-lookup?query=${encodeURIComponent(flightData.destination)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        if (airportRes.ok) {
          const airports = await airportRes.json();
          const match = airports.find(ap => ap.code === flightData.destination);
          if (match && match.city) {
            destinationCity = match.city;
          }
        }
      } catch (err) {
        console.warn('Airport lookup failed, using destination airport code as city:', err);
      }

      // 4. Fetch destination weather forecast
      let weatherData = null;
      try {
        const weatherRes = await fetch(
          `${import.meta.env.VITE_API_URL || ''}/api/weather?city=${encodeURIComponent(destinationCity)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        if (weatherRes.ok) {
          weatherData = await weatherRes.json();
        }
      } catch (err) {
        console.warn('Weather retrieval failed:', err);
      }

      // 5. Generate unique Firestore trip record
      const tripId = doc(collection(db, 'users', user.uid, 'trips')).id;
      
      const newTrip = {
        id: tripId,
        flight: flightData,
        weather: weatherData,
        packingList: [],
        journal: [],
        aiHistory: []
      };

      // Write new trip record in Firestore
      await setDoc(doc(db, 'users', user.uid, 'trips', tripId), {
        flight: flightData,
        weather: weatherData,
        packingList: [],
        journal: [],
        aiHistory: [],
        createdAt: serverTimestamp()
      });

      // Update Zustand state
      setActiveTrip(newTrip);
      saveRecentSearch(targetFlightNum);
      
      // Auto-trigger background AI one-liner summary
      triggerWeatherSummaryAI(user.uid, tripId, flightData, weatherData, token);

      // Redirect user to dashboard details tab
      if (onViewTrip) onViewTrip();

    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'An error occurred during flight search.');
    } finally {
      setLoading(false);
      setLoadingTrip(false);
    }
  };

  // Helper to trigger the AI weather packing one-liner
  const triggerWeatherSummaryAI = async (uid, tripId, flight, weather, token) => {
    if (!weather) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Hello! I am traveling to ${weather.city}. The forecast is ${weather.temp}°C, ${weather.description}. Please provide a 1-sentence friendly, reassuring travel advice on what I should pack for this weather context.`
          }],
          context: { flightData: flight, weatherData: weather }
        })
      });
      if (res.ok) {
        const reply = await res.json();
        // Save the advice in Firestore/Zustand as a trip level metadata or initial AI response
        const assistantMsg = {
          role: 'assistant',
          content: reply.content,
          timestamp: Date.now()
        };
        const initialHistory = [
          { role: 'user', content: 'What should I pack for the destination weather?', timestamp: Date.now() - 1000 },
          assistantMsg
        ];
        
        // Sync to Firestore
        await setDoc(doc(db, 'users', uid, 'trips', tripId), {
          aiHistory: initialHistory
        }, { merge: true });

        // Update Zustand state
        useTripStore.setState(state => {
          if (state.activeTrip && state.activeTrip.id === tripId) {
            return { activeTrip: { ...state.activeTrip, aiHistory: initialHistory } };
          }
          return {};
        });
      }
    } catch (err) {
      console.warn('Failed to pre-fetch AI weather summary:', err);
    }
  };

  return (
    <div className="glass-card p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-teal-500/10 text-teal-600 rounded-2xl">
          <Search size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Search All Flights</h2>
          <p className="text-xs text-slate-400 font-medium">Enter your flight number to verify live schedule & routes</p>
        </div>
      </div>

      <form onSubmit={(e) => handleSearch(e)} className="space-y-4">
        <div>
          <label htmlFor="flight-input" className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            IATA Flight Number
          </label>
          <div className="relative">
            <input
              id="flight-input"
              type="text"
              required
              aria-label="IATA Flight Number"
              className="w-full bg-slate-100 border border-slate-200/80 rounded-2xl px-5 py-4 text-base font-bold placeholder-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all uppercase tracking-widest text-slate-800"
              placeholder="e.g. AA123"
              value={flightNum}
              onChange={(e) => setFlightNum(e.target.value)}
              disabled={loading}
            />
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-md hover:shadow-lg shadow-teal-700/10 flex items-center justify-center gap-2 focus-ring text-sm"
        >
          <span>Let's Go!</span>
        </button>
      </form>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h3 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            <History size={14} />
            <span>Recent Flights</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, idx) => (
              <button
                key={idx}
                onClick={(e) => handleSearch(e, search)}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 text-xs font-bold rounded-xl border border-slate-200/50 hover:border-teal-200/50 transition-all focus-ring"
              >
                <span>{search}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Safety Help Card */}
      <div className="mt-6 flex items-start gap-3 bg-teal-50/50 border border-teal-100/30 p-4.5 rounded-2xl">
        <MapPin size={16} className="text-teal-600 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong>Privacy Note</strong>: Flight status checks occur entirely within secure server proxies. Your location details are never uploaded or tracked.
        </p>
      </div>
    </div>
  );
}

export default FlightSearch;
