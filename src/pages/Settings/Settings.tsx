/**
 * Settings page component for app configuration.
 * Users can manage preferences, account settings, and app behavior.
 * Supports local-only, anonymous, and authenticated modes.
 */
import { useState, useEffect } from 'react';
import { useAuth } from "../../contexts/AuthContext";
import { dataService } from "../../services/dataService";
import { db } from "../../services/localDb";

export function Settings() {
  const { user, signOut, convertAnonymousToUser, isAnonymous, getCurrentUserId } = useAuth();
  const [referenceDisplayMode, setReferenceDisplayMode] = useState('first');
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  
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

  // Load current profile
  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      const userId = await getCurrentUserId();
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
      const userId = await getCurrentUserId();
      await dataService.updateUserProfile(userId, {
        email: profileData.email || null,
        full_name: profileData.fullName || null,
        timezone: profileData.timezone,
        preferred_translation: profileData.preferredTranslation,
        reference_display_mode: profileData.referenceDisplayMode
      });
      
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
    
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setIsLoading(true);
    setError('');
    setMigrationStatus('Creating account...');

    try {
      // Convert anonymous user to permanent account
      setMigrationStatus('Creating permanent account...');
      await convertAnonymousToUser(email, password, fullName);
      
      setMigrationStatus('✅ Account created successfully!');
      setShowAccountCreation(false);
      setEmail('');
      setPassword('');
      setFullName('');
      
      // Clear status after 3 seconds
      setTimeout(() => setMigrationStatus(null), 3000);
    } catch (err) {
      setError('Failed to create account. Please try again.');
      setMigrationStatus(null);
      console.error('Account creation failed:', err);
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
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-medium text-primary mb-4 font-roboto">Account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {migrationStatus && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-600 text-sm">{migrationStatus}</p>
            </div>
          )}

          {/* Show create account option for anonymous users */}
          {isAnonymous && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-800">Secure Your Data</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Your verses sync across devices, but creating an account ensures you can recover them if you lose access.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowAccountCreation(true)}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium font-roboto hover:bg-green-700 transition-colors"
              >
                Create Account
              </button>
            </div>
          )}

          {/* Authenticated Mode */}
          {!isAnonymous && (
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
                  <p className="text-primary font-medium font-roboto">
                    {user?.email || 'Authenticated User'}
                  </p>
                  <p className="text-sm text-gray-500">Account secure and syncing</p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full bg-gray-100 text-primary py-3 px-4 rounded-lg font-medium font-roboto hover:bg-gray-200 transition-colors"
              >
                Sign Out
              </button>
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
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Creating...' : 'Create Account'}
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
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-primary font-roboto">Profile</h2>
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
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-medium text-primary mb-4 font-roboto">Display</h2>

          <div className="space-y-4">
            {/* Reference Display Mode */}
            <div>
              <label className="block text-primary font-medium mb-2 font-roboto">
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
                className="w-full bg-background border border-gray-200 rounded-lg px-4 py-3 text-primary font-roboto focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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
