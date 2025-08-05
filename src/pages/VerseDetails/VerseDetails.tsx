/**
 * VerseDetails page component
 * Displays comprehensive details for a single verse card and provides management options
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useVerseDetails } from './hooks/useVerseDetails';
import { useAuth } from '../../contexts/AuthContext';
import { dataService } from '../../services/dataService';
import { useState } from 'react';

// Format day names for display
const DAY_NAMES = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Format phase names for display
const PHASE_DISPLAY_NAMES = {
  daily: 'Daily',
  weekly: 'Weekly', 
  biweekly: 'Biweekly',
  monthly: 'Monthly'
};

export function VerseDetails() {
  const { verseCardId } = useParams<{ verseCardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { verseDetails, loading, error, refreshDetails, clearError } = useVerseDetails(verseCardId!);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Format assignment display based on current phase
  const getAssignmentDisplay = () => {
    if (!verseDetails) return '';
    
    switch (verseDetails.currentPhase) {
      case 'daily':
        return 'Every day';
      case 'weekly':
        return verseDetails.assignedDayOfWeek 
          ? `Every ${DAY_NAMES[verseDetails.assignedDayOfWeek]}`
          : 'Weekly (day not assigned)';
      case 'biweekly':
        const dayName = verseDetails.assignedDayOfWeek ? DAY_NAMES[verseDetails.assignedDayOfWeek] : 'day not assigned';
        const parity = verseDetails.assignedWeekParity === 0 ? 'even' : 'odd';
        return `Every ${dayName} (${parity} weeks)`;
      case 'monthly':
        return verseDetails.assignedDayOfMonth
          ? `Day ${verseDetails.assignedDayOfMonth} of each month`
          : 'Monthly (day not assigned)';
      default:
        return '';
    }
  };

  // Handle verse deletion (soft delete by archiving)
  const handleDelete = async () => {
    if (!verseDetails || !user) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${verseDetails.verse.reference}"? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await dataService.archiveVerse(verseDetails.id, user.id);
      navigate('/library');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete verse';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/library')}
              className="flex items-center text-primary/60 hover:text-primary transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="15,18 9,12 15,6"></polyline>
              </svg>
              Back to Library
            </button>
          </div>
          
          <div className="bg-background border border-error/30 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-error font-medium">Error loading verse details</h3>
                <p className="text-error/80 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={() => {
                  clearError();
                  refreshDetails();
                }}
                className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !verseDetails) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/library')}
              className="flex items-center text-primary/60 hover:text-primary transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="15,18 9,12 15,6"></polyline>
              </svg>
              Back to Library
            </button>
          </div>
          <div className="animate-pulse">
            <div className="h-8 bg-primary/10 rounded w-1/3 mb-4"></div>
            <div className="h-20 bg-primary/10 rounded mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-primary/10 rounded w-1/2"></div>
              <div className="h-4 bg-primary/10 rounded w-1/3"></div>
              <div className="h-4 bg-primary/10 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-8 sm:px-6 lg:px-8">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/library')}
            className="flex items-center text-primary/60 hover:text-primary transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline points="15,18 9,12 15,6"></polyline>
            </svg>
            Back to Library
          </button>
          
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors font-medium disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete Verse'}
          </button>
        </div>

        {/* Delete Error */}
        {deleteError && (
          <div className="mb-6 bg-background border border-error/30 rounded-xl p-4">
            <p className="text-error text-sm">{deleteError}</p>
          </div>
        )}

        {/* Verse Reference and Text */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-4">
            {verseDetails.verse.reference}
          </h1>
          <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm">
            <p className="text-lg text-primary leading-relaxed" style={{ fontFamily: 'Crimson Text, serif' }}>
              {verseDetails.verse.text}
            </p>
            <p className="text-sm text-primary/60 mt-4">
              {verseDetails.verse.translation}
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Phase Information */}
          <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-primary mb-4">Learning Phase</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Current Phase:</span>
                <span className="font-medium text-primary">
                  {PHASE_DISPLAY_NAMES[verseDetails.currentPhase]}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Progress Count:</span>
                <span className="font-medium text-primary">
                  {verseDetails.phaseProgressCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Assignment:</span>
                <span className="font-medium text-primary text-right">
                  {getAssignmentDisplay()}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Information */}
          <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-primary mb-4">Progress</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Current Streak:</span>
                <span className="font-medium text-primary">
                  {verseDetails.currentStreak} days
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Best Streak:</span>
                <span className="font-medium text-primary">
                  {verseDetails.bestStreak} days
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Next Due:</span>
                <span className="font-medium text-primary">
                  {new Date(verseDetails.nextDueDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Review History */}
          <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-primary mb-4">Review History</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Last Reviewed:</span>
                <span className="font-medium text-primary">
                  {verseDetails.lastReviewedAt 
                    ? new Date(verseDetails.lastReviewedAt).toLocaleDateString()
                    : 'Never'
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Added:</span>
                <span className="font-medium text-primary">
                  {new Date(verseDetails.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Additional Week Parity for Biweekly */}
          {verseDetails.currentPhase === 'biweekly' && (
            <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-primary mb-4">Biweekly Schedule</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-primary/70">Week Parity:</span>
                  <span className="font-medium text-primary">
                    {verseDetails.assignedWeekParity === 0 ? 'Even weeks' : 'Odd weeks'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-primary/70">Day of Week:</span>
                  <span className="font-medium text-primary">
                    {verseDetails.assignedDayOfWeek 
                      ? DAY_NAMES[verseDetails.assignedDayOfWeek]
                      : 'Not assigned'
                    }
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}