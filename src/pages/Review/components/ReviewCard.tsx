/**
 * ReviewCard Component
 * 
 * Interactive card for reviewing and practicing Bible verses.
 * Shows reference, allows toggling text visibility, and captures review results.
 */

import { useState } from 'react';
import type { LibraryVerseCard } from '../../Library/hooks/useLibrary';
import { Button } from '../../../components/Button';

interface ReviewCardProps {
  verseCard: LibraryVerseCard;
  onCorrect: () => void;
  onIncorrect: () => void;
  showProgress?: boolean;
  progress?: {
    current: number;
    total: number;
  };
  referenceDisplayMode: string;
}

export function ReviewCard({ verseCard, onCorrect, onIncorrect, referenceDisplayMode }: ReviewCardProps) {
  const [showingText, setShowingText] = useState(false);

  const { verse } = verseCard;

  const handleToggleText = () => {
    setShowingText(!showingText);
  };

  const handleCorrect = () => {
    onCorrect();
  };

  const handleIncorrect = () => {
    onIncorrect();
  };

  let textDisplay;

  switch (referenceDisplayMode) {
    case 'first':
      textDisplay = verse.text;
      break;
    case 'full':
      textDisplay = verse.text.split(/\s+/)
      .map(word => {
        // Match leading punctuation, core word (letters, apostrophes, hyphens, dashes), trailing punctuation
        // Apostrophes included inside core: ASCII ' and Unicode ’ (U+2019)
        const m = word.match(/^([^A-Za-z\u2019'\-–—]*)([A-Za-z\u2019'\-–—]+)([^A-Za-z\u2019'\-–—]*)$/);
        if (!m) return word; // leave pure punctuation untouched
        const [, leading, core, trailing] = m;
  
        // Split core on hyphen (-), en-dash (–, U+2013), em-dash (—, U+2014)
        const parts = core.split(/([-–—])/);
  
        // For each segment that is letters+apostrophes, take first letter plus any apostrophes inside
        // But only keep the first letter of each segment; apostrophes are part of letters here, so skip them.
        const reducedCore = parts
          .map(part => {
            if (/^[-–—]$/.test(part)) return part; // keep dashes as-is
  
            // If part has apostrophes, just take first letter (skip apostrophes)
            // For example, "Lord’s" → "L"
            const firstLetterMatch = part.match(/[A-Za-z]/);
            return firstLetterMatch ? firstLetterMatch[0] + '\u00A0\u00A0' : part;
          })
          .join('');
  
        return leading + reducedCore + trailing;
      })
      .join(' ');
      break;
    case 'blank':
      textDisplay = verse.text.split(' ').map((word) => {
        return word.replace(/[^a-zA-Z]/g, '_');
      }).join(' ');
      break;
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* Main card */}
      <div className="bg-background max-h-[500px] p-1 overflow-y-auto rounded-xl shadow-lg border border-primary/10 min-h-[300px] flex flex-col">
        {/* Header */}

        {/* Verse content area */}
        <div className="flex-1 flex flex-col justify-center mb-8">
          {!showingText ? (
            <>
              <div className="text-center mb-8">
                <h2 className=" text-3xl font-semibold text-primary mb-4">
                  {verse.reference}
                </h2>
              </div>
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={handleToggleText}
                  size="medium"
                  className="w-full"
                >
                  Show Verse
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center px-4">
              <p className={`text-primary ${referenceDisplayMode === 'full' ? 'text-lg' : 'text-xl'} leading-relaxed mb-3 pr-8`} style={{ fontFamily: 'Crimson Text, serif' }}>
                "{textDisplay}"
              </p>
              <cite className="text-primary/70 text-base font-medium" style={{ fontFamily: 'Crimson Text, serif' }}>
                — {verse.reference}
              </cite>
            </div>
          )}
        </div>
      </div>

        {(
          <div className="flex sm:flex-row mt-4 gap-4 justify-center">
            <Button
              onClick={handleIncorrect}
              size="medium"
              className="w-full"
            >
              <span style={{ fontSize: '2rem' }}>❌</span>
            </Button>
            <Button
              onClick={handleCorrect}
              size="medium"
              className="w-full"
            >
              <span style={{ fontSize: '2rem' }}>✅</span>
            </Button>
          </div>
        )}
    </div>
  );
}