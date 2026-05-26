import React, { useState, useEffect } from 'react';
import useTripStore from '../hooks/useTripStore';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { profileSchema } from '../utils/validation';
import DataDeletion from './DataDeletion';
import { User, Plus, Trash2, Shield, Settings, Server, Check, AlertCircle } from 'lucide-react';

export function AISettings() {
  const { userProfile, setUserProfile, isOnline } = useTripStore();
  const [name, setName] = useState('');
  const [childrenList, setChildrenList] = useState([]);
  const [preferredAirports, setPreferredAirports] = useState([]);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('');
  
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState(2);
  const [airportInput, setAirportInput] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Fetch existing profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const user = auth.currentUser;
        if (!user) return;

        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const profile = snap.data().profile || {};
          setName(profile.name || '');
          setChildrenList(profile.children || []);
          setPreferredAirports(profile.preferredAirports || []);
          setMfaEnabled(profile.mfaEnabled || false);
          
          if (profile.ollamaBaseUrl) {
            setOllamaUrl('●●●●●●●●●●●●●●●●'); // mask existing
          } else {
            setOllamaUrl('');
          }
          
          setUserProfile(profile);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load settings from database.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const addChild = () => {
    if (!childName.trim()) return;
    if (childrenList.length >= 10) return;
    
    setChildrenList([...childrenList, { name: childName.trim(), age: parseInt(childAge) || 0 }]);
    setChildName('');
    setChildAge(2);
  };

  const removeChild = (idx) => {
    setChildrenList(childrenList.filter((_, i) => i !== idx));
  };

  const addAirport = () => {
    const code = airportInput.trim().toUpperCase();
    if (code.length !== 3) return;
    if (preferredAirports.includes(code)) return;
    if (preferredAirports.length >= 5) return;

    setPreferredAirports([...preferredAirports, code]);
    setAirportInput('');
  };

  const removeAirport = (code) => {
    setPreferredAirports(preferredAirports.filter(ap => ap !== code));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    // Client-side schema check via Zod
    const dataToCheck = {
      name,
      children: childrenList,
      preferredAirports,
      mfaEnabled
    };

    const validation = profileSchema.safeParse(dataToCheck);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    if (!isOnline) {
      setError('Cannot save settings while offline. Please connect to the internet.');
      return;
    }

    setSaving(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();

      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/save-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...dataToCheck,
          ollamaBaseUrl: ollamaUrl
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess('Settings updated successfully.');
      setUserProfile(dataToCheck);
      
      // Update local storage PWA values
      localStorage.setItem('userProfile', JSON.stringify(dataToCheck));

    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred while saving profile settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-teal-600 gap-3 text-xs">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Retrieving profile credentials...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      
      {/* Settings Form */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-teal-500/10 text-teal-600 rounded-2xl">
            <Settings size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 font-display">Parent Profile Settings</h2>
            <p className="text-xs text-slate-400 font-medium">Manage family lists, MFA security, and AI endpoints</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* 1. Name */}
          <div>
            <label htmlFor="settings-name" className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
              Parent Display Name
            </label>
            <input
              id="settings-name"
              type="text"
              required
              className="w-full bg-slate-100 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs focus:border-teal-500 outline-none text-slate-800 font-medium"
              placeholder="e.g. Sarah Connor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* 2. Children Profiles */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider">
              Children Profiles
            </label>
            
            <div className="flex gap-2 items-center">
              <input
                type="text"
                className="flex-grow bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-2 text-xs placeholder-slate-400 focus:border-teal-500 outline-none text-slate-800"
                placeholder="Child's Name"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                disabled={saving}
              />
              <input
                type="number"
                min="0"
                max="18"
                className="w-16 bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:border-teal-500 outline-none"
                value={childAge}
                onChange={(e) => setChildAge(e.target.value)}
                disabled={saving}
              />
              <button
                type="button"
                onClick={addChild}
                disabled={saving}
                className="p-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm focus-ring"
              >
                <Plus size={16} />
              </button>
            </div>

            {childrenList.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {childrenList.map((kid, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200/50 rounded-xl text-xs text-slate-600 font-semibold"
                  >
                    <span>{kid.name} ({kid.age} yo)</span>
                    <button
                      type="button"
                      onClick={() => removeChild(idx)}
                      className="text-slate-400 hover:text-red-500 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Preferred Airports */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider">
              Preferred Airport Codes
            </label>
            
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={3}
                className="w-24 bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-2 text-xs placeholder-slate-400 focus:border-teal-500 outline-none text-slate-800 uppercase text-center font-bold tracking-widest"
                placeholder="JFK"
                value={airportInput}
                onChange={(e) => setAirportInput(e.target.value)}
                disabled={saving}
              />
              <button
                type="button"
                onClick={addAirport}
                disabled={saving}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm focus-ring"
              >
                Add Code
              </button>
            </div>

            {preferredAirports.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {preferredAirports.map((code) => (
                  <div
                    key={code}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200/50 rounded-xl text-xs text-slate-600 font-bold tracking-wider"
                  >
                    <span>{code}</span>
                    <button
                      type="button"
                      onClick={() => removeAirport(code)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Local Ollama Endpoint */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <Server size={14} />
              <span>Self-Hosted Ollama URL</span>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
              Store a local network address (e.g. `http://192.168.1.100:11434`). It is encrypted using AES-256 in Firestore and decrypted only on API route lookups.
            </p>

            <input
              type="text"
              className="w-full bg-slate-100 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs placeholder-slate-400 focus:border-teal-500 outline-none text-slate-800 font-medium"
              placeholder="e.g. http://192.168.1.50:11434"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* 5. Optional MFA configuration */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <Shield size={14} />
              <span>Two-Factor Authentication (MFA)</span>
            </div>
            <div className="flex items-start justify-between">
              <p className="text-[11px] text-slate-400 leading-relaxed pr-6">
                Enable multi-factor protection. In addition to password checks, an OTP token is sent via email during login. Recommended to block child tracking attempts.
              </p>
              <input
                type="checkbox"
                className="h-5 w-5 mt-1 rounded border-slate-200 text-teal-600 focus:ring-teal-500 cursor-pointer"
                checked={mfaEnabled}
                onChange={(e) => setMfaEnabled(e.target.checked)}
                disabled={saving}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-semibold">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-2xl text-xs font-semibold">
              <Check size={15} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-colors shadow-md text-xs flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Save Profile Settings'
            )}
          </button>
        </form>
      </div>

      {/* GDPR Data deletion block */}
      <DataDeletion />
    </div>
  );
}

export default AISettings;
