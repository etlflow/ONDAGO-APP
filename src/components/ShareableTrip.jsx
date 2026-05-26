import React, { useState } from 'react';
import { shareNoteSchema } from '../utils/validation';
import { auth } from '../services/firebase';
import { X, Copy, Check, Link, Clock, AlertCircle } from 'lucide-react';

export function ShareableTrip({ tripId, onClose }) {
  const [note, setNote] = useState('');
  const [tokenLink, setTokenLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation with Zod
    const validationResult = shareNoteSchema.safeParse(note);
    if (!validationResult.success) {
      setError(validationResult.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();

      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/share-trip`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tripId,
          note: note.trim()
        })
      });

      if (!res.ok) {
        throw new Error('Failed to generate sharing token.');
      }

      const data = await res.json();
      // Generate clean caregiver link with query parameter token
      const shareUrl = `${window.location.origin}?token=${data.tokenId}`;
      setTokenLink(shareUrl);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error generating link.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(tokenLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors focus-ring"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-teal-500/10 text-teal-600 rounded-xl">
            <Link size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 font-display">Share Trip Link</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Generates secure, read-only token</p>
          </div>
        </div>

        {!tokenLink ? (
          /* Input Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Generate a unique signed link that allows anyone (like a grandparent or babysitter) to view your flight status and notes without needing an account. Links expire after 24 hours.
            </p>

            <div>
              <label htmlFor="share-note" className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                Parent Note for Caregiver (Optional)
              </label>
              <textarea
                id="share-note"
                rows={2}
                className="w-full bg-slate-100 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-800"
                placeholder="e.g. Granny, I'll text you when we get off the plane. Flight looks on time!"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-xs font-semibold">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-650 text-white font-bold rounded-2xl transition-colors shadow-md text-xs flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Generate signed link'
              )}
            </button>
          </form>
        ) : (
          /* Link Display Box */
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-100 p-4.5 rounded-2xl flex items-center gap-3">
              <Clock size={16} className="text-emerald-600 shrink-0" />
              <div className="text-xs text-emerald-800">
                <span className="font-bold">Link generated!</span> Expiring in 24 hours. Your personal details, child lists, and account keys remain hidden.
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200/80 rounded-2xl p-3.5 pl-4 overflow-hidden">
              <span className="text-xs text-slate-500 truncate flex-grow pr-2 font-mono">
                {tokenLink}
              </span>
              <button
                onClick={handleCopy}
                className="p-3.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition-colors shrink-0 shadow-sm flex items-center gap-1.5 focus-ring text-xs font-bold"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-2xl transition-colors focus-ring"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShareableTrip;
