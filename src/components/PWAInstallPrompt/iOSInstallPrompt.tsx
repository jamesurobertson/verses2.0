/**
 * iOS PWA Install Instructions
 * Shows manual instructions for iOS Safari users
 */

import { useState, useEffect } from 'react';

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if we're on iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);
    
    // Check if already installed
    const isStandalone = (window.navigator as any).standalone === true;
    const isInWebAppMode = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isStandalone || isInWebAppMode) {
      setIsInstalled(true);
      return;
    }

    // Only show for iOS Safari users
    if (isIOS && isSafari && !isInstalled) {
      // Check if dismissed recently (within 7 days)
      const dismissedTime = localStorage.getItem('ios-pwa-install-dismissed');
      if (dismissedTime) {
        const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) {
          return;
        }
      }

      // Show after a short delay to let page load
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isInstalled]);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('ios-pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-16 left-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-lg shadow-lg">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-blue-100" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v1h6V4a1 1 0 011-1h3a1 1 0 011 1v12a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1H8v1a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2v10h2V6H5zm8 0v10h2V6h-2z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold mb-2">Install Bible Memory App</h3>
          <div className="text-xs text-blue-100 space-y-2">
            <div className="flex items-center space-x-2">
              <span>1. Tap the</span>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
              </svg>
              <span>share button below</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>2. Scroll down and tap</span>
              <span className="bg-blue-500 px-1 rounded text-xs">"Add to Home Screen"</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>3. Tap</span>
              <span className="bg-blue-500 px-1 rounded text-xs">"Add"</span>
              <span>to install</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-blue-100 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}