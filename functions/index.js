const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors');
const { z } = require('zod');
const axios = require('axios');
const sharp = require('sharp');
const crypto = require('crypto');

const { checkRateLimit } = require('./utils/rateLimiter');
const { chat } = require('./llm/adapter');

admin.initializeApp();

// Strict CORS config: allow local development and host domains only
const allowedOrigins = [
  'https://ondago-f973b.web.app',
  'https://ondago-f973b.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5000'
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

const corsHandler = cors(corsOptions);

// Authentication Middleware
async function authenticateUser(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return null;
  }
}

// ----------------------------------------
// Cloud Function Endpoint Router
// ----------------------------------------
exports.api = functions.https.onRequest(async (req, res) => {
  // CORS check
  return corsHandler(req, res, async () => {
    const path = req.path.replace(/\/$/, ''); // strip trailing slash

    // 1. PUBLIC CHECK: Preflight OPTIONS requests are handled by CORS middleware
    if (req.method === 'OPTIONS') {
      return;
    }

    // 2. AUTHENTICATION (All endpoints are authenticated)
    const user = await authenticateUser(req, res);
    if (!user) return; // Response sent in authenticateUser

    try {
      // Route routing
      if (path === '/chat' && req.method === 'POST') {
        return await handleChat(req, res, user);
      } else if (path === '/flight-lookup' && req.method === 'GET') {
        return await handleFlightLookup(req, res, user);
      } else if (path === '/weather' && req.method === 'GET') {
        return await handleWeatherLookup(req, res, user);
      } else if (path === '/airport-lookup' && req.method === 'GET') {
        return await handleAirportLookup(req, res, user);
      } else if (path === '/share-trip' && req.method === 'POST') {
        return await handleShareTrip(req, res, user);
      } else if (path === '/upload-journal-photo' && req.method === 'POST') {
        return await handleUploadPhoto(req, res, user);
      } else if (path === '/signout' && req.method === 'POST') {
        return await handleSignOut(req, res, user);
      } else if (path === '/save-settings' && req.method === 'POST') {
        return await handleSaveSettings(req, res, user);
      } else if (path === '/delete-user-data' && req.method === 'POST') {
        return await handleDeleteUserData(req, res, user);
      } else {
        return res.status(404).json({ error: `Endpoint ${req.method} ${path} not found` });
      }
    } catch (error) {
      console.error(`Error in route ${path}:`, error);
      return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  });
});

// ----------------------------------------
// Route Handlers
// ----------------------------------------

// 1. AI Chat Route Handler
const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000)
  })),
  context: z.object({
    flightData: z.any().optional(),
    weatherData: z.any().optional()
  }).optional()
});

async function handleChat(req, res, user) {
  // Enforce Rate Limit: max 60 requests per hour
  const rateLimit = await checkRateLimit(user.uid, 'llm', 60);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Rate limit exceeded. Max 60 AI chats per hour.' });
  }

  // Validate Input
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input schema', details: parsed.error });
  }

  const { messages, context } = parsed.data;

  // Retrieve Remote Config or default values
  let activeProvider = 'google';
  let activeModel = 'gemini-2.0-flash';
  let activeTemp = 0.7;
  let fallbackProvider = 'openai';
  let fallbackModel = 'gpt-4o-mini';

  try {
    const rc = admin.remoteConfig();
    const template = await rc.getTemplate();
    const llmProv = template.parameters['llm_provider']?.defaultValue?.value;
    const llmModel = template.parameters['llm_model']?.defaultValue?.value;
    const llmTemp = template.parameters['llm_temperature']?.defaultValue?.value;
    const fallbackProv = template.parameters['llm_fallback_provider']?.defaultValue?.value;
    const fallbackMod = template.parameters['llm_fallback_model']?.defaultValue?.value;

    if (llmProv) activeProvider = llmProv;
    if (llmModel) activeModel = llmModel;
    if (llmTemp) activeTemp = parseFloat(llmTemp);
    if (fallbackProv) fallbackProvider = fallbackProv;
    if (fallbackMod) fallbackModel = fallbackMod;
  } catch (err) {
    console.warn('Remote Config retrieval failed, using standard code fallbacks:', err.message);
  }

  // Injected System Prompt
  const systemPrompt = `You are a calm, warm, practical travel companion for parents on the go.
The user may be traveling solo (kids at home) or traveling with young children.
Always be brief, reassuring, and actionable.
Active flight: ${JSON.stringify(context?.flightData || 'None active')}.
Destination weather: ${JSON.stringify(context?.weatherData || 'No weather forecast available')}.
Tailor every response to their parenting context.
Never ask for or acknowledge personal identifying information beyond what is provided.`;

  let backupActive = false;
  try {
    // Attempt Primary Provider
    const result = await chat({
      messages,
      systemPrompt,
      provider: activeProvider,
      model: activeModel,
      uid: user.uid
    });
    return res.status(200).json({ ...result, backupActive });
  } catch (error) {
    console.warn(`Primary provider (${activeProvider}) failed, retrying fallback:`, error.message);
    
    // Attempt Fallback Provider
    try {
      backupActive = true;
      const result = await chat({
        messages,
        systemPrompt,
        provider: fallbackProvider,
        model: fallbackModel,
        uid: user.uid
      });
      return res.status(200).json({ ...result, backupActive });
    } catch (fallbackError) {
      console.error('Fallback provider failed as well:', fallbackError.message);
      return res.status(502).json({ error: 'Both primary and fallback AI services failed. Please try again later.' });
    }
  }
}

