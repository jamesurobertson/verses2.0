/**
 * useVerses Hook
 * 
 * Data management for verses - simple interface without over-testing Supabase.
 */

import { useState, useEffect } from 'react';
import { db } from '../services/supabase';
import { useAuth } from './useAuth';
import type { VerseCardData } from '../types/verse';

interface UseVersesReturn {
  verses: VerseCardData[];
  loading: boolean;
  error: string | null;
  addVerse: (verse: Omit<VerseCardData, 'id'>) => Promise<void>;
  updateVerse: (verse: VerseCardData) => Promise<void>;
  deleteVerse: (verseId: string) => Promise<void>;
  refreshVerses: () => Promise<void>;
}

export function useVerses(): UseVersesReturn {
  const { user } = useAuth();
  const [verses, setVerses] = useState<VerseCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshVerses = async () => {
    if (!user) {
      setVerses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await db.userVerses.getByUserId(user.id);
      
      if (error) {
        setError('Failed to load verses');
        return;
      }

      // Transform database response to match our interface
      const transformedData = (data || []).map((item: any) => ({
        id: item.id,
        verse: {
          id: item.verses.id,
          reference: item.verses.reference,
          text: item.verses.text,
          translation: item.verses.translation,
        },
        currentPhase: item.current_phase,
        nextDueDate: item.next_due_date,
        currentStreak: item.current_streak,
      }));
      
      setVerses(transformedData);
      setError(null);
    } catch (err) {
      setError('An error occurred while loading verses');
    } finally {
      setLoading(false);
    }
  };

  const addVerse = async (verse: Omit<VerseCardData, 'id'>) => {
    if (!user) return;

    try {
      const { data, error } = await db.userVerses.create({
        ...verse,
        user_id: user.id,
      });

      if (error) {
        setError('Failed to add verse');
        return;
      }

      if (data) {
        setVerses(prev => [...prev, data]);
      }
    } catch (err) {
      setError('An error occurred while adding verse');
    }
  };

  const updateVerse = async (verse: VerseCardData) => {
    if (!user) return;

    try {
      const { data, error } = await db.userVerses.update(verse.id, verse);

      if (error) {
        setError('Failed to update verse');
        return;
      }

      if (data) {
        setVerses(prev => prev.map(v => v.id === verse.id ? data : v));
      }
    } catch (err) {
      setError('An error occurred while updating verse');
    }
  };

  const deleteVerse = async (verseId: string) => {
    try {
      const { error } = await db.userVerses.delete(verseId);

      if (error) {
        setError('Failed to delete verse');
        return;
      }

      setVerses(prev => prev.filter(v => v.id !== verseId));
    } catch (err) {
      setError('An error occurred while deleting verse');
    }
  };

  useEffect(() => {
    refreshVerses();
  }, [user]);

  return {
    verses,
    loading,
    error,
    addVerse,
    updateVerse,
    deleteVerse,
    refreshVerses,
  };
}