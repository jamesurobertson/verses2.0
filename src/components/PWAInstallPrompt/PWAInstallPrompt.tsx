/**
 * PWA Install Prompt Component
 * Shows a custom install prompt when PWA can be installed
 */

import { useState, useEffect } from 'react';
import { IOSInstallPrompt } from './iOSInstallPrompt';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    
    if (isStandalone || isInWebAppiOS) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA install accepted');
      } else {
        console.log('PWA install dismissed');
      }
    } catch (error) {
      console.error('Error during PWA installation:', error);
    }

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Store dismissal in localStorage to avoid showing again for a while
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed 
  if (isInstalled) {
    return null;
  }

  // Don't show if no install prompt available
  if (!showInstallPrompt || !deferredPrompt) {
    return null;
  }

  // Check if dismissed recently (within 7 days)
  const dismissedTime = localStorage.getItem('pwa-install-dismissed');
  if (dismissedTime) {
    const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
    if (daysSinceDismissed < 7) {
      return null;
    }
  }

  return (
    <>
      <IOSInstallPrompt />
      <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v1h6V4a1 1 0 011-1h3a1 1 0 011 1v12a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1H8v1a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2v10h2V6H5zm8 0v10h2V6h-2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Install Bible Memory</p>
              <p className="text-xs text-blue-100">Add to home screen for quick access</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleInstallClick}
              className="bg-white text-blue-600 px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="text-blue-100 hover:text-white text-sm"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </>
  );
}