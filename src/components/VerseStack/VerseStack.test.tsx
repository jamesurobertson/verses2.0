/**
 * VerseStack Component Tests (TDD)
 * 
 * Tests the stack of verse cards for review sessions:
 * - Card stack management
 * - Progress tracking
 * - Empty state handling
 * - Animation transitions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VerseStack } from './VerseStack';
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
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const mockVerseCards: VerseCardData[] = [
  {
    id: 'card-1',
    verse: {
      id: 'verse-1',
      reference: 'John 3:16',
      text: 'For God so loved the world...',
      translation: 'ESV',
    },
    currentPhase: 'daily',
    nextDueDate: '2025-07-24',
    currentStreak: 5,
  },
  {
    id: 'card-2',
    verse: {
      id: 'verse-2',
      reference: 'Romans 8:28',
      text: 'And we know that in all things...',
      translation: 'ESV',
    },
    currentPhase: 'weekly',
    nextDueDate: '2025-07-24',
    currentStreak: 2,
  },
  {
    id: 'card-3',
    verse: {
      id: 'verse-3',
      reference: 'Philippians 4:13',
      text: 'I can do all things through Christ...',
      translation: 'ESV',
    },
    currentPhase: 'daily',
    nextDueDate: '2025-07-24',
    currentStreak: 0,
  },
];

const mockCallbacks = {
  onCardCorrect: jest.fn(),
  onCardIncorrect: jest.fn(),
  onSessionComplete: jest.fn(),
};

describe('VerseStack Component (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Card Stack Management', () => {
    test('should render the current card', () => {
      render(
        <VerseStack 
          cards={mockVerseCards}
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText('John 3:16')).toBeInTheDocument();
    });

    test('should show progress indicator', () => {
      render(
        <VerseStack 
          cards={mockVerseCards}
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
    });

    test('should advance to next card after correct answer', async () => {
      render(
        <VerseStack 
          cards={mockVerseCards}
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      // Should start with first card
      expect(screen.getByText('John 3:16')).toBeInTheDocument();
      
      // Simulate correct answer
      const allButtons = screen.getAllByRole('button');
      const currentCardWrapper = allButtons[0].parentElement!; // First button is current card
      fireEvent.mouseDown(currentCardWrapper, { clientX: 100 });
      fireEvent.mouseUp(currentCardWrapper, { clientX: 250 });
      
      await waitFor(() => {
        expect(screen.getByText('Romans 8:28')).toBeInTheDocument();
        expect(screen.getByText('2 of 3')).toBeInTheDocument();
      });
    });

    test('should advance to next card after incorrect answer', async () => {
      render(
        <VerseStack 
          cards={mockVerseCards}
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      // Simulate incorrect answer
      const allButtons = screen.getAllByRole('button');
      const currentCardWrapper = allButtons[0].parentElement!; // First button is current card
      fireEvent.mouseDown(currentCardWrapper, { clientX: 250 });
      fireEvent.mouseUp(currentCardWrapper, { clientX: 100 });
      
      await waitFor(() => {
        expect(screen.getByText('Romans 8:28')).toBeInTheDocument();
        expect(screen.getByText('2 of 3')).toBeInTheDocument();
      });
    });
  });

  describe('Session Completion', () => {
    test('should call onSessionComplete when all cards are reviewed', async () => {
      render(
        <VerseStack 
          cards={[mockVerseCards[0]]} // Only one card
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      // Answer the only card
      const cardWrapper = screen.getByRole('button').parentElement!; // Only one card, so single button
      fireEvent.mouseDown(cardWrapper, { clientX: 100 });
      fireEvent.mouseUp(cardWrapper, { clientX: 250 });
      
      await waitFor(() => {
        expect(mockCallbacks.onSessionComplete).toHaveBeenCalledWith({
          totalCards: 1,
          correctAnswers: 0,
          incorrectAnswers: 0,
        });
      });
    });

  });

  describe('Empty State', () => {
    test('should render empty state when no cards provided', () => {
      render(
        <VerseStack 
          cards={[]}
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText(/no cards to review/i)).toBeInTheDocument();
      expect(screen.getByText(/great job/i)).toBeInTheDocument();
    });

    test('should show motivational message in empty state', () => {
      render(
        <VerseStack 
          cards={[]}
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText(/check back tomorrow/i)).toBeInTheDocument();
    });
  });

  describe('Visual State', () => {
    test('should show next card preview behind current card', () => {
      render(
        <VerseStack 
          cards={mockVerseCards}
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      // Should have multiple card elements (current + preview)
      const cardElements = screen.getAllByRole('button');
      expect(cardElements.length).toBeGreaterThan(1);
    });

    test('should update progress as cards are completed', async () => {
      render(
        <VerseStack 
          cards={mockVerseCards.slice(0, 2)}
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
      
      // Complete first card
      const allButtons = screen.getAllByRole('button');
      const currentCardWrapper = allButtons[0].parentElement!; // First button is current card
      fireEvent.mouseDown(currentCardWrapper, { clientX: 100 });
      fireEvent.mouseUp(currentCardWrapper, { clientX: 250 });
      
      await waitFor(() => {
        expect(screen.getByText('2 of 2')).toBeInTheDocument();
      });
    });
  });

  describe('Callback Handling', () => {
    test('should call onCardCorrect with card ID', async () => {
      render(
        <VerseStack 
          cards={[mockVerseCards[0]]}
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      const cardWrapper = screen.getByRole('button').parentElement!; // Only one card
      fireEvent.mouseDown(cardWrapper, { clientX: 100 });
      fireEvent.mouseUp(cardWrapper, { clientX: 250 });
      
      expect(mockCallbacks.onCardCorrect).toHaveBeenCalledWith('card-1');
    });

    test('should call onCardIncorrect with card ID', async () => {
      render(
        <VerseStack 
          cards={[mockVerseCards[0]]}
          referenceDisplayMode="full"
          {...mockCallbacks}
        />
      );
      
      const cardWrapper = screen.getByRole('button').parentElement!; // Only one card
      fireEvent.mouseDown(cardWrapper, { clientX: 250 });
      fireEvent.mouseUp(cardWrapper, { clientX: 100 });
      
      expect(mockCallbacks.onCardIncorrect).toHaveBeenCalledWith('card-1');
    });
  });
});