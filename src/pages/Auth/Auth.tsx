/**
 * Authentication page component.
 * Handles user sign-in and sign-up with Supabase authentication.
 */
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function Auth() {
  const { signIn, signUp, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    console.log('🔐 Auth attempt:', { isSignUp, email });

    try {
      const result = isSignUp 
        ? await signUp(email, password, name || undefined)
        : await signIn(email, password);

      console.log('🔐 Auth result:', { success: !result.error, error: result.error });

      if (!result.error) {
        console.log('✅ Auth successful - router should redirect');
      } else {
        const errorMsg = result.error?.toString() || 'Authentication failed';
        console.error('❌ Auth failed:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('❌ Auth error caught:', err);
      setError('An unexpected error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bible Memory</h1>
          <p className="text-gray-600">
            {isSignUp ? 'Create account to start memorizing verses' : 'Sign in to start memorizing verses'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <input
                type="text"
                placeholder="Full Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
          
          <div>
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-blue-600 hover:text-blue-700 text-sm"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}