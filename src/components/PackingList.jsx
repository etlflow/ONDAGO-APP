import React, { useState } from 'react';
import useTripStore from '../hooks/useTripStore';
import { auth } from '../services/firebase';
import { Plus, Trash2, CheckSquare, Square, Baby, Sparkles, AlertCircle } from 'lucide-react';

export function PackingList() {
  const { activeTrip, togglePackingItem, setPackingList, isOnline } = useTripStore();
  const [kids, setKids] = useState([{ age: 2 }]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const packingList = activeTrip?.packingList || [];
  const tripId = activeTrip?.id;

  const addKidField = () => {
    if (kids.length >= 5) return;
    setKids([...kids, { age: 3 }]);
  };

  const removeKidField = (idx) => {
    setKids(kids.filter((_, i) => i !== idx));
  };

  const updateKidAge = (idx, ageVal) => {
    const updated = [...kids];
    updated[idx] = { age: parseInt(ageVal) || 0 };
    setKids(updated);
  };

  const generatePackingList = async () => {
    if (kids.length === 0) {
      setError('Please add at least one child age.');
      return;
    }
    if (!isOnline) {
      setError('Offline mode. Packing list generation requires an active network connection.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();

      const kidAgesText = kids.map(k => `${k.age} years old`).join(', ');
      const prompt = `Generate a modern travel packing checklist for kids of ages: [${kidAgesText}] as a JSON array of objects. Each object must have fields "item" (string) and "category" (either "carry-on" or "checked"). Make it highly tailored to these specific ages. Avoid explanation, return ONLY the raw JSON array. Example output: [{"item":"Baby formula","category":"carry-on"}]`;

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

      if (!res.ok) throw new Error('Failed to generate packing list.');

      const reply = await res.json();
      
      // Attempt to extract and parse JSON from assistant response
      let list = [];
      const jsonStart = reply.content.indexOf('[');
      const jsonEnd = reply.content.lastIndexOf(']') + 1;
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = reply.content.substring(jsonStart, jsonEnd);
        list = JSON.parse(jsonStr);
      } else {
        throw new Error('LLM output was not valid JSON');
      }

      // Append 'checked: false' to all items
      const items = list.map(i => ({
        item: i.item,
        category: i.category === 'checked' ? 'checked' : 'carry-on',
        checked: false
      }));

      await setPackingList(user.uid, tripId, items);

    } catch (err) {
      console.error('Packing list error:', err);
      setError('Could not customize checklist. Falling back to default list.');
      
      // Fallback checklist
      const fallbackList = [
        { item: 'Diapers and wipes', category: 'carry-on', checked: false },
        { item: 'Extra change of clothes (x2)', category: 'carry-on', checked: false },
        { item: 'Baby bottles / Sippy cup', category: 'carry-on', checked: false },
        { item: 'Small toys & storybooks', category: 'carry-on', checked: false },
        { item: 'Stroller & Car seat', category: 'checked', checked: false },
        { item: 'First aid & kids medicines', category: 'checked', checked: false }
      ];
      const user = auth.currentUser;
      if (user) {
        await setPackingList(user.uid, tripId, fallbackList);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = (idx) => {
    const user = auth.currentUser;
    if (user && tripId) {
      togglePackingItem(user.uid, tripId, idx);
    }
  };

  // Group items by category
  const carryOnItems = packingList.filter(i => i.category === 'carry-on');
  const checkedItems = packingList.filter(i => i.category === 'checked');

  return (
    <div className="glass-card p-6 md:p-8 space-y-6">
      
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-teal-500/10 text-teal-600 rounded-2xl">
          <Baby size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display font-display">Kid Mode Packing List</h2>
          <p className="text-xs text-slate-400 font-medium">Customize checklists based on your children's ages</p>
        </div>
      </div>

      {packingList.length === 0 ? (
        /* Setup / Generation panel */
        <div className="space-y-5 bg-slate-50/60 border border-slate-100 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-slate-700 text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} className="text-teal-600" />
            <span>Generate Checklist</span>
          </div>

          <div className="space-y-3.5">
            {kids.map((kid, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 w-16">Child #{idx + 1} Age:</span>
                <input
                  type="number"
                  min="0"
                  max="17"
                  className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:border-teal-500 outline-none"
                  value={kid.age}
                  onChange={(e) => updateKidAge(idx, e.target.value)}
                  disabled={generating}
                />
                {kids.length > 1 && (
                  <button
                    onClick={() => removeKidField(idx)}
                    className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {kids.length < 5 && (
            <button
              onClick={addKidField}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-bold focus-ring"
            >
              <Plus size={14} />
              <span>Add another child profile</span>
            </button>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 p-3.5 rounded-xl text-xs font-semibold">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={generatePackingList}
            disabled={generating}
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-colors shadow-md text-xs flex items-center justify-center gap-2"
          >
            {generating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Generate Age-Customized Checklist</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Checklist display panel */
        <div className="space-y-6">
          {/* Carry-on category */}
          {carryOnItems.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Carry-On Bag Checklist</h4>
              <div className="space-y-2">
                {packingList.map((item, idx) => {
                  if (item.category !== 'carry-on') return null;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggle(idx)}
                      className="flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-100/60 p-4 rounded-xl cursor-pointer select-none transition-colors"
                    >
                      {item.checked ? (
                        <CheckSquare size={16} className="text-teal-600 shrink-0" />
                      ) : (
                        <Square size={16} className="text-slate-400 shrink-0" />
                      )}
                      <span className={`text-xs font-semibold text-slate-700 ${item.checked ? 'line-through text-slate-400' : ''}`}>
                        {item.item}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checked category */}
          {checkedItems.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-display">Checked Baggage Checklist</h4>
              <div className="space-y-2">
                {packingList.map((item, idx) => {
                  if (item.category !== 'checked') return null;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggle(idx)}
                      className="flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-100/60 p-4 rounded-xl cursor-pointer select-none transition-colors"
                    >
                      {item.checked ? (
                        <CheckSquare size={16} className="text-teal-600 shrink-0" />
                      ) : (
                        <Square size={16} className="text-slate-400 shrink-0" />
                      )}
                      <span className={`text-xs font-semibold text-slate-700 ${item.checked ? 'line-through text-slate-400' : ''}`}>
                        {item.item}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reset Checklist option */}
          <div className="text-right pt-2">
            <button
              onClick={() => {
                const user = auth.currentUser;
                if (user) setPackingList(user.uid, tripId, []);
              }}
              className="text-xs text-slate-400 hover:text-red-500 font-bold uppercase tracking-wider transition-colors focus-ring"
            >
              Reset checklist and start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PackingList;
