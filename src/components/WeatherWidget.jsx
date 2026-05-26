import React from 'react';
import useTripStore from '../hooks/useTripStore';
import { Sun, Cloud, Thermometer, CloudRain, Sparkles } from 'lucide-react';

export function WeatherWidget() {
  const { activeTrip } = useTripStore();
  const weather = activeTrip?.weather;

  if (!weather) return null;

  // Extract the AI-generated weather pack advice from chat history
  const aiHistory = activeTrip?.aiHistory || [];
  const weatherAdvice = aiHistory.find(
    msg => msg.role === 'assistant' && (msg.content.toLowerCase().includes('pack') || msg.content.toLowerCase().includes('weather') || msg.content.length < 180)
  )?.content;

  // Map OpenWeatherMap icon to lucide icons
  const getWeatherIcon = (desc) => {
    const d = desc.toLowerCase();
    if (d.includes('rain') || d.includes('drizzle')) return <CloudRain size={28} className="text-blue-500 animate-bounce" />;
    if (d.includes('cloud')) return <Cloud size={28} className="text-slate-400 animate-float" />;
    return <Sun size={28} className="text-amber-500 animate-spin" style={{ animationDuration: '20s' }} />;
  };

  return (
    <div className="glass-card p-6 md:p-8 space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-teal-500/10 text-teal-600 rounded-2xl">
          <Thermometer size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Destination Weather</h2>
          <p className="text-xs text-slate-400 font-medium">Forecast conditions for {weather.city}</p>
        </div>
      </div>

      {/* Current Weather Card */}
      <div className="flex items-center justify-between bg-slate-50/60 border border-slate-100 p-5 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-white p-3.5 border border-slate-150 rounded-2xl shadow-sm">
            {getWeatherIcon(weather.description)}
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 font-display">{weather.temp}°C</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{weather.description}</p>
          </div>
        </div>
        <img
          src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
          alt="Weather icon"
          className="h-16 w-16 object-contain"
        />
      </div>

      {/* AI Advice Box */}
      {weatherAdvice && (
        <div className="bg-teal-50/50 border border-teal-100/30 p-5 rounded-2xl relative overflow-hidden flex items-start gap-3.5 shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-400/5 rounded-full blur-2xl pointer-events-none"></div>
          <Sparkles size={18} className="text-teal-600 shrink-0 mt-0.5" />
          <div>
            <span className="block text-[10px] font-bold text-teal-800 uppercase tracking-widest mb-1.5">Companion Pack Advice</span>
            <p className="text-xs text-slate-600 italic font-medium leading-relaxed">
              "{weatherAdvice}"
            </p>
          </div>
        </div>
      )}

      {/* 5-Day Forecast Grid */}
      <div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">5-Day Forecast</h4>
        <div className="grid grid-cols-5 gap-2">
          {weather.forecast?.map((day, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-100/80 rounded-xl p-3 text-center flex flex-col items-center shadow-sm"
            >
              <span className="block text-[10px] font-bold text-slate-400 uppercase">
                {new Date(day.date).toLocaleDateString([], { weekday: 'short' })}
              </span>
              <img
                src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                alt="Forecast icon"
                className="h-10 w-10 object-contain my-1"
              />
              <span className="block text-xs font-black text-slate-700 font-display">{day.temp}°C</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WeatherWidget;