// 2. Flight Lookup Handler
const flightNumberRegex = /^[A-Z]{2}\d{1,4}$/i;

async function handleFlightLookup(req, res, user) {
  const flightNumber = req.query.flightNumber;
  if (!flightNumber || !flightNumberRegex.test(flightNumber)) {
    return res.status(400).json({ error: 'Invalid flight number format. Must be e.g. AA123' });
  }

  // Enforce Rate Limit: max 300 requests per hour
  const rateLimit = await checkRateLimit(user.uid, 'flight', 300);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Rate limit exceeded. Max 300 lookups per hour.' });
  }

  const avStackKey = process.env.AVIATIONSTACK_API_KEY;
  if (!avStackKey) {
    return res.status(500).json({ error: 'AviationStack API Key is not configured' });
  }

  try {
    // 1. Fetch schedules from AviationStack
    const avStackUrl = `http://api.aviationstack.com/v1/flights?access_key=${avStackKey}&flight_iata=${encodeURIComponent(flightNumber)}`;
    const response = await axios.get(avStackUrl, { timeout: 8000 });
    const flightData = response.data?.data?.[0];

    if (!flightData) {
      return res.status(404).json({ error: 'Flight not found. Make sure to search by airline iata (e.g. AA123).' });
    }

    // 2. Fetch live data from OpenSky if hex code is available
    let live = null;
    const icao24 = flightData.aircraft?.icao24;
    
    if (flightData.live) {
      live = {
        latitude: flightData.live.latitude,
        longitude: flightData.live.longitude,
        altitude: flightData.live.altitude,
        speed: flightData.live.speed_horizontal,
        lastUpdated: Math.round(new Date(flightData.live.updated).getTime() / 1000)
      };
    } else if (icao24) {
      try {
        const openSkyUrl = `https://opensky-network.org/api/states/all?icao24=${icao24}`;
        const openSkyRes = await axios.get(openSkyUrl, { timeout: 4000 });
        const state = openSkyRes.data?.states?.[0];
        if (state) {
          live = {
            latitude: state[6],
            longitude: state[5],
            altitude: state[7], // baro altitude
            speed: state[9] ? Math.round(state[9] * 3.6) : null, // m/s to km/h
            lastUpdated: state[3] || state[4]
          };
        }
      } catch (err) {
        console.warn('OpenSky API failed, proceeding with schedules only:', err.message);
      }
    }

    // Map raw data into strict internal response schema (minimizing data footprint)
    const result = {
      flightNumber: flightData.flight?.iata || flightNumber,
      status: flightData.flight_status || 'scheduled',
      origin: flightData.departure?.iata || 'TBD',
      destination: flightData.arrival?.iata || 'TBD',
      departureTime: flightData.departure?.estimated || flightData.departure?.scheduled,
      scheduledDeparture: flightData.departure?.scheduled,
      estimatedDeparture: flightData.departure?.estimated,
      departureTerminal: flightData.departure?.terminal || null,
      departureGate: flightData.departure?.gate || null,
      arrivalTime: flightData.arrival?.estimated || flightData.arrival?.scheduled,
      scheduledArrival: flightData.arrival?.scheduled,
      estimatedArrival: flightData.arrival?.estimated,
      arrivalTerminal: flightData.arrival?.terminal || null,
      arrivalGate: flightData.arrival?.gate || null,
      delayMinutes: flightData.departure?.delay || 0,
      live
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Flight lookup error:', error.message);
    return res.status(502).json({ error: 'Flight schedule database is currently unavailable.' });
  }
}

