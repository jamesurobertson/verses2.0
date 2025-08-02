/**
 * Settings page component for app configuration.
 * Users can manage preferences, account settings, and app behavior.
 */
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function Settings() {
  const { user, signOut } = useAuth();
  const [referenceDisplayMode, setReferenceDisplayMode] = useState('Full');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('09:00');

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="bg-background">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <h1 className="text-2xl font-medium text-primary font-roboto">Settings</h1>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Account Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-medium text-primary mb-4 font-roboto">Account</h2>
          
          {/* User Profile */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-lg">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="text-primary font-medium font-roboto">
                  {user?.email || 'Guest User'}
                </p>
                <p className="text-gray-500 text-sm font-roboto">Free Plan</p>
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
                <option value="Full">Full (e.g., "John 3:16")</option>
                <option value="Abbreviated">Abbreviated (e.g., "Jn 3:16")</option>
                <option value="Book Only">Book Only (e.g., "John")</option>
              </select>
            </div>
          </div>
        </div>

        {/* Study Preferences */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-medium text-primary mb-4 font-roboto">Study</h2>
          
          <div className="space-y-4">
            {/* Daily Reminder */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary font-medium font-roboto">Daily Reminder</p>
                <p className="text-gray-500 text-sm font-roboto">Get reminded to practice</p>
              </div>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationsEnabled ? 'bg-accent' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Reminder Time */}
            {notificationsEnabled && (
              <div>
                <label className="block text-primary font-medium mb-2 font-roboto">
                  Reminder Time
                </label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full bg-background border border-gray-200 rounded-lg px-4 py-3 text-primary font-roboto focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
          </div>
        </div>

        {/* Data & Privacy */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-medium text-primary mb-4 font-roboto">Data & Privacy</h2>
          
          <div className="space-y-3">
            <button className="w-full text-left py-3 px-4 rounded-lg text-primary font-roboto hover:bg-gray-50 transition-colors">
              Export My Data
            </button>
            <button className="w-full text-left py-3 px-4 rounded-lg text-primary font-roboto hover:bg-gray-50 transition-colors">
              Privacy Policy
            </button>
            <button className="w-full text-left py-3 px-4 rounded-lg text-primary font-roboto hover:bg-gray-50 transition-colors">
              Terms of Service
            </button>
          </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-medium text-primary mb-4 font-roboto">About</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-primary font-roboto">Version</span>
              <span className="text-gray-500 font-roboto">2.0.0</span>
            </div>
            <button className="w-full text-left py-3 px-4 rounded-lg text-primary font-roboto hover:bg-gray-50 transition-colors">
              Contact Support
            </button>
            <button className="w-full text-left py-3 px-4 rounded-lg text-primary font-roboto hover:bg-gray-50 transition-colors">
              Rate App
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-red-200">
          <h2 className="text-lg font-medium text-error mb-4 font-roboto">Danger Zone</h2>
          
          <div className="space-y-3">
            <button className="w-full text-left py-3 px-4 rounded-lg text-error font-roboto hover:bg-red-50 transition-colors">
              Reset All Progress
            </button>
            <button className="w-full text-left py-3 px-4 rounded-lg text-error font-roboto hover:bg-red-50 transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}