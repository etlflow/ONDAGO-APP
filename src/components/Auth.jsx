import React, { useState } from 'react';
import useAuth from '../hooks/useAuth';
import {
  signInWithPopup,
  signInWithRedirect,
  signInAnonymously,
  GoogleAuthProvider,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { Lock, Mail, User, ShieldCheck } from 'lucide-react';

export function Auth() {
  const { signIn } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('192.168.')
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isSignUp && !acceptTerms) {
      setError('You must accept the privacy policy and terms to register.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Sign Up Flow
        await createUserWithEmailAndPassword(auth, email, password);
        // User profile and other variables will be handled in DB initialization on observer changes
      } else {
        // Sign In Flow
        await signIn(email, password, rememberMe);
      }
    } catch (err) {
      console.error('Auth error:', err);
      let errMsg = 'Authentication failed. Please check your credentials.';
      if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email is already in use.';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errMsg = 'Invalid email or password.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password must be at least 6 characters.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Sign In error:', err);
      if (isLocal) {
        try {
          await signInAnonymously(auth);
          return;
        } catch (anonymousErr) {
          console.error('Local emulator anonymous Sign In error:', anonymousErr);
          setError(`Local emulator sign-in failed: ${anonymousErr.code || anonymousErr.message}`);
          return;
        }
      }

      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          console.error('Google redirect Sign In error:', redirectErr);
          setError('Google Sign-In could not open. Check that the Auth emulator is running on port 9099.');
        }
      } else {
        setError('Google Sign-In failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden">
      {/* Visual Accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        {/* Header Logo */}
        <div className="text-center mb-8">
          <img src="/assets/Image/ODG_logo.png" alt="ONDAGO" className="h-16 w-16 mx-auto object-contain mb-3" />
          <h1 className="text-3xl font-extrabold text-white tracking-wide font-display">ONDAGO</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">Safe & Reassuring Travel Companion for Parents</p>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-slate-100 mb-6 text-center">
            {isSignUp ? 'Create a Secure Account' : 'Welcome Back'}
          </h2>

          {isLocal && (
            <div className="mb-6 bg-teal-950/40 border border-teal-800/40 rounded-2xl p-4 text-xs text-teal-300 text-left leading-relaxed">
              <p className="font-bold mb-1">🔧 Local Dev Mode Active</p>
              <p className="mb-2">The application is connected to the local Firebase Emulator.</p>
              <p>
                Click <strong className="text-teal-200">Sign In with Google</strong> below to use the Auth emulator. If the emulator popup is blocked locally, ONDAGO signs you into a temporary emulator-only account.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-2xl pl-10 pr-4 py-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-2xl pl-10 pr-4 py-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-2xl pl-10 pr-4 py-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Remember Me persistence check */}
            {!isSignUp && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberMe"
                  className="h-4 w-4 rounded border-slate-750 text-teal-600 focus:ring-teal-500 bg-slate-800 border-slate-700 cursor-pointer"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="rememberMe" className="ml-2.5 text-xs font-medium text-slate-400 cursor-pointer select-none">
                  Remember me on this device (uses persistent Storage)
                </label>
              </div>
            )}

            {/* Accept privacy policy and terms check (Not pre-checked!) */}
            {isSignUp && (
              <div className="flex items-start space-x-2.5 pt-2">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  required
                  className="h-4 w-4 mt-0.5 rounded border-slate-700 text-teal-600 focus:ring-teal-500 bg-slate-800 cursor-pointer"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <label htmlFor="acceptTerms" className="text-xs text-slate-400 cursor-pointer select-none">
                  I accept the <a href="#privacy" className="text-teal-400 underline hover:text-teal-300">Privacy Policy</a> and <a href="#terms" className="text-teal-400 underline hover:text-teal-300">Terms of Service</a>. We collect only flight trackers and packing checklists. Data is encrypted and deleted on account removal.
                </label>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-xs font-semibold text-center mt-2 bg-red-950/20 py-2.5 px-3.5 rounded-xl border border-red-900/30">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-700/50 text-white font-semibold rounded-2xl transition-all duration-200 shadow-lg shadow-teal-900/20 text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In securely'
              )}
            </button>
          </form>

          {/* Separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-3 text-slate-500 font-semibold tracking-wider">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700/80 disabled:opacity-50 border border-slate-750 text-slate-200 font-semibold rounded-2xl transition-colors text-sm flex items-center justify-center gap-3"
          >
            <svg className="h-5 w-5 object-contain" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.45 1.74 14.9 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.85 2.99C6.27 7.21 8.91 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.25c0-.82-.07-1.61-.21-2.38H12v4.51h6.46c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-1.99 3.42-4.92 3.42-8.58z"
              />
              <path
                fill="#FBBC05"
                d="M5.35 14.81c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1.5 7.26c-.8 1.6-1.25 3.4-1.25 5.3 0 1.9.45 3.7 1.25 5.3l3.85-3.05z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.97-1.08 7.96-2.92l-3.7-2.87c-1.03.69-2.35 1.1-3.96 1.1-3.09 0-5.73-2.17-6.65-5.45L1.5 15.91C3.4 19.75 7.35 23 12 23z"
              />
            </svg>
            <span>Sign In with Google</span>
          </button>

          {/* Toggle link */}
          <div className="mt-8 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors uppercase tracking-wider"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
          </div>
        </div>

        {/* Security Trust badge */}
        <div className="flex items-center justify-center gap-2 mt-6 text-slate-500">
          <ShieldCheck size={16} />
          <span className="text-[10px] uppercase font-bold tracking-widest">End-to-End SSL & Storage Encrypted</span>
        </div>
      </div>
    </div>
  );
}

export default Auth;
