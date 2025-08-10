/**
 * VerseDetails page component
 * Displays verse details based on reference from URL with smart lookup strategy:
 * 1. Check local user verse cards
 * 2. Check local verses cache  
 * 3. Check cloud verses cache
 * 4. Call ESV API as last resort
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dataService } from '../../services/dataService';
import { supabaseClient } from '../../services/supabase';
import { localDb, db } from '../../services/localDb';
import { decodeReference } from '../../utils/referenceEncoding';
import { normalizeReferenceForLookup } from '../../utils/referenceNormalizer';
import { useState, useEffect } from 'react';
import { useHybridLoading } from '../../hooks/useHybridLoading';
import { AddToCollectionSkeleton } from '../../components/skeletons/AddToCollectionSkeleton';
import { VerseDetailsSkeleton } from '../../components/skeletons/VerseDetailsSkeleton';
import type { LocalDBSchema } from '../../services/localDb';

// Format day names for display
const DAY_NAMES = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


// Page states
type PageState = 
  | { type: 'loading' }
  | { type: 'user_verse'; verseCard: LocalDBSchema['verse_cards']; verse: LocalDBSchema['verses'] }
  | { type: 'add_to_collection'; verse: LocalDBSchema['verses'] }
  | { type: 'not_found'; reference: string; error?: string };

export function VerseDetails() {
  const { reference: encodedReference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const { getCurrentUserId, getAccessToken } = useAuth();
  const [pageState, setPageState] = useState<PageState>({ type: 'loading' });
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isChangingPhase, setIsChangingPhase] = useState(false);
  const [phaseChangeError, setPhaseChangeError] = useState<string | null>(null);
  const [isChangingAssignment, setIsChangingAssignment] = useState(false);
  const [assignmentChangeError, setAssignmentChangeError] = useState<string | null>(null);
  const [expectUserVerse, setExpectUserVerse] = useState(false);

  // Decode reference from URL
  const reference = encodedReference ? decodeReference(encodedReference) : '';
  const normalizedReference = normalizeReferenceForLookup(reference);

  // Use hybrid loading to prevent UI flicker
  const { showSkeleton, isComplete } = useHybridLoading(isLoading);

  console.log('🔍 VerseDetails render:', { 
    reference, 
    normalizedReference, 
    isLoading, 
    showSkeleton, 
    isComplete, 
    pageStateType: pageState.type 
  });

  // Quick check if user has this verse locally (for skeleton selection)
  useEffect(() => {
    const checkUserVerse = async () => {
      const userId = getCurrentUserId();
      if (userId && normalizedReference) {
        const userVerseCard = await localDb.verseCards.findByUserAndReference(userId, normalizedReference);
        setExpectUserVerse(!!userVerseCard);
      }
    };
    checkUserVerse();
  }, [normalizedReference, getCurrentUserId]);

  // Load verse data using our lookup strategy
  useEffect(() => {
    if (!reference) {
      setPageState({ type: 'not_found', reference: encodedReference || '', error: 'Invalid reference' });
      setIsLoading(false);
      return;
    }

    loadVerseData();
  }, [reference]);

  const loadVerseData = async () => {
    setIsLoading(true); // Start loading for all operations
    setPageState({ type: 'loading' });
    
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setPageState({ type: 'not_found', reference, error: 'Authentication required' });
        setIsLoading(false);
        return;
      }

      // 1. Check if user has this verse locally (by exact reference) - should be instant
      let userVerseCard = await localDb.verseCards.findByUserAndReference(userId, normalizedReference);
      let verse: LocalDBSchema['verses'] | undefined;
      
      if (userVerseCard) {
        verse = await localDb.verses.findById(userVerseCard.verse_id);
        if (verse) {
          setPageState({ type: 'user_verse', verseCard: userVerseCard, verse });
          setIsLoading(false); // Local lookup complete - won't show skeleton due to speed
          return;
        }
      }

      // 1b. Check if user has this verse via alias - should be instant
      const aliasMatch = await localDb.aliases.findByAlias(normalizedReference);
      if (aliasMatch) {
        verse = await localDb.verses.findById(aliasMatch.verse_id);
        if (verse) {
          userVerseCard = await localDb.verseCards.findByUserAndReference(userId, verse.reference);
          if (userVerseCard) {
            setPageState({ type: 'user_verse', verseCard: userVerseCard, verse });
            setIsLoading(false); // Local lookup complete - won't show skeleton due to speed
            return;
          }
        }
      }

      // 2. Check if verse exists in local verses table (exact reference) - should be instant
      const localVerse = await localDb.verses.findByReferenceExact(normalizedReference);
      
      if (localVerse) {
        setPageState({ type: 'add_to_collection', verse: localVerse });
        setIsLoading(false); // Local lookup complete - won't show skeleton due to speed
        return;
      }

      // 2b. Check if verse exists via local alias - should be instant
      if (aliasMatch && verse) {
        setPageState({ type: 'add_to_collection', verse });
        setIsLoading(false); // Local lookup complete - won't show skeleton due to speed
        return;
      }

      // Remote operations continue with isLoading already true - skeleton will show

      // 3. Check if verse exists in Supabase cloud verses table (exact reference)
      const { data: cloudVerse, error: cloudError } = await supabaseClient
        .from('verses')
        .select('*')
        .eq('reference', normalizedReference)
        .eq('translation', 'ESV')
        .single();

      if (cloudVerse && !cloudError) {
        // Add to local cache and show add to collection page
        const localVerseData = await localDb.verses.create({
          reference: cloudVerse.reference,
          text: cloudVerse.text,
          translation: cloudVerse.translation,
          is_verified: true
        });
        setPageState({ type: 'add_to_collection', verse: localVerseData });
        setIsLoading(false);
        return;
      }

      // 3b. Check if verse exists in cloud via alias
      const { data: cloudAlias, error: aliasError } = await supabaseClient
        .from('aliases')
        .select('verse_id, verses(*)')
        .eq('alias', normalizedReference)
        .single();

      if (cloudAlias && !aliasError && cloudAlias.verses) {
        // Cache both verse and alias locally
        const localVerseData = await localDb.verses.create({
          reference: (cloudAlias.verses as any).reference,
          text: (cloudAlias.verses as any).text,
          translation: (cloudAlias.verses as any).translation,
          is_verified: true
        });

        await localDb.aliases.create({
          alias: normalizedReference,
          verse_id: localVerseData.id!
        });

        setPageState({ type: 'add_to_collection', verse: localVerseData });
        setIsLoading(false);
        return;
      }

      // 4. Finally, call ESV API as last resort
      console.log('🔍 Calling ESV API for reference:', normalizedReference);
      try {
        const result = await dataService.lookupVerseReference(normalizedReference);
        console.log('📖 ESV API result:', result);
        if (result.success && result.verse) {
          console.log('✅ ESV API found verse, showing add to collection');
          setPageState({ type: 'add_to_collection', verse: result.verse });
          setIsLoading(false);
          return;
        } else {
          console.log('❌ ESV API returned no verse, result:', result);
          // Use the specific error message from the API if available
          const errorMessage = result.error || 'Unable to load this verse right now. Please try again in a moment.';
          setPageState({ type: 'not_found', reference, error: errorMessage });
          setIsLoading(false);
          return;
        }
      } catch (esvError) {
        console.error('🚨 ESV API Error:', esvError);
        // Use the error message from the exception if available
        const errorMessage = esvError instanceof Error ? esvError.message : 'Unable to load this verse right now. Please try again in a moment.';
        setPageState({ type: 'not_found', reference, error: errorMessage });
        setIsLoading(false);
        return;
      }

    } catch (error) {
      console.error('Error loading verse data:', error);
      setPageState({ type: 'not_found', reference, error: 'An error occurred while loading the verse.' });
      setIsLoading(false);
    }
  };

  // Format assignment display based on current phase
  const getAssignmentDisplay = (verseCard: LocalDBSchema['verse_cards']) => {
    switch (verseCard.current_phase) {
      case 'daily':
        return 'Every day';
      case 'weekly':
        return verseCard.assigned_day_of_week 
          ? `Every ${DAY_NAMES[verseCard.assigned_day_of_week]}`
          : 'Weekly (day not assigned)';
      case 'biweekly':
        const dayName = verseCard.assigned_day_of_week ? DAY_NAMES[verseCard.assigned_day_of_week] : 'day not assigned';
        const parity = verseCard.assigned_week_parity === 0 ? 'even' : 'odd';
        return `Every ${dayName} (${parity} weeks)`;
      case 'monthly':
        return verseCard.assigned_day_of_month
          ? `Day ${verseCard.assigned_day_of_month} of each month`
          : 'Monthly (day not assigned)';
      default:
        return '';
    }
  };

  // Handle verse deletion (soft delete by archiving)
  const handleDelete = async (verseCard: LocalDBSchema['verse_cards'], verse: LocalDBSchema['verses']) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${verse.reference}"? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const userId = getCurrentUserId();
      await dataService.archiveVerse(verseCard.id!, userId);
      navigate('/library');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete verse';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle adding verse to collection
  const handleAddToCollection = async (verse: LocalDBSchema['verses']) => {
    try {
      const userId = getCurrentUserId();
      await dataService.addVerse(verse.reference, userId);
      
      // If the user accessed this verse via an alias (different from canonical reference),
      // create the alias so they can find it again the same way
      if (normalizedReference !== verse.reference) {
        try {
          await localDb.aliases.create({
            alias: normalizedReference,
            verse_id: verse.id!
          });
        } catch (aliasError) {
          console.log('Alias may already exist:', aliasError);
          // Don't fail the whole operation for alias creation errors
        }
      }
      
      // Reload to show user verse page
      loadVerseData();
    } catch (error) {
      console.error('Failed to add verse to collection:', error);
      setDeleteError(error instanceof Error ? error.message : 'Failed to add verse');
    }
  };

  // Handle manual phase change
  const handlePhaseChange = async (verseCard: LocalDBSchema['verse_cards'], newPhase: 'daily' | 'weekly' | 'biweekly' | 'monthly') => {
    setIsChangingPhase(true);
    setPhaseChangeError(null);

    try {
      const userId = getCurrentUserId();
      const accessToken = await getAccessToken();
      const result = await dataService.changeVersePhase(verseCard.id!, newPhase, userId, accessToken || undefined);
      
      if (result.success && result.local) {
        // Update the page state with the new verse card data
        if (pageState.type === 'user_verse') {
          setPageState({
            type: 'user_verse',
            verseCard: result.local,
            verse: pageState.verse
          });
        }
      }
      
      // Show any remote sync warnings
      if (result.errors.remote) {
        console.warn('Phase change synced locally but failed remotely:', result.errors.remote);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change phase';
      setPhaseChangeError(errorMessage);
      setTimeout(() => setPhaseChangeError(null), 5000);
    } finally {
      setIsChangingPhase(false);
    }
  };

  // Handle assignment change
  const handleAssignmentChange = async (
    verseCard: LocalDBSchema['verse_cards'], 
    assignmentType: 'day_of_week' | 'day_of_month' | 'week_parity',
    newValue: number
  ) => {
    setIsChangingAssignment(true);
    setAssignmentChangeError(null);

    try {
      // Update locally first
      const updates: Partial<LocalDBSchema['verse_cards']> = {};
      
      if (assignmentType === 'day_of_week') {
        updates.assigned_day_of_week = newValue;
      } else if (assignmentType === 'day_of_month') {
        updates.assigned_day_of_month = newValue;
      } else if (assignmentType === 'week_parity') {
        updates.assigned_week_parity = newValue;
      }

      // Recalculate next due date based on new assignment
      const now = new Date();
      let nextDue: Date;
      
      if (verseCard.current_phase === 'weekly' && assignmentType === 'day_of_week') {
        // Calculate next occurrence of this weekday
        // Convert our day numbering (1=Sun, 2=Mon, ..., 7=Sat) to JS getDay() (0=Sun, 1=Mon, ..., 6=Sat)
        const today = new Date();
        const jsTargetDay = newValue - 1; // Convert 1-7 to 0-6
        const daysDiff = (jsTargetDay - today.getDay() + 7) % 7;
        nextDue = new Date(today.getTime() + (daysDiff === 0 ? 7 : daysDiff) * 24 * 60 * 60 * 1000);
      } else if (verseCard.current_phase === 'biweekly' && assignmentType === 'day_of_week') {
        // Find next occurrence of weekday with current week parity
        // Convert our day numbering (1=Sun, 2=Mon, ..., 7=Sat) to JS getDay() (0=Sun, 1=Mon, ..., 6=Sat)
        const today = new Date();
        const jsTargetDay = newValue - 1; // Convert 1-7 to 0-6
        let checkDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Start tomorrow
        while (checkDate.getDay() !== jsTargetDay || 
               (Math.floor(checkDate.getTime() / (1000 * 60 * 60 * 24 * 7)) % 2) !== (verseCard.assigned_week_parity || 0)) {
          checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
          if (checkDate.getTime() > today.getTime() + 14 * 24 * 60 * 60 * 1000) break; // Safety break
        }
        nextDue = checkDate;
      } else if (verseCard.current_phase === 'biweekly' && assignmentType === 'week_parity') {
        // Find next occurrence of current weekday with new week parity
        // Convert our day numbering (1=Sun, 2=Mon, ..., 7=Sat) to JS getDay() (0=Sun, 1=Mon, ..., 6=Sat)
        const today = new Date();
        const jsCurrentDay = (verseCard.assigned_day_of_week || 1) - 1; // Convert 1-7 to 0-6
        let checkDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Start tomorrow
        while (checkDate.getDay() !== jsCurrentDay || 
               (Math.floor(checkDate.getTime() / (1000 * 60 * 60 * 24 * 7)) % 2) !== newValue) {
          checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
          if (checkDate.getTime() > today.getTime() + 14 * 24 * 60 * 60 * 1000) break; // Safety break
        }
        nextDue = checkDate;
      } else if (verseCard.current_phase === 'monthly' && assignmentType === 'day_of_month') {
        // Find next occurrence of this day of month
        const today = new Date();
        const currentMonth = new Date(today.getFullYear(), today.getMonth(), newValue);
        nextDue = currentMonth <= today 
          ? new Date(today.getFullYear(), today.getMonth() + 1, newValue)
          : currentMonth;
      } else {
        // Fallback - just add one day
        nextDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }

      updates.next_due_date = nextDue.toISOString().split('T')[0]; // YYYY-MM-DD format
      updates.updated_at = new Date().toISOString();

      // Update local database
      await db.verse_cards.update(verseCard.id!, updates);
      
      // Update page state
      if (pageState.type === 'user_verse') {
        setPageState({
          type: 'user_verse',
          verseCard: { ...verseCard, ...updates },
          verse: pageState.verse
        });
      }

      // Sync changes to remote database
      console.log('🔄 Syncing assignment changes to remote database...');
      try {
        const accessToken = await getAccessToken();
        const userId = getCurrentUserId();
        
        if (accessToken && userId) {
          await dataService.updateVerseCardRemote(verseCard.id!, updates, userId, accessToken);
          console.log('✅ Assignment changes synced to remote successfully');
        } else {
          console.warn('⚠️ No access token available, changes saved locally only');
        }
      } catch (syncError) {
        console.error('❌ Failed to sync assignment changes to remote:', syncError);
        // Don't show error to user since local update succeeded
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change assignment';
      setAssignmentChangeError(errorMessage);
      setTimeout(() => setAssignmentChangeError(null), 5000);
    } finally {
      setIsChangingAssignment(false);
    }
  };

  // Show skeleton while loading
  // Use VerseDetailsSkeleton if we expect the user has this verse,
  // Otherwise use AddToCollectionSkeleton for new verses from API
  if (showSkeleton) {
    return expectUserVerse ? <VerseDetailsSkeleton /> : <AddToCollectionSkeleton />;
  }

  // Render based on page state
  if (pageState.type === 'loading') {
    // This should rarely be hit now with hybrid loading
    return null;
  }

  if (pageState.type === 'not_found') {
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
          
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-primary mb-4 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent max-w-full">
              {pageState.reference}
            </h1>
            <p className="text-primary/60 mb-6">
              {pageState.error || 'Verse not found. Please check the spelling or try a different reference.'}
            </p>
            <button
              onClick={loadVerseData}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pageState.type === 'add_to_collection') {
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

          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary mb-4 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent max-w-full">
              {pageState.verse.reference}
            </h1>
            
            <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm mb-8">
              <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                <p className="text-lg text-primary leading-relaxed" style={{ fontFamily: 'Crimson Text, serif' }}>
                  {pageState.verse.text}
                </p>
              </div>
              <p className="text-sm text-primary/60 mt-4">
                {pageState.verse.translation}
              </p>
            </div>

            <p className="text-primary/70 mb-6">
              You don't seem to have this verse in your collection. Want to start memorizing it?
            </p>

            <button
              onClick={() => handleAddToCollection(pageState.verse)}
              className="px-6 py-3 bg-success text-white rounded-lg hover:bg-success/90 transition-colors font-medium"
            >
              Add to My Collection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User verse details page (pageState.type === 'user_verse')
  if (pageState.type !== 'user_verse') {
    return null;
  }
  
  const { verseCard, verse } = pageState;

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
            onClick={() => handleDelete(verseCard, verse)}
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

        {/* Phase Change Error */}
        {phaseChangeError && (
          <div className="mb-6 bg-background border border-error/30 rounded-xl p-4">
            <p className="text-error text-sm">{phaseChangeError}</p>
          </div>
        )}

        {/* Assignment Change Error */}
        {assignmentChangeError && (
          <div className="mb-6 bg-background border border-error/30 rounded-xl p-4">
            <p className="text-error text-sm">{assignmentChangeError}</p>
          </div>
        )}

        {/* Verse Reference and Text */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-4 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent max-w-full">
            {verse.reference}
          </h1>
          <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm">
            <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
              <p className="text-lg text-primary leading-relaxed" style={{ fontFamily: 'Crimson Text, serif' }}>
                {verse.text}
              </p>
            </div>
            <p className="text-sm text-primary/60 mt-4">
              {verse.translation}
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Phase Information */}
          <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-primary mb-4">Learning Phase</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Current Phase:</span>
                <select
                  value={verseCard.current_phase}
                  onChange={(e) => handlePhaseChange(verseCard, e.target.value as any)}
                  disabled={isChangingPhase}
                  className="bg-white border border-primary/20 rounded px-3 py-1 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-50"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Progress Count:</span>
                <span className="font-medium text-primary">
                  {verseCard.phase_progress_count}
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-primary/70">Assignment:</span>
                  <span className="font-medium text-primary text-right">
                    {isChangingPhase ? 'Calculating...' : getAssignmentDisplay(verseCard)}
                  </span>
                </div>
                
                {/* Weekly Assignment Controls */}
                {verseCard.current_phase === 'weekly' && (
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm text-primary/60">Day of Week:</span>
                    <select
                      value={verseCard.assigned_day_of_week || 1}
                      onChange={(e) => handleAssignmentChange(verseCard, 'day_of_week', parseInt(e.target.value))}
                      disabled={isChangingAssignment}
                      className="bg-white border border-primary/20 rounded px-2 py-1 text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-50"
                    >
                      <option value={1}>Sunday</option>
                      <option value={2}>Monday</option>
                      <option value={3}>Tuesday</option>
                      <option value={4}>Wednesday</option>
                      <option value={5}>Thursday</option>
                      <option value={6}>Friday</option>
                      <option value={7}>Saturday</option>
                    </select>
                  </div>
                )}
                
                {/* Biweekly Assignment Controls */}
                {verseCard.current_phase === 'biweekly' && (
                  <>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-sm text-primary/60">Day of Week:</span>
                      <select
                        value={verseCard.assigned_day_of_week || 1}
                        onChange={(e) => handleAssignmentChange(verseCard, 'day_of_week', parseInt(e.target.value))}
                        disabled={isChangingAssignment}
                        className="bg-white border border-primary/20 rounded px-2 py-1 text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-50"
                      >
                        <option value={1}>Sunday</option>
                        <option value={2}>Monday</option>
                        <option value={3}>Tuesday</option>
                        <option value={4}>Wednesday</option>
                        <option value={5}>Thursday</option>
                        <option value={6}>Friday</option>
                        <option value={7}>Saturday</option>
                      </select>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-primary/60">Week Pattern:</span>
                      <select
                        value={verseCard.assigned_week_parity || 0}
                        onChange={(e) => handleAssignmentChange(verseCard, 'week_parity', parseInt(e.target.value))}
                        disabled={isChangingAssignment}
                        className="bg-white border border-primary/20 rounded px-2 py-1 text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-50"
                      >
                        <option value={0}>Even weeks</option>
                        <option value={1}>Odd weeks</option>
                      </select>
                    </div>
                  </>
                )}
                
                {/* Monthly Assignment Controls */}
                {verseCard.current_phase === 'monthly' && (
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm text-primary/60">Day of Month:</span>
                    <select
                      value={verseCard.assigned_day_of_month || 1}
                      onChange={(e) => handleAssignmentChange(verseCard, 'day_of_month', parseInt(e.target.value))}
                      disabled={isChangingAssignment}
                      className="bg-white border border-primary/20 rounded px-2 py-1 text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-50"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {(isChangingPhase || isChangingAssignment) && (
                <div className="flex items-center justify-center py-2">
                  <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                  <span className="ml-2 text-sm text-primary/60">
                    {isChangingPhase ? 'Updating phase...' : 'Updating assignment...'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Progress Information */}
          <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-primary mb-4">Progress</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Current Streak:</span>
                <span className="font-medium text-primary">
                  {verseCard.current_streak} days
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Best Streak:</span>
                <span className="font-medium text-primary">
                  {verseCard.best_streak} days
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Next Due:</span>
                <span className="font-medium text-primary">
                  {new Date(verseCard.next_due_date).toLocaleDateString()}
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
                  {verseCard.last_reviewed_at 
                    ? new Date(verseCard.last_reviewed_at).toLocaleDateString()
                    : 'Never'
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary/70">Added:</span>
                <span className="font-medium text-primary">
                  {new Date(verseCard.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Additional Week Parity for Biweekly */}
          {verseCard.current_phase === 'biweekly' && (
            <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-primary mb-4">Biweekly Schedule</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-primary/70">Week Parity:</span>
                  <span className="font-medium text-primary">
                    {verseCard.assigned_week_parity === 0 ? 'Even weeks' : 'Odd weeks'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-primary/70">Day of Week:</span>
                  <span className="font-medium text-primary">
                    {verseCard.assigned_day_of_week 
                      ? DAY_NAMES[verseCard.assigned_day_of_week]
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