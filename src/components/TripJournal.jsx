import React, { useState } from 'react';
import useTripStore from '../hooks/useTripStore';
import { auth } from '../services/firebase';
import { journalNoteSchema } from '../utils/validation';
import { BookOpen, Camera, Plus, Sparkles, Trash2, Calendar, FileText, AlertCircle, Eye } from 'lucide-react';

export function TripJournal() {
  const { activeTrip, addJournalEntry, isOnline } = useTripStore();
  const [note, setNote] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState(activeTrip?.journalSummary || '');
  const [error, setError] = useState('');

  const journal = activeTrip?.journal || [];
  const flight = activeTrip?.flight;
  const tripId = activeTrip?.id;

  const handleImageChange = (e) => {
    setError('');
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit client-side: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed.');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    setError('');

    // Zod validation of notes
    const validationResult = journalNoteSchema.safeParse(note);
    if (!validationResult.success) {
      setError(validationResult.error.errors[0].message);
      return;
    }

    if (!activeTrip) {
      setError('Please start a trip first before writing a journal entry.');
      return;
    }

    setUploading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();

      let photoURL = '';

      // Upload and re-encode photo if present
      if (imagePreview) {
        if (!isOnline) {
          throw new Error('Offline mode. Photo upload requires internet connectivity.');
        }

        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/upload-journal-photo`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            photoBase64: imagePreview,
            tripId: tripId
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Photo upload failed');
        }

        const data = await res.json();
        photoURL = data.photoURL;
      }

      // Construct sanitized entry
      const entry = {
        timestamp: Date.now(),
        note: note.replace(/<[^>]*>/g, ''), // Strip raw html client-side
        photoURL,
        flightTag: flight?.flightNumber || 'General',
        destinationTag: flight?.destination || 'None'
      };

      // Add to Zustand and Firestore
      await addJournalEntry(user.uid, tripId, entry);

      // Reset state
      setNote('');
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to add journal entry.');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (journal.length === 0) {
      setError('Add some journal notes first before generating a summary.');
      return;
    }
    if (!isOnline) {
      setError('Offline mode. Summarization requires network connectivity.');
      return;
    }

    setGeneratingSummary(true);
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();

      // Compile notes context
      const notesContext = journal.map(j => `- [Tag: ${j.flightTag}]: ${j.note}`).join('\n');
      const prompt = `Here are my travel journal notes for this trip:\n${notesContext}\n\nGenerate a warm, brief, cohesive 1-paragraph summary of this trip suited for a family keepsake log. Keep it comforting and focus on positive milestones.`;

      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!res.ok) throw new Error('Failed to generate summary');
      const data = await res.json();

      setSummary(data.content);

      // Save summary inside trip doc in Firestore
      const { db } = await import('../services/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', user.uid, 'trips', tripId), {
        journalSummary: data.content
      });

      // Cache summary in activeTrip state
      useTripStore.setState(state => {
        if (state.activeTrip && state.activeTrip.id === tripId) {
          return { activeTrip: { ...state.activeTrip, journalSummary: data.content } };
        }
        return {};
      });

    } catch (err) {
      console.error(err);
      setError('Failed to compile memory summary.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Edit panel / Add Entry */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-teal-500/10 text-teal-600 rounded-2xl">
            <BookOpen size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 font-display">Trip Journal</h2>
            <p className="text-xs text-slate-400 font-medium">Record trip milestones and upload photos for your family</p>
          </div>
        </div>

        <form onSubmit={handleAddEntry} className="space-y-4.5">
          <div>
            <label htmlFor="journal-note" className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
              Add Journal Log
            </label>
            <textarea
              id="journal-note"
              required
              rows={3}
              className="w-full bg-slate-100 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-800"
              placeholder="What happened today? (e.g. Baby slept through the delay, toddler loved watching the planes take off!)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={uploading}
            />
          </div>

          {/* Photo attachment inputs */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200/85 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-colors border border-slate-200/50 focus-ring">
              <Camera size={14} />
              <span>Attach Photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
                disabled={uploading}
              />
            </label>

            {imagePreview && (
              <div className="relative h-12 w-12 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-xs font-semibold">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !activeTrip}
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-colors shadow-md text-xs flex items-center justify-center gap-2"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Plus size={14} />
                <span>Save Entry securely</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* AI Summary Section */}
      {journal.length > 0 && (
        <div className="glass-card p-6 md:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-display flex items-center gap-2">
              <Sparkles size={14} className="text-teal-600" />
              <span>AI Journal Summary</span>
            </h3>
            <button
              onClick={handleGenerateSummary}
              disabled={generatingSummary}
              className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold border border-teal-200/50 text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 focus-ring"
            >
              {generatingSummary ? 'Compiling...' : 'Create keepsake summary'}
            </button>
          </div>

          {summary && (
            <div className="bg-teal-50/40 border border-teal-150 p-5 rounded-2xl text-xs text-slate-600 leading-relaxed italic font-medium shadow-sm">
              "{summary}"
            </div>
          )}
        </div>
      )}

      {/* Entries List */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">Journal Entries</h3>
        {journal.length === 0 ? (
          <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-3xl p-6">
            <FileText size={24} className="text-slate-300 mx-auto mb-3" />
            <p className="text-xs text-slate-400 font-medium">No journal entries written yet for this trip.</p>
          </div>
        ) : (
          [...journal].reverse().map((entry, idx) => (
            <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-50 pb-2">
                <span className="flex items-center gap-1.5">
                  <Calendar size={11} />
                  {new Date(entry.timestamp).toLocaleDateString()}
                </span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                  {entry.flightTag} • {entry.destinationTag}
                </span>
              </div>
              
              <div className="flex gap-4">
                {entry.photoURL && (
                  <img
                    src={entry.photoURL}
                    alt="Journal"
                    className="h-20 w-20 object-cover rounded-xl border border-slate-100 shadow-sm shrink-0"
                  />
                )}
                <p className="text-xs text-slate-600 font-medium leading-relaxed self-center">
                  {entry.note}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

export default TripJournal;
