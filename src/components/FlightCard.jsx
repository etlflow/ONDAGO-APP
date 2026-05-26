import React, { useState, useEffect } from 'react';
import useTripStore from '../hooks/useTripStore';
import ShareableTrip from './ShareableTrip';
import { Plane, Compass, Navigation, Clock, Share2, MapPin } from 'lucide-react';

export function FlightCard() {
  const { activeTrip } = useTripStore();
  const [countdown, setCountdown] = useState('');
  const [isShareOpen, setIsShareOpen] = useState(false);

  const flight = activeTrip?.flight;

  // Calculate and update the ETA countdown every second
  useEffect(() => {
    if (!flight || !flight.arrivalTime) return;

    const interval = setInterval(() => {
      const etaTime = new Date(flight.arrivalTime).getTime();
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
  }, [flight]);

  if (!flight) return null;

  // Formatting utility
  const formatTime = (timeString) => {
    if (!timeString) return 'TBD';
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isDelayed = flight.delayMinutes > 0;

  return (
    <div className="glass-card overflow-hidden">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white px-6 py-4.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Plane size={18} className="text-teal-400 rotate-45" />
          <span className="font-bold tracking-wider">{flight.flightNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
            flight.status === 'active' 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : isDelayed
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-teal-500/20 text-teal-400'
          }`}>
            {flight.status}
          </span>
          {isDelayed && (
            <span className="text-[10px] bg-amber-500 text-slate-950 font-extrabold px-2.5 py-1 rounded-full">
              Delayed {flight.delayMinutes} min
            </span>
          )}
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        {/* Origin -> Destination Route Display */}
        <div className="flex justify-between items-center relative">
          {/* Visual Route Line */}
          <div className="absolute top-1/2 left-1/3 right-1/3 h-0.5 border-t-2 border-dashed border-slate-200 -translate-y-1/2 z-0"></div>
          
          <div className="z-10 text-left">
            <h3 className="text-3xl font-extrabold text-slate-800 font-display">{flight.origin}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase mt-1">Origin Code</p>
          </div>
          
          <div className="z-10 bg-slate-50 p-2.5 border border-slate-200 rounded-full">
            <Plane size={18} className="text-teal-600 rotate-90" />
          </div>

          <div className="z-10 text-right">
            <h3 className="text-3xl font-extrabold text-slate-800 font-display">{flight.destination}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase mt-1">Destination Code</p>
          </div>
        </div>

        {/* Departure & Arrival Schedule */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50/60 p-4.5 rounded-2xl border border-slate-100">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Scheduled Departure</span>
            <span className="text-lg font-extrabold text-slate-800">{formatTime(flight.scheduledDeparture)}</span>
            <span className="block text-xs text-slate-400 mt-1">Terminal {flight.departureTerminal || 'TBD'} • Gate {flight.departureGate || 'TBD'}</span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Scheduled Arrival</span>
            <span className="text-lg font-extrabold text-slate-800">{formatTime(flight.scheduledArrival)}</span>
            <span className="block text-xs text-slate-400 mt-1">Terminal {flight.arrivalTerminal || 'TBD'} • Gate {flight.arrivalGate || 'TBD'}</span>
          </div>
        </div>

        {/* Countdown Overlay */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock size={16} />
            <span className="text-xs font-bold uppercase tracking-wide">ETA Countdown:</span>
          </div>
          <span className="text-xl font-black text-teal-600 font-display tracking-tight">
            {countdown || 'Calculating...'}
          </span>
        </div>

        {/* Live OpenSky Tracking metrics (Visible during flight) */}
        {flight.live && (
          <div className="bg-slate-900 text-slate-300 p-5 rounded-2xl border border-slate-800 space-y-3 shadow-inner">
            <h4 className="text-xs font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
              <Navigation size={12} className="animate-pulse" />
              <span>Live Position Tracking</span>
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-850 p-2.5 rounded-xl border border-slate-800">
                <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Speed</span>
                <span className="font-extrabold text-white">{flight.live.speed ? `${flight.live.speed} km/h` : 'N/A'}</span>
              </div>
              <div className="bg-slate-850 p-2.5 rounded-xl border border-slate-800">
                <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Altitude</span>
                <span className="font-extrabold text-white">{flight.live.altitude ? `${flight.live.altitude} m` : 'N/A'}</span>
              </div>
              <div className="bg-slate-850 p-2.5 rounded-xl border border-slate-800">
                <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Coordinates</span>
                <span className="font-bold text-teal-500 truncate block">
                  {flight.live.latitude?.toFixed(3)}, {flight.live.longitude?.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Panel */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex-grow py-3 px-4 bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold rounded-xl transition-all border border-teal-200/50 flex items-center justify-center gap-2 focus-ring text-xs"
          >
            <Share2 size={15} />
            <span>Share Trip with Caregiver</span>
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {isShareOpen && (
        <ShareableTrip tripId={activeTrip.id} onClose={() => setIsShareOpen(false)} />
      )}
    </div>
  );
}

export default FlightCard;