// 3. Weather Lookup Handler
async function handleWeatherLookup(req, res) {
  const city = req.query.city;
  if (!city || city.trim().length === 0) {
    return res.status(400).json({ error: 'Missing city name' });
  }

  const weatherKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!weatherKey) {
    return res.status(500).json({ error: 'OpenWeatherMap API Key is not configured' });
  }

  try {
    // Current Weather
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${weatherKey}&units=metric`;
    // 5-Day Forecast
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${weatherKey}&units=metric`;

    const [currentRes, forecastRes] = await Promise.all([
      axios.get(currentUrl, { timeout: 5000 }),
      axios.get(forecastUrl, { timeout: 5000 })
    ]);

    const currentData = currentRes.data;
    const forecastList = forecastRes.data?.list || [];

    // Filter forecast down to daily intervals (every 24h/8 blocks)
    const dailyForecast = [];
    for (let i = 0; i < forecastList.length; i += 8) {
      const item = forecastList[i];
      dailyForecast.push({
        date: item.dt_txt ? item.dt_txt.split(' ')[0] : new Date(item.dt * 1000).toISOString().split('T')[0],
        temp: Math.round(item.main.temp),
        description: item.weather[0]?.description || 'clear',
        icon: item.weather[0]?.icon || '01d'
      });
    }

    const mapped = {
      city: currentData.name,
      temp: Math.round(currentData.main.temp),
      description: currentData.weather[0]?.description || 'clear',
      icon: currentData.weather[0]?.icon || '01d',
      forecast: dailyForecast.slice(0, 5)
    };

    return res.status(200).json(mapped);
  } catch (error) {
    console.error('Weather lookup error:', error.message);
    return res.status(502).json({ error: 'Weather details are currently unavailable.' });
  }
}

// 4. Airport Auto-complete Handler
async function handleAirportLookup(req, res) {
  const query = req.query.query;
  if (!query || query.trim().length < 2) {
    return res.status(200).json([]);
  }

  const apcKey = process.env.AIRPORT_CODES_KEY || '1ee2b93fe0';
  const apcSecret = process.env.AIRPORT_CODES_SECRET || '86b8fa1526010db';

  try {
    const response = await axios.post(
      'https://www.air-port-codes.com/api/v1/multi',
      `term=${encodeURIComponent(query)}&limit=7`,
      {
        headers: {
          'APC-Auth': apcKey,
          'APC-Auth-Secret': apcSecret,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 5000
      }
    );

    const data = response.data;
    if (!data.status || !data.airports) {
      return res.status(200).json([]);
    }

    const airports = [];
    data.airports.forEach(ap => {
      airports.push({
        code: ap.iata,
        name: ap.name,
        city: ap.city,
        state: ap.state?.abbr || '',
        country: ap.country?.name || ''
      });
      // Add child airports if any
      if (ap.children) {
        ap.children.forEach(child => {
          airports.push({
            code: child.iata,
            name: child.name,
            city: child.city,
            state: child.state?.abbr || '',
            country: child.country?.name || ''
          });
        });
      }
    });

    return res.status(200).json(airports);
  } catch (error) {
    console.error('Airport lookup error:', error.message);
    return res.status(200).json([]);
  }
}

// 5. Trip Link Sharing Token Generator
const shareSchema = z.object({
  tripId: z.string(),
  note: z.string().max(500)
});

async function handleShareTrip(req, res, user) {
  const parsed = shareSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid share inputs', details: parsed.error });
  }

  const { tripId, note } = parsed.data;

  // Retrieve user trip from Firestore
  const db = admin.firestore();
  const tripRef = db.collection('users').doc(user.uid).collection('trips').doc(tripId);
  const tripSnap = await tripRef.get();

  if (!tripSnap.exists) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  const trip = tripSnap.data();

  // Create random token
  const tokenId = crypto.randomBytes(24).toString('hex');
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000); // 24h

  // Write to public sharedTrips root collection without parent UID
  await db.collection('sharedTrips').doc(tokenId).set({
    tripPath: tripRef.path, // stored internally but not returned to caregiver UI
    flightNumber: trip.flight?.flightNumber || 'Unknown',
    origin: trip.flight?.origin || 'Unknown',
    destination: trip.flight?.destination || 'Unknown',
    departureTime: trip.flight?.departureTime || null,
    status: trip.flight?.status || 'scheduled',
    eta: trip.flight?.arrivalTime || null,
    note: note,
    expiresAt: expiresAt
  });

  return res.status(200).json({ tokenId, expiresAt: expiresAt.toDate() });
}

// 6. Upload Journal Photo Handler (Base64 + sharp processing)
const uploadSchema = z.object({
  photoBase64: z.string(),
  tripId: z.string()
});

