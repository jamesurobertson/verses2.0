/**
 * useTextRevelation Hook
 * 
 * Handles progressive text revelation for verse memorization.
 * Supports three modes: full, first-letter, and progressive-words (blank).
 */

import { useState, useCallback, useMemo } from 'react';

export type TextRevelationMode = 'full' | 'first' | 'blank';

interface UseTextRevelationReturn {
  displayText: string;
  revealNext: () => void;
  revealAll: () => void;
  reset: () => void;
  isComplete: boolean;
  progress: number; // 0-1 for progress tracking
  currentWordIndex: number;
  totalWords: number;
}

export function useTextRevelation(
  verseText: string, 
  mode: TextRevelationMode
): UseTextRevelationReturn {
  const [revealedWordIndex, setRevealedWordIndex] = useState(0);
  const [isFullyRevealed, setIsFullyRevealed] = useState(false);

  // Split text into words for progressive revelation
  const words = useMemo(() => verseText.split(/\s+/), [verseText]);

  const getDisplayText = useCallback(() => {
    switch (mode) {
      case 'full':
        return isFullyRevealed ? verseText : '';

      case 'first':
        if (isFullyRevealed) return verseText;
        
        // Show first letter of each word with spacing - PRESERVE EXACT PATTERN from backup
        return verseText.split(/\s+/)
          .map(word => {
            // Match leading punctuation, core word, trailing punctuation
            const match = word.match(/^([^A-Za-z\u2019'\-–—]*)([A-Za-z\u2019'\-–—]+)([^A-Za-z\u2019'\-–—]*)$/);
            if (!match) return word; // leave pure punctuation untouched
            const [, leading, core, trailing] = match;

            // Split core on hyphen/dash variations
            const parts = core.split(/([-–—])/);

            // For each segment, take first letter plus spacing
            const reducedCore = parts
              .map(part => {
                if (/^[-–—]$/.test(part)) return part; // keep dashes
                const firstLetterMatch = part.match(/[A-Za-z]/);
                return firstLetterMatch ? firstLetterMatch[0] + '\u00A0\u00A0' : part;
              })
              .join('');

            return leading + reducedCore + trailing;
          })
          .join(' ');

      case 'blank':
        return words.map((word, index) => 
          index < revealedWordIndex 
            ? word 
            : '█'.repeat(Math.max(2, word.replace(/[^A-Za-z]/g, '').length))
        ).join(' ');

      default:
        return verseText;
    }
  }, [mode, verseText, revealedWordIndex, isFullyRevealed, words]);

  const revealNext = useCallback(() => {
    if (mode === 'full' || mode === 'first') {
      setIsFullyRevealed(true);
    } else if (mode === 'blank' && revealedWordIndex < words.length) {
      setRevealedWordIndex(prev => prev + 1);
    }
  }, [mode, revealedWordIndex, words.length]);

  const revealAll = useCallback(() => {
    if (mode === 'blank') {
      setRevealedWordIndex(words.length);
    } else {
      setIsFullyRevealed(true);
    }
  }, [mode, words.length]);

  const reset = useCallback(() => {
    setRevealedWordIndex(0);
    setIsFullyRevealed(false);
  }, []);

  // Calculate completion status
  const isComplete = useMemo(() => {
    if (mode === 'blank') {
      return revealedWordIndex >= words.length;
    } else {
      return isFullyRevealed;
    }
  }, [mode, revealedWordIndex, words.length, isFullyRevealed]);

  // Calculate progress (0-1)
  const progress = useMemo(() => {
    if (mode === 'blank') {
      return words.length > 0 ? revealedWordIndex / words.length : 0;
    } else {
      return isFullyRevealed ? 1 : 0;
    }
  }, [mode, revealedWordIndex, words.length, isFullyRevealed]);

  return {
    displayText: getDisplayText(),
    revealNext,
    revealAll,
    reset,
    isComplete,
    progress,
    currentWordIndex: revealedWordIndex,
    totalWords: words.length
  };
}