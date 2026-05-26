import { create } from 'zustand';
import { db } from '../services/firebase';
import { doc, updateDoc, arrayUnion, setDoc, getDoc } from 'firebase/firestore';

const initialState = {
  userProfile: null,
  activeTrip: null,
  tripsHistory: [],
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  offlineQueue: [],
  isLoadingTrip: false,
  apiError: null
};

export const useTripStore = create((set, get) => ({
  ...initialState,

  // Set online status
  setOnlineStatus: (status) => set({ isOnline: status }),

  // Set user profile
  setUserProfile: (userProfile) => set({ userProfile }),

  // Set trips history
  setTripsHistory: (tripsHistory) => set({ tripsHistory }),

  // Set Loading
  setLoadingTrip: (isLoadingTrip) => set({ isLoadingTrip }),

  // Set error
  setApiError: (apiError) => set({ apiError }),

  // Clear Store (called on logout)
  clearStore: () => {
    set(initialState);
  },

  // Set active trip
  setActiveTrip: (activeTrip) => set({ activeTrip }),

  // Set flight data
  setFlightData: async (uid, tripId, flight) => {
    const activeTrip = get().activeTrip;
    if (!activeTrip) return;

    const updatedTrip = { ...activeTrip, flight };
    set({ activeTrip: updatedTrip });

    // Sync to Firestore if online
    if (get().isOnline && uid) {
      try {
        const tripRef = doc(db, 'users', uid, 'trips', tripId);
        await updateDoc(tripRef, { flight });
      } catch (err) {
        console.error('Error saving flight to Firestore:', err);
      }
    }
  },

  // Set weather data
  setWeatherData: async (uid, tripId, weather) => {
    const activeTrip = get().activeTrip;
    if (!activeTrip) return;

    const updatedTrip = { ...activeTrip, weather };
    set({ activeTrip: updatedTrip });

    if (get().isOnline && uid) {
      try {
        const tripRef = doc(db, 'users', uid, 'trips', tripId);
        await updateDoc(tripRef, { weather });
      } catch (err) {
        console.error('Error saving weather to Firestore:', err);
      }
    }
  },

  // Load packing list
  setPackingList: async (uid, tripId, packingList) => {
    const activeTrip = get().activeTrip;
    if (!activeTrip) return;

    const updatedTrip = { ...activeTrip, packingList };
    set({ activeTrip: updatedTrip });

    if (get().isOnline && uid) {
      try {
        const tripRef = doc(db, 'users', uid, 'trips', tripId);
        await updateDoc(tripRef, { packingList });
      } catch (err) {
        console.error('Error saving packing list to Firestore:', err);
      }
    }
  },

  // Toggle checklist item
  togglePackingItem: async (uid, tripId, itemIndex) => {
    const activeTrip = get().activeTrip;
    if (!activeTrip || !activeTrip.packingList) return;

    const updatedList = [...activeTrip.packingList];
    updatedList[itemIndex] = {
      ...updatedList[itemIndex],
      checked: !updatedList[itemIndex].checked
    };

    const updatedTrip = { ...activeTrip, packingList: updatedList };
    set({ activeTrip: updatedTrip });

    // LocalStorage cache for PWA offline fallback
    localStorage.setItem(`packingList_${tripId}`, JSON.stringify(updatedList));

    if (get().isOnline && uid) {
      try {
        const tripRef = doc(db, 'users', uid, 'trips', tripId);
        await updateDoc(tripRef, { packingList: updatedList });
      } catch (err) {
        console.error('Error updating packing item status:', err);
      }
    }
  },

  // Add journal entry
  addJournalEntry: async (uid, tripId, entry) => {
    const activeTrip = get().activeTrip;
    if (!activeTrip) return;

    const updatedJournal = [...(activeTrip.journal || []), entry];
    const updatedTrip = { ...activeTrip, journal: updatedJournal };
    set({ activeTrip: updatedTrip });

    if (get().isOnline && uid) {
      try {
        const tripRef = doc(db, 'users', uid, 'trips', tripId);
        await updateDoc(tripRef, { journal: updatedJournal });
      } catch (err) {
        console.error('Error adding journal entry to Firestore:', err);
      }
    }
  },

  // Set AI conversation history
  setAiHistory: (aiHistory) => {
    const activeTrip = get().activeTrip;
    if (!activeTrip) return;
    set({ activeTrip: { ...activeTrip, aiHistory } });
  },

  // Add AI chat message (and sync to Firestore)
  addAiMessage: async (uid, tripId, message) => {
    const activeTrip = get().activeTrip;
    if (!activeTrip) return;

    const updatedHistory = [...(activeTrip.aiHistory || []), message];
    set({ activeTrip: { ...activeTrip, aiHistory: updatedHistory } });

    if (get().isOnline && uid) {
      try {
        const tripRef = doc(db, 'users', uid, 'trips', tripId);
        await updateDoc(tripRef, { aiHistory: updatedHistory });
      } catch (err) {
        console.error('Error syncing AI message to Firestore:', err);
      }
    } else {
      // Queue it if we're offline
      get().queueOfflineMessage({ uid, tripId, message });
    }
  },

  // Queue offline chat message
  queueOfflineMessage: (payload) => {
    set((state) => ({
      offlineQueue: [...state.offlineQueue, payload]
    }));
  },

  // Process and clear offline queue
  syncOfflineQueue: async (getIdToken) => {
    const queue = get().offlineQueue;
    if (queue.length === 0) return;

    console.log(`Synchronizing ${queue.length} offline queued AI messages...`);
    const token = await getIdToken();

    for (const item of queue) {
      const { uid, tripId, message } = item;
      try {
        // Only run chat request on server if the message is from the user
        if (message.role === 'user') {
          const activeTrip = get().activeTrip;
          const context = {
            flightData: activeTrip?.flight,
            weatherData: activeTrip?.weather
          };

          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chat`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: [...(activeTrip?.aiHistory || []).filter(m => m.timestamp < message.timestamp), message],
              context
            })
          });

          if (res.ok) {
            const reply = await res.json();
            const assistantMsg = {
              role: 'assistant',
              content: reply.content,
              timestamp: Date.now()
            };

            // Add the assistant response to the store
            const latestHistory = [...get().activeTrip.aiHistory, assistantMsg];
            set({ activeTrip: { ...get().activeTrip, aiHistory: latestHistory } });

            // Write final synchronized list to Firestore
            const tripRef = doc(db, 'users', uid, 'trips', tripId);
            await updateDoc(tripRef, { aiHistory: latestHistory });
          }
        }
      } catch (err) {
        console.error('Failed to sync queued message:', err);
      }
    }

    set({ offlineQueue: [] });
  }
}));

export default useTripStore;
