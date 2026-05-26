import React, { useState, useEffect, useRef } from 'react';
import useTripStore from '../hooks/useTripStore';
import { auth } from '../services/firebase';
import { MessageSquare, Send, Bot, User, HelpCircle, AlertCircle, WifiOff, Cpu, RefreshCw } from 'lucide-react';

export function AICompanion() {
  const { activeTrip, addAiMessage, isOnline } = useTripStore();
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const chatEndRef = useRef(null);

  const messages = activeTrip?.aiHistory || [];
  const flight = activeTrip?.flight;
  const weather = activeTrip?.weather;

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Flash a temporary toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 5000);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (inputMsg.trim().length === 0 || loading) return;

    const userMsg = {
      role: 'user',
      content: inputMsg.trim(),
      timestamp: Date.now()
    };

    setInputMsg('');
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be logged in to chat');

      // 1. Add user message to Zustand immediately
      await addAiMessage(user.uid, activeTrip.id, userMsg);

      if (!isOnline) {
        // Offline flow: We queued the message, now insert a reassuring offline notification
        const offlineReply = {
          role: 'assistant',
          content: 'I noticed you are currently offline. I have queued your message and will answer it immediately when your connection returns.',
          timestamp: Date.now(),
          isOfflinePlaceholder: true
        };
        await addAiMessage(user.uid, activeTrip.id, offlineReply);
        setLoading(false);
        return;
      }

      // 2. Online flow: Fetch secure token
      const token = await user.getIdToken();

      // 3. Make proxy post request to Cloud Function /chat
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          context: { flightData: flight, weatherData: weather }
        })
      });

      if (!res.ok) {
        throw new Error('Chat service encountered an error.');
      }

      const replyData = await res.json();
      
      const assistantMsg = {
        role: 'assistant',
        content: replyData.content,
        timestamp: Date.now(),
        provider: replyData.providerUsed
      };

      // 4. Save response to store & database
      await addAiMessage(user.uid, activeTrip.id, assistantMsg);

      // Check if fallback was activated on backend
      if (replyData.backupActive) {
        showToast('Switched to backup AI');
      }

    } catch (err) {
      console.error('Chat send error:', err);
      const errorMsg = {
        role: 'assistant',
        content: 'I apologize, but I had trouble reaching the servers. Please try again in a moment.',
        timestamp: Date.now()
      };
      const user = auth.currentUser;
      if (user) {
        await addAiMessage(user.uid, activeTrip.id, errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const isOllamaActive = messages.some(msg => msg.provider === 'ollama');

  return (
    <div className="glass-card flex flex-col h-[70vh] md:h-[80vh] overflow-hidden relative">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg animate-bounce">
          <RefreshCw size={12} className="animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-slate-900 text-white px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl">
            <MessageSquare size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide font-display">AI Travel Companion</h2>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              {flight ? `Context: Flight ${flight.flightNumber}` : 'Parent Stress-Reduction Assistant'}
            </p>
          </div>
        </div>

        {/* Ollama local model badge */}
        {isOllamaActive && (
          <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Cpu size={10} />
            <span>Local model — data stays on device</span>
          </div>
        )}
      </div>

      {/* Scrollable Conversation List */}
      <div className="flex-grow overflow-y-auto p-5 space-y-4 bg-slate-50/50 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="text-center py-12 px-6 flex flex-col items-center">
            <div className="w-14 h-14 bg-teal-50 flex items-center justify-center rounded-full text-teal-600 mb-4 animate-pulse">
              <Bot size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Start a reassurance conversation</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-2 leading-relaxed">
              Ask about child-friendly gates, snack bars, weather tips, or toddler delay survival calm-down scripts.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Profile Icon */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                  isUser ? 'bg-teal-600 text-white' : 'bg-slate-800 text-teal-400'
                }`}>
                  {isUser ? <User size={14} /> : <Bot size={14} />}
                </div>

                {/* Bubble Content */}
                <div className={`p-4 rounded-2xl border text-xs leading-relaxed font-medium shadow-sm ${
                  isUser
                    ? 'bg-teal-600 border-teal-500 text-white rounded-tr-none'
                    : msg.isOfflinePlaceholder
                    ? 'bg-amber-50 border-amber-200 text-slate-600 rounded-tl-none flex items-center gap-2'
                    : 'bg-white border-slate-100 text-slate-700 rounded-tl-none'
                }`}>
                  {msg.isOfflinePlaceholder && <WifiOff size={14} className="text-amber-500 shrink-0" />}
                  <div>{msg.content}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Message Form */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white flex gap-3 shrink-0 items-center">
        <input
          type="text"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder={isOnline ? "Ask about gates, food, calm-down scripts..." : "Offline mode. Queued to send..."}
          disabled={!activeTrip}
          className="flex-grow bg-slate-100 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-800"
        />
        <button
          type="submit"
          disabled={inputMsg.trim().length === 0 || loading || !activeTrip}
          className="p-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-2xl shadow transition-colors flex items-center justify-center focus-ring"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

export default AICompanion;
