/**
 * VerseCard Component Tests (TDD)
 * 
 * Tests the core Bible memorization card component with:
 * - Reference display modes (full, first, blank)
 * - Text/reference toggling
 * - Mobile swipe gestures
 * - Accessibility
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VerseCard } from './VerseCard';
import type { VerseCardData } from '../../types/verse';

// Mock framer-motion for testing
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onDragEnd, ...props }: any) => (
      <div 
        {...props}
        onMouseDown={(e: any) => {
          // Store start position
          (e.target as any).startX = e.clientX;
        }}
        onMouseUp={(e: any) => {
          // Simulate drag end with offset calculation
          const startX = (e.target as any).startX || 0;
          const offset = { x: e.clientX - startX, y: 0 };
          if (onDragEnd) {
            onDragEnd(e, { offset });
          }
        }}
      >
        {children}
      </div>
    ),
  },
}));

const mockVerseCard: VerseCardData = {
  id: 'test-card-1',
  verse: {
    id: 'test-verse-1',
    reference: 'John 3:16',
    text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    translation: 'ESV',
  },
  currentPhase: 'daily',
  nextDueDate: '2025-07-24',
  currentStreak: 5,
};

const mockCallbacks = {
  onCorrect: jest.fn(),
  onIncorrect: jest.fn(),
  onToggleView: jest.fn(),
};

describe('VerseCard Component (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Reference Display Modes', () => {
    test('should show full reference in full mode', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText('John 3:16')).toBeInTheDocument();
    });

    test('should show only book and chapter in first mode', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="first"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText('John 3')).toBeInTheDocument();
      expect(screen.queryByText('John 3:16')).not.toBeInTheDocument();
    });

    test('should show no reference hint in blank mode', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="blank"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      expect(screen.queryByText('John 3:16')).not.toBeInTheDocument();
      expect(screen.queryByText('John 3')).not.toBeInTheDocument();
      expect(screen.getByText('???')).toBeInTheDocument();
    });
  });

  describe('Text/Reference Toggle', () => {
    test('should show reference when showingText is false', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText('John 3:16')).toBeInTheDocument();
      expect(screen.queryByText(/For God so loved the world/)).not.toBeInTheDocument();
    });

    test('should show text when showingText is true', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={true}
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText(/For God so loved the world/)).toBeInTheDocument();
      expect(screen.queryByText('John 3:16')).not.toBeInTheDocument();
    });

    test('should call onToggleView when card is tapped', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      const card = screen.getByRole('button', { name: /tap to toggle/i });
      fireEvent.click(card);
      
      expect(mockCallbacks.onToggleView).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mobile Gestures', () => {
    test('should call onCorrect when swiped right', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      const card = screen.getByRole('button').parentElement!; // Get the motion.div wrapper
      
      // Simulate swipe right gesture
      fireEvent.mouseDown(card, { clientX: 100 });
      fireEvent.mouseUp(card, { clientX: 250 }); // 150px right
      
      expect(mockCallbacks.onCorrect).toHaveBeenCalledWith(mockVerseCard.id);
    });

    test('should call onIncorrect when swiped left', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      const card = screen.getByRole('button').parentElement!; // Get the motion.div wrapper
      
      // Simulate swipe left gesture
      fireEvent.mouseDown(card, { clientX: 250 });
      fireEvent.mouseUp(card, { clientX: 100 }); // 150px left
      
      expect(mockCallbacks.onIncorrect).toHaveBeenCalledWith(mockVerseCard.id);
    });

    test('should not trigger callbacks for small movements', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      const card = screen.getByRole('button').parentElement!; // Get the motion.div wrapper
      
      // Simulate small movement (tap, not swipe)
      fireEvent.mouseDown(card, { clientX: 100 });
      fireEvent.mouseUp(card, { clientX: 120 }); // 20px movement
      
      expect(mockCallbacks.onCorrect).not.toHaveBeenCalled();
      expect(mockCallbacks.onIncorrect).not.toHaveBeenCalled();
    });
  });

  describe('Visual Feedback', () => {
    test('should show streak counter', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText('🔥 5')).toBeInTheDocument();
    });

    test('should show current phase', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText('Daily')).toBeInTheDocument();
    });

    test('should show translation', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={true}
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText('ESV')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('aria-label', expect.stringContaining('John 3:16'));
    });

    test('should be keyboard accessible', () => {
      render(
        <VerseCard 
          verseCard={mockVerseCard}
          referenceDisplayMode="full"
          showingText={false}
          {...mockCallbacks}
        />
      );
      
      const card = screen.getByRole('button');
      
      // Test Enter key
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(mockCallbacks.onToggleView).toHaveBeenCalled();
      
      jest.clearAllMocks();
      
      // Test Space key
      fireEvent.keyDown(card, { key: ' ' });
      expect(mockCallbacks.onToggleView).toHaveBeenCalled();
    });
  });
});