async function handleUploadPhoto(req, res, user) {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid upload inputs', details: parsed.error });
  }

  const { photoBase64, tripId } = parsed.data;

  // Strip data header
  const regex = /^data:image\/\w+;base64,/;
  if (!regex.test(photoBase64)) {
    return res.status(400).json({ error: 'Invalid photo format. Base64 data url required.' });
  }

  const base64Data = photoBase64.replace(regex, '');
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image size exceeds maximum limit of 10MB.' });
  }

  let processedBuffer;
  try {
    // Sharp re-encodes, resizes, and compresses to strip malicious payloads (EXIF injections/polyglots)
    processedBuffer = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch (err) {
    return res.status(400).json({ error: 'Failed to process image. Make sure file is a valid image.' });
  }

  try {
    const bucket = admin.storage().bucket();
    const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.jpg`;
    const storagePath = `users/${user.uid}/journal/${filename}`;
    const file = bucket.file(storagePath);

    await file.save(processedBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          uid: user.uid,
          tripId: tripId
        }
      }
    });

    // Make file read-only via a signed URL or get downlod path
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491'
    });

    return res.status(200).json({
      photoURL: url,
      storagePath
    });
  } catch (err) {
    console.error('Storage write error:', err);
    return res.status(500).json({ error: 'Failed to save photo to storage.' });
  }
}

// 7. GDPR User Data Deletion Handler
async function handleDeleteUserData(req, res, user) {
  const uid = user.uid;
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  console.log(`Starting data deletion for user: ${uid}`);

  try {
    // 1. Delete all Firestore records for this user (including subcollections)
    const userDocRef = db.collection('users').doc(uid);
    await db.recursiveDelete(userDocRef);

    // 2. Delete all files in storage under users/{uid}/
    try {
      await bucket.deleteFiles({ prefix: `users/${uid}/` });
    } catch (err) {
      console.warn(`No files to delete in storage or error: ${err.message}`);
    }

    // 3. Delete Firebase Auth User Account
    await admin.auth().deleteUser(uid);

    return res.status(200).json({ message: 'User account and all matching data completely deleted.' });
  } catch (err) {
    console.error('Error during GDPR data wipe:', err);
    return res.status(500).json({ error: 'Data deletion failed. Please contact support.' });
  }
}

// 8. Sign Out / Revoke Tokens Handler
async function handleSignOut(req, res, user) {
  try {
    await admin.auth().revokeRefreshTokens(user.uid);
    return res.status(200).json({ message: 'Refresh tokens successfully revoked.' });
  } catch (err) {
    console.error('Error revoking refresh tokens:', err);
    return res.status(500).json({ error: 'Failed to revoke tokens.' });
  }
}

// 9. Save Profile & Encrypt Settings Handler
const childProfileSchema = z.object({
  name: z.string().max(50),
  age: z.number().min(0).max(18)
});

const saveSettingsSchema = z.object({
  name: z.string().max(100),
  children: z.array(childProfileSchema).max(10),
  preferredAirports: z.array(z.string().length(3)).max(5),
  mfaEnabled: z.boolean(),
  ollamaBaseUrl: z.string().max(250).optional().nullable()
});

async function handleSaveSettings(req, res, user) {
  const parsed = saveSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid settings input format', details: parsed.error });
  }

  const { name, children, preferredAirports, mfaEnabled, ollamaBaseUrl } = parsed.data;
  const { encrypt } = require('./utils/crypto');

  let encryptedUrl = null;
  if (ollamaBaseUrl && ollamaBaseUrl.trim().length > 0 && !ollamaBaseUrl.startsWith('●')) {
    try {
      encryptedUrl = encrypt(ollamaBaseUrl.trim());
    } catch (err) {
      console.error('Encryption error:', err);
      return res.status(500).json({ error: 'Failed to securely encrypt Ollama URL.' });
    }
  }

  const db = admin.firestore();
  
  // Retrieve existing profile to preserve encrypted URL if user didn't change the masked string
  const userRef = db.collection('users').doc(user.uid);
  const userSnap = await userRef.get();
  const existingProfile = userSnap.data()?.profile || {};

  const profile = {
    name,
    children,
    preferredAirports,
    mfaEnabled
  };

  // If user changed the URL, save new encrypted value. If empty, clear it. Otherwise, keep existing.
  if (ollamaBaseUrl === '' || ollamaBaseUrl === null) {
    profile.ollamaBaseUrl = '';
  } else if (encryptedUrl) {
    profile.ollamaBaseUrl = encryptedUrl;
  } else {
    profile.ollamaBaseUrl = existingProfile.ollamaBaseUrl || '';
  }

  await userRef.set({ profile }, { merge: true });

  return res.status(200).json({ message: 'Settings saved successfully.' });
}
