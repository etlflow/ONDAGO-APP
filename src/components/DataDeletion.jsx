import React, { useState } from 'react';
import useAuth from '../hooks/useAuth';
import { Trash2, AlertTriangle, AlertCircle } from 'lucide-react';

export function DataDeletion() {
  const { signOut, user } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async (e) => {
    e.preventDefault();
    if (confirmText !== 'DELETE MY DATA') {
      setError('Please type the phrase exactly as shown to confirm.');
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const token = await user.getIdToken();
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/delete-user-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error('Server deletion request failed.');
      }

      // Deletion successful - force logout and state wipe
      alert('Your account and all matching data have been completely deleted.');
      await signOut();

    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred during deletion. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="border border-red-200 bg-red-50/40 rounded-3xl p-6 md:p-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
          <Trash2 size={22} />
        </div>
        <div>
          <h3 className="text-base font-bold text-red-900 font-display">Delete Account & Data</h3>
          <p className="text-[10px] text-red-700/80 font-bold uppercase tracking-wider">GDPR & CCPA Compliant Deletion</p>
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        You have the right to be forgotten. Triggering this flow will immediately delete your user profile, all flight tracking documents, weather summaries, packing lists, journal note details, and uploaded photos in Firebase Storage. This action is irreversible.
      </p>

      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xs transition-colors shadow-sm focus-ring flex items-center gap-2"
        >
          <Trash2 size={13} />
          <span>Request Data Deletion</span>
        </button>
      ) : (
        <form onSubmit={handleDelete} className="space-y-4 pt-2 border-t border-red-200/40">
          <div className="bg-red-100/60 border border-red-200 p-4.5 rounded-2xl flex gap-3 text-red-800 text-xs">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 animate-bounce" />
            <div>
              <span className="font-bold block mb-0.5">Critical Warning:</span>
              This will permanently wipe your login credentials and all files in storage. Confirm by typing the validation text below.
            </div>
          </div>

          <div>
            <label htmlFor="confirm-delete-input" className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">
              Type "DELETE MY DATA" to verify:
            </label>
            <input
              id="confirm-delete-input"
              type="text"
              required
              className="w-full bg-white border border-red-200 rounded-2xl px-4 py-3 text-xs font-mono font-bold placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 text-red-700"
              placeholder="DELETE MY DATA"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={deleting}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-100/50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-bold">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={deleting}
              className="px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {deleting ? 'Wiping Account...' : 'Permanently Delete Everything'}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => { setShowConfirm(false); setConfirmText(''); setError(''); }}
              className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold rounded-xl text-xs transition-colors focus-ring"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default DataDeletion;
