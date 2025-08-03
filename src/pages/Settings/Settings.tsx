/**
 * Settings page component for app configuration.
 * Users can manage preferences, account settings, and app behavior.
 */
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function Settings() {
  const { user, signOut } = useAuth();
  const [referenceDisplayMode, setReferenceDisplayMode] = useState('first');

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const referenceDisplayModeHandler = (preference) => {
    // todo: sync userProfile cloud and local for reference_display_mode
  }

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

          {/* User Profile */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div>
                <p className="text-primary font-medium font-roboto">
                  {user?.email || 'Guest User'}
                </p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full bg-gray-100 text-primary py-3 px-4 rounded-lg font-medium font-roboto hover:bg-gray-200 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Display Preferences */}
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
                onChange={(e) => setReferenceDisplayMode(e.target.value)}
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
