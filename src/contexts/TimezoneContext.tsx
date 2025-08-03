import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from "./AuthContext";
import { localDb } from '../services/localDb';

// Types for timezone calculations
export interface TimezoneContextType {
  timezone: string;
  userToday: Date;
  userNow: Date;
  isLoading: boolean;
  error: string | null;
  getUserDate: (utcDate: Date) => Date;
  getUserTodayString: () => string;
  formatDateInUserTimezone: (date: Date) => string;
  getWeekParityFromDate: (date: Date) => number;
  getUserDayOfWeek: (date?: Date) => number;
  getUserDayOfMonth: (date?: Date) => number;
}

// Default context value
const defaultContextValue: TimezoneContextType = {
  timezone: 'UTC',
  userToday: new Date(),
  userNow: new Date(),
  isLoading: true,
  error: null,
  getUserDate: (utcDate: Date) => utcDate,
  getUserTodayString: () => new Date().toISOString().split('T')[0],
  formatDateInUserTimezone: (date: Date) => date.toISOString().split('T')[0],
  getWeekParityFromDate: () => 0,
  getUserDayOfWeek: () => 0,
  getUserDayOfMonth: () => 1,
};

// Create the context
const TimezoneContext = createContext<TimezoneContextType>(defaultContextValue);

// Provider component props
interface TimezoneProviderProps {
  children: ReactNode;
}

/**
 * TimezoneProvider component that manages timezone state and provides
 * timezone-aware date utilities throughout the application.
 */
export function TimezoneProvider({ children }: TimezoneProviderProps) {
  const { user } = useAuth();
  const [timezone, setTimezone] = useState<string>('UTC');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user's timezone from their profile
  useEffect(() => {
    async function loadUserTimezone() {
      if (!user) {
        // User not logged in - use browser's timezone
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(browserTimezone);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Try to get user's timezone from their profile
        const userProfile = await localDb.userProfiles.findByUserId(user.id);
        
        if (userProfile && userProfile.timezone) {
          setTimezone(userProfile.timezone);
        } else {
          // Fallback to browser timezone if no profile timezone
          const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          setTimezone(browserTimezone);
          
          // Create user profile with detected timezone if it doesn't exist
          if (!userProfile) {
            try {
              await localDb.userProfiles.create({
                user_id: user.id,
                email: user.email || null,
                full_name: user.user_metadata?.full_name || null,
                timezone: browserTimezone,
                preferred_translation: 'ESV',
                reference_display_mode: 'full'
              });
            } catch (profileError) {
              console.warn('Failed to create user profile:', profileError);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load user timezone:', err);
        setError('Failed to load timezone preferences');
        // Fallback to browser timezone
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(browserTimezone);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserTimezone();
  }, [user?.id]);

  // Calculate current date/time in user's timezone
  const userNow = new Date();
  const userToday = new Date(userNow.toLocaleString('en-US', { timeZone: timezone }));

  /**
   * Converts a UTC date to user's timezone
   */
  const getUserDate = (utcDate: Date): Date => {
    return new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
  };

  /**
   * Gets today's date string in user's timezone (YYYY-MM-DD format)
   */
  const getUserTodayString = (): string => {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    return formatDateToYYYYMMDD(today);
  };

  /**
   * Formats a date to YYYY-MM-DD string in user's timezone
   */
  const formatDateInUserTimezone = (date: Date): string => {
    const userDate = getUserDate(date);
    return formatDateToYYYYMMDD(userDate);
  };

  /**
   * Gets week parity (0 or 1) for biweekly scheduling
   * Uses epoch-based calculation to match SQL migration logic
   */
  const getWeekParityFromDate = (date: Date): number => {
    const userDate = getUserDate(date);
    const epochDays = Math.floor(userDate.getTime() / 86400000); // Days since epoch
    return Math.floor(epochDays / 7) % 2;
  };

  /**
   * Gets day of week (1-7, where 1=Sunday) for the given date
   * If no date provided, uses today in user's timezone
   */
  const getUserDayOfWeek = (date?: Date): number => {
    const targetDate = date ? getUserDate(date) : userToday;
    return targetDate.getDay() + 1; // Convert from 0-6 to 1-7 (Sunday=1)
  };

  /**
   * Gets day of month (1-31) for the given date
   * If no date provided, uses today in user's timezone
   */
  const getUserDayOfMonth = (date?: Date): number => {
    const targetDate = date ? getUserDate(date) : userToday;
    return targetDate.getDate();
  };

  const contextValue: TimezoneContextType = {
    timezone,
    userToday,
    userNow,
    isLoading,
    error,
    getUserDate,
    getUserTodayString,
    formatDateInUserTimezone,
    getWeekParityFromDate,
    getUserDayOfWeek,
    getUserDayOfMonth,
  };

  return (
    <TimezoneContext.Provider value={contextValue}>
      {children}
    </TimezoneContext.Provider>
  );
}

/**
 * Hook to access timezone context
 */
export function useTimezone(): TimezoneContextType {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}

// Helper function to format date as YYYY-MM-DD
function formatDateToYYYYMMDD(date: Date): string {
  return date.getFullYear() + '-' + 
    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
    String(date.getDate()).padStart(2, '0');
}

export default TimezoneContext;