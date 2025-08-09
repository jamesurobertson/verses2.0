/**
 * Settings page component for app configuration.
 * Users can manage preferences, account settings, and app behavior.
 * Supports local-only, anonymous, and authenticated modes.
 */
import { useState, useEffect } from 'react';
import { useAuth } from "../../contexts/AuthContext";
import { dataService } from "../../services/dataService";
import { db } from "../../services/localDb";
import { supabaseClient } from "../../services/supabase";

export function Settings() {
  const { user, signIn, signOut, convertAnonymousToUser, isAnonymous, getCurrentUserId, getAccessToken } = useAuth();
  const [referenceDisplayMode, setReferenceDisplayMode] = useState('first');
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Email verification tracking
  const [pendingEmailVerification, setPendingEmailVerification] = useState<string | null>(null);
  const [_verificationSentAt, setVerificationSentAt] = useState<string | null>(null);
  const [showEmailResentIcon, setShowEmailResentIcon] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const hasUnverifiedEmail = (user && !isAnonymous && !user.email_confirmed_at) || 
                            (isAnonymous && pendingEmailVerification);
  
  // Debug logging
  console.log('Settings Debug:', { 
    user: user ? { 
      id: user.id, 
      email: user.email, 
      is_anonymous: user.is_anonymous
    } : null,
    isAnonymous
  });
  
  // Profile management state
  const [profileData, setProfileData] = useState({
    email: '',
    fullName: '',
    timezone: 'UTC',
    preferredTranslation: 'ESV',
    referenceDisplayMode: 'full'
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Network status detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load current profile
  useEffect(() => {
    loadProfile();
    
    const clearPendingVerification = async () => {
      // Clear pending verification if user becomes verified
      if (user && !isAnonymous && user.email_confirmed_at && pendingEmailVerification) {
        const userId = getCurrentUserId();
        if (userId) {
          const accessToken = await getAccessToken();
          dataService.updateUserProfile(userId, {
            pending_email_verification: null,
            email_verification_sent_at: null
          }, accessToken || undefined);
          setPendingEmailVerification(null);
          setVerificationSentAt(null);
        }
      }
    };
    
    clearPendingVerification();
  }, [user, isAnonymous, pendingEmailVerification, getCurrentUserId, getAccessToken]);

  const loadProfile = async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return;
      const profile = await db.user_profiles.where('user_id').equals(userId).first();
      
      if (profile) {
        setProfileData({
          email: profile.email || '',
          fullName: profile.full_name || '',
          timezone: profile.timezone || 'UTC',
          preferredTranslation: profile.preferred_translation || 'ESV',
          referenceDisplayMode: profile.reference_display_mode || 'full'
        });
        setReferenceDisplayMode(profile.reference_display_mode || 'full');
        
        // Load pending email verification state
        setPendingEmailVerification(profile.pending_email_verification);
        setVerificationSentAt(profile.email_verification_sent_at);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const updateProfileField = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    setProfileSuccess(false);
  };

  const saveProfile = async () => {
    if (!hasUnsavedChanges) return;

    setProfileLoading(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) return;
      const accessToken = await getAccessToken();
      await dataService.updateUserProfile(userId, {
        email: profileData.email || null,
        full_name: profileData.fullName || null,
        timezone: profileData.timezone,
        preferred_translation: profileData.preferredTranslation,
        reference_display_mode: profileData.referenceDisplayMode
      }, accessToken || undefined);
      
      setHasUnsavedChanges(false);
      setProfileSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      // Could add error state here
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      setError('Account creation requires an internet connection. Please check your connection and try again.');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    if (!email || !password) {
      setError('Email and password are required');
      setTimeout(() => setError(''), 5000);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Convert anonymous user to permanent account
      const result = await convertAnonymousToUser(email, password, fullName);
      
      console.log('Convert anonymous result:', result);
      
      if (result.error) {
        throw result.error;
      }
      
      // Store pending verification in local database
      const userId = getCurrentUserId();
      if (userId) {
        const accessToken = await getAccessToken();
        await dataService.updateUserProfile(userId, {
          pending_email_verification: email,
          email_verification_sent_at: new Date().toISOString()
        }, accessToken || undefined);
        setPendingEmailVerification(email);
        setVerificationSentAt(new Date().toISOString());
      }
      
      setShowAccountCreation(false);
      setEmail('');
      setPassword('');
      setFullName('');
      
    } catch (err) {
      console.error('Account creation failed:', err);
      setError(`Failed to create account: ${(err as any)?.message || 'Please try again.'}`);
      // Clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      setError('Email and password are required');
      setTimeout(() => setError(''), 5000);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await signIn(loginEmail, loginPassword);
      if (result.error) {
        throw result.error;
      }
      
      setShowLogin(false);
      setLoginEmail('');
      setLoginPassword('');

      // Clear status after 3 seconds
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please try again.');
      console.error('Sign in failed:', err);
      // Clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingEmailVerification) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const { error } = await supabaseClient.auth.resend({
        type: 'signup',
        email: pendingEmailVerification
      });
      
      if (error) throw error;
      
      // Update sent timestamp
      const userId = getCurrentUserId();
      if (userId) {
        const accessToken = await getAccessToken();
        await dataService.updateUserProfile(userId, {
          email_verification_sent_at: new Date().toISOString()
        }, accessToken || undefined);
        setVerificationSentAt(new Date().toISOString());
      }
      
      // Show checkmark icon briefly instead of status message
      setShowEmailResentIcon(true);
      setTimeout(() => setShowEmailResentIcon(false), 3000);
    } catch (err: any) {
      setError(`Failed to resend email: ${err.message || 'Please try again.'}`);
      // Clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail) {
      setError('Email is required');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Update user email in Supabase
      const { error } = await supabaseClient.auth.updateUser({ 
        email: newEmail 
      });
      
      if (error) throw error;
      
      // Update local state
      const userId = getCurrentUserId();
      if (userId) {
        const accessToken = await getAccessToken();
        await dataService.updateUserProfile(userId, {
          pending_email_verification: newEmail,
          email_verification_sent_at: new Date().toISOString()
        }, accessToken || undefined);
        setPendingEmailVerification(newEmail);
        setVerificationSentAt(new Date().toISOString());
      }
      
      setIsEditingEmail(false);
      setNewEmail('');
      setShowEmailResentIcon(true);
      setTimeout(() => setShowEmailResentIcon(false), 3000);
    } catch (err: any) {
      setError(`Failed to change email: ${err.message || 'Please try again.'}`);
      // Clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="max-w-6xl mx-auto px-4 pt-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-primary">Settings</h1>
          </div>
        </div>
      </div>


      {/* Content */}
      <div className="px-6 py-6 space-y-6">

        {/* Account Section */}
        <div className="bg-background border border-primary/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-primary mb-4">Account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Anonymous users - show create account and login options (but not if email verification is pending) */}
          {isAnonymous && !hasUnverifiedEmail && (
            <div className="space-y-4">
              <div className={`p-4 border rounded-lg ${
                !isOnline 
                  ? 'bg-orange-50 border-orange-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className={`w-5 h-5 mt-0.5 ${
                      !isOnline ? 'text-orange-500' : 'text-yellow-500'
                    }`} fill="currentColor" viewBox="0 0 20 20">
                      {!isOnline ? (
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      )}
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-sm font-medium ${
                      !isOnline ? 'text-orange-800' : 'text-yellow-800'
                    }`}>
                      {!isOnline ? 'You\'re Offline' : 'Secure Your Data'}
                    </h3>
                    <p className={`text-sm mt-1 ${
                      !isOnline ? 'text-orange-700' : 'text-yellow-700'
                    }`}>
                      {!isOnline 
                        ? 'Your data is saved on your device only. Account creation requires an internet connection to sync your data to the cloud.'
                        : 'Your data is saved on your device only. Create an account or log in to sync your data to the cloud and access it from other devices.'
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAccountCreation(true);
                    setShowLogin(false);
                    setError('');
                  }}
                  disabled={!isOnline}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    isOnline 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isOnline ? 'Create Account' : 'Create Account (Offline)'}
                </button>
                <button
                  onClick={() => {
                    setShowLogin(true);
                    setShowAccountCreation(false);
                    setError('');
                  }}
                  disabled={!isOnline}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    isOnline 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isOnline ? 'Log In' : 'Log In (Offline)'}
                </button>
              </div>
            </div>
          )}

          {/* User with unverified email - show verification pending */}
          {hasUnverifiedEmail && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    {!isEditingEmail ? (
                      <>
                        <p className="text-sm text-yellow-800 mt-1">
                          We've sent a verification email to <strong>{pendingEmailVerification}</strong>. Please check your inbox and click the verification link to complete your account setup.
                        </p>
                        <p className="text-sm text-yellow-700 mt-1 italic">
                          No rush, you can continue using the app before verifying!
                        </p>
                        <div className="mt-2 flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={handleResendVerification}
                              disabled={isLoading}
                              className="text-yellow-800 hover:text-yellow-900 text-sm underline disabled:opacity-50"
                            >
                              {isLoading ? 'Sending...' : 'Resend verification email'}
                            </button>
                            {showEmailResentIcon && (
                              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setIsEditingEmail(true);
                              setNewEmail(pendingEmailVerification || '');
                            }}
                            className="text-yellow-800 hover:text-yellow-900 text-sm underline"
                          >
                            Change email
                          </button>
                        </div>
                      </>
                    ) : (
                      <form onSubmit={handleChangeEmail} className="mt-2 space-y-3">
                        <div>
                          <label className="block text-sm text-yellow-700 mb-1">New email address:</label>
                          <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full border border-yellow-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="your@email.com"
                            required
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
                          >
                            {isLoading ? 'Updating...' : 'Update & Send Verification'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingEmail(false);
                              setNewEmail('');
                              setError('');
                            }}
                            className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-primary font-medium font-roboto">Account Created</p>
                  <p className="text-sm text-gray-500">Waiting for email verification</p>
                </div>
              </div>
            </div>
          )}

          {/* Fully Authenticated Mode - only show for verified users */}
          {!isAnonymous && !hasUnverifiedEmail && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-primary font-medium">
                    {user?.email || 'Authenticated User'}
                  </p>
                  <p className="text-sm text-gray-500">Account secure and syncing</p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full bg-primary/10 hover:bg-primary/20 text-primary py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Login Form */}
          {showLogin && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-primary mb-4">Log In</h3>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your password"
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={isLoading || !isOnline}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Logging in...' : !isOnline ? 'Offline' : 'Log In'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogin(false);
                      setLoginEmail('');
                      setLoginPassword('');
                      setError('');
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Account Creation Form */}
          {showAccountCreation && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-primary mb-4">Create Account</h3>
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name (optional)
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Choose a strong password"
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={isLoading || !isOnline}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Creating...' : !isOnline ? 'Offline' : 'Create Account'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountCreation(false);
                      setEmail('');
                      setPassword('');
                      setFullName('');
                      setError('');
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Profile Management - Only show for authenticated users */}
        {!isAnonymous && (
          <div className="bg-background border border-primary/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">Profile</h2>
              {hasUnsavedChanges && (
                <button
                  onClick={saveProfile}
                  disabled={profileLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {profileLoading ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>

            {profileSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-600 text-sm">✅ Profile updated successfully!</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => updateProfileField('email', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileData.fullName}
                  onChange={(e) => updateProfileField('fullName', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  value={profileData.timezone}
                  onChange={(e) => updateProfileField('timezone', e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (New York)</option>
                  <option value="America/Chicago">Central Time (Chicago)</option>
                  <option value="America/Denver">Mountain Time (Denver)</option>
                  <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Australia/Sydney">Sydney</option>
                </select>
              </div>

              {/* Translation Preference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Translation
                </label>
                <select
                  value={profileData.preferredTranslation}
                  onChange={(e) => updateProfileField('preferredTranslation', e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ESV">ESV (English Standard Version)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">More translations coming soon</p>
              </div>

              {/* Reference Display Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Display Mode
                </label>
                <select
                  value={profileData.referenceDisplayMode}
                  onChange={(e) => {
                    updateProfileField('referenceDisplayMode', e.target.value);
                    setReferenceDisplayMode(e.target.value);
                  }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="full">Full Text</option>
                  <option value="first">First Letter ( J__ tap to reveal )</option>
                  <option value="blank">Blank ( ___ tap to reveal )</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Display Preferences - For anonymous users or fallback */}
        <div className="bg-background border border-primary/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-primary mb-4">Display</h2>

          <div className="space-y-4">
            {/* Reference Display Mode */}
            <div>
              <label className="block text-primary/70 text-sm mb-2">
                Reference Display Mode
              </label>
              <select
                value={referenceDisplayMode}
                onChange={(e) => {
                  setReferenceDisplayMode(e.target.value);
                  if (!isAnonymous) {
                    updateProfileField('referenceDisplayMode', e.target.value);
                  }
                }}
                className="w-full bg-white border border-primary/20 rounded px-3 py-1 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              >
                <option value="full">Full Text</option>
                <option value="first">First Letter ( J__ tap to reveal )</option>
                <option value="blank">Blank ( ___ tap to reveal )</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
