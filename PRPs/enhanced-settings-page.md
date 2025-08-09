# Enhanced Settings Page - Project Resource Package (PRP)

name: "Enhanced Settings Page Implementation"
description: |

## Purpose
Comprehensive PRP to enhance the Settings page with full user profile management capabilities, allowing users to update all editable user_profiles data fields using the existing dual-write architecture and design patterns.

## Core Principles
1. **Follow Existing Patterns**: Use established form, validation, and styling patterns
2. **Dual-Write Architecture**: Local-first updates with graceful remote sync
3. **User Experience First**: Immediate feedback with loading states and validation
4. **Design System Consistency**: Use existing components and design tokens
5. **Graceful Degradation**: Work offline, sync when online

---

## Goal
Transform the basic Settings page into a comprehensive user profile management interface where users can edit email, full name, display mode, translation preference, and timezone with immediate local updates and background synchronization.

## Why
- **User Control**: Users need to manage their profile information
- **Personalization**: Timezone and display preferences affect user experience
- **Data Completeness**: Current settings are incomplete and missing key functionality
- **Consistency**: Profile updates should follow the same patterns as other data operations

## What
Enhanced Settings page with form inputs for all editable profile fields, real-time validation, immediate local updates, and background sync following the established dual-write architecture.

### Success Criteria
- [ ] All editable user profile fields can be modified (email, full_name, timezone, preferred_translation, reference_display_mode)
- [ ] Changes save locally immediately with visual feedback
- [ ] Remote sync occurs in background with error handling
- [ ] Form validation prevents invalid data entry
- [ ] Loading states and success feedback provided
- [ ] Offline functionality maintained
- [ ] Consistent with existing app design and patterns

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Existing patterns to follow

- file: /projects/verses/src/pages/Settings/Settings.tsx
  why: Current settings structure, existing form patterns, account management
  pattern: Input styling, button usage, loading states, validation
  critical: Lines 45-120 contain existing form implementation to extend

- file: /projects/verses/src/components/Button/Button.tsx
  why: Established button component with variants and states
  pattern: Props interface, variant system, loading states
  critical: Use existing primary/secondary variants, loading prop

- file: /projects/verses/src/pages/AddVerse/components/VerseReferenceInput.tsx
  why: Sophisticated input component with validation and visual feedback
  pattern: Real-time validation, error states, success indicators
  critical: Follow this pattern for enhanced form inputs

- file: /projects/verses/src/services/dataService.ts
  why: Dual-write operations, user profile sync patterns
  pattern: DualWriteResult interface, local-first operations, graceful sync
  critical: Lines 1000-1045 contain existing profile sync to extend

- file: /projects/verses/src/services/localDb.ts
  why: User profiles database schema and operations
  pattern: userProfiles helper methods, transaction patterns
  critical: Lines 367-433 contain profile operations to enhance

- file: /projects/verses/src/contexts/AuthContext.tsx
  why: User context, profile integration, authentication state
  pattern: User object structure, metadata access
  critical: Integration point for profile updates

- file: /projects/verses/src/contexts/TimezoneContext.tsx
  why: Timezone detection and management patterns
  pattern: Browser timezone detection, profile creation
  critical: Lines 15-25 show timezone handling to build upon
```

### Current Settings Page Analysis
```tsx
// EXISTING STRUCTURE (to enhance, not replace)
src/pages/Settings/Settings.tsx:
├── Account Section
│   ├── Anonymous user conversion form ✅ KEEP
│   └── Authenticated user display ✅ ENHANCE
├── Display Preferences
│   └── Reference display mode ✅ ENHANCE
└── Sign Out ✅ KEEP

// CURRENT FORM PATTERN (to follow)
<input
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
  placeholder="your@email.com"
  required
/>
```

### User Profiles Database Schema
```typescript
// COMPLETE SCHEMA (from localDb.ts)
interface UserProfile {
  id?: string;                   // System field - READ ONLY
  user_id: string;               // System field - READ ONLY  
  email: string | null;          // ✅ EDITABLE
  full_name: string | null;      // ✅ EDITABLE
  timezone: string;              // ✅ EDITABLE (defaults to 'UTC')
  preferred_translation: string; // ✅ EDITABLE (defaults to 'ESV')
  reference_display_mode: string; // ✅ EDITABLE (defaults to 'full')
  created_at: string;            // System field - READ ONLY
  updated_at: string;            // System field - READ ONLY
}

// EXISTING OPTIONS
reference_display_mode: 'full' | 'first' | 'blank'
preferred_translation: 'ESV' // Only option currently, design for future
timezone: Intl timezone string (e.g. 'America/New_York')
```

### Desired Enhancement Structure
```bash
src/pages/Settings/
├── Settings.tsx                 # ENHANCED: Add profile management section
├── components/                  # NEW: Enhanced form components
│   ├── ProfileSection.tsx       # NEW: User profile management
│   ├── EnhancedInput.tsx       # NEW: Input with validation feedback
│   ├── TimezoneSelector.tsx    # NEW: Timezone selection dropdown
│   └── TranslationSelector.tsx # NEW: Bible translation selector
└── hooks/
    └── useProfileUpdates.ts    # NEW: Profile update logic with dual-write
```

### Known Gotchas & Implementation Details
```typescript
// CRITICAL: Follow existing dual-write pattern
interface ProfileUpdateResult {
  local: UserProfile | null;
  remote: UserProfile | null;
  errors: {
    local?: Error;
    remote?: Error;
  };
  success: boolean;
}

// CRITICAL: Timezone handling considerations
// - Use Intl.supportedValuesOf('timeZone') for full list
// - Provide curated common timezones for better UX
// - Default to browser-detected timezone
const commonTimezones = [
  'America/New_York', 'America/Chicago', 'America/Denver', 
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris',
  'Asia/Tokyo', 'Australia/Sydney', 'UTC'
];

// CRITICAL: Form validation patterns
// - Email: HTML5 validation + custom checks
// - Full name: Basic length validation (1-100 chars)
// - Timezone: Must be valid Intl timezone string
// - Translation: Must be in supported list
// - Display mode: Must be 'full' | 'first' | 'blank'

// CRITICAL: Loading states and feedback
// - Immediate local update (optimistic UI)
// - Show loading indicator during remote sync
// - Success feedback on completion
// - Error handling with retry options

// CRITICAL: Integration with existing auth context
// - Update user metadata when profile changes
// - Trigger profile sync on auth state changes
// - Handle anonymous vs authenticated user differences
```

## Implementation Blueprint

### Data Models and Interfaces

```typescript
// Enhanced form state management
interface ProfileFormState {
  email: string;
  fullName: string;
  timezone: string;
  preferredTranslation: string;
  referenceDisplayMode: 'full' | 'first' | 'blank';
  isLoading: boolean;
  errors: Record<string, string>;
  hasUnsavedChanges: boolean;
}

// Profile update operation
interface ProfileUpdateData {
  email?: string | null;
  full_name?: string | null;
  timezone?: string;
  preferred_translation?: string;
  reference_display_mode?: string;
}

// Enhanced input component props
interface EnhancedInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: 'text' | 'email';
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
}
```

### Task List (Implementation Order)

```yaml
Task 1 - Enhance Data Service with Profile Updates:
MODIFY src/services/dataService.ts:
  - ADD updateUserProfile() method with dual-write pattern
  - IMPLEMENT profile validation functions
  - ADD error handling for profile sync failures
  - PRESERVE existing syncUserProfile() method

Task 2 - Create Enhanced Form Components:
CREATE src/pages/Settings/components/:
  - EnhancedInput.tsx: Input with validation feedback
  - TimezoneSelector.tsx: Dropdown with common timezone options
  - TranslationSelector.tsx: Bible translation selector
  - ProfileSection.tsx: Complete profile management section

Task 3 - Create Profile Update Hook:
CREATE src/pages/Settings/hooks/useProfileUpdates.ts:
  - IMPLEMENT profile update logic with dual-write
  - HANDLE form state management and validation
  - ADD loading states and error handling
  - INTEGRATE with existing auth context

Task 4 - Enhance Settings Page:
MODIFY src/pages/Settings/Settings.tsx:
  - ADD ProfileSection component
  - INTEGRATE with useProfileUpdates hook
  - PRESERVE existing account and sign-out functionality
  - ENHANCE responsive design for new sections

Task 5 - Add Profile Validation:
CREATE src/utils/profileValidation.ts:
  - IMPLEMENT email validation (beyond HTML5)
  - ADD timezone validation
  - ADD name length and character validation
  - CREATE validation error messages

Task 6 - Update Local Database Operations:
ENHANCE src/services/localDb.ts:
  - IMPROVE userProfiles.update() method
  - ADD transaction support for profile updates
  - ENHANCE error handling and validation
  - MAINTAIN existing helper methods

Task 7 - Success Feedback and UI Polish:
CREATE src/components/SuccessFeedback/SuccessFeedback.tsx:
  - DISPLAY success messages for profile updates
  - AUTO-DISMISS after timeout
  - CONSISTENT with existing design system
  - ACCESSIBLE with proper ARIA attributes

Task 8 - Comprehensive Testing:
CREATE tests for profile management:
  - UNIT: Profile update logic and validation
  - INTEGRATION: Form interaction and sync behavior
  - USER EXPERIENCE: Loading states and error handling
  - ACCESSIBILITY: Keyboard navigation and screen readers
```

### Per-Task Detailed Implementation

```typescript
// Task 1: Enhanced Data Service Profile Updates
// ADD to existing dataService.ts
export const dataService = {
  // ... existing methods
  
  /**
   * Updates user profile with dual-write pattern
   */
  async updateUserProfile(
    userId: string,
    updates: ProfileUpdateData,
    accessToken?: string
  ): Promise<DualWriteResult<LocalDBSchema['user_profiles']>> {
    const result: DualWriteResult<LocalDBSchema['user_profiles']> = {
      local: null,
      remote: null,
      errors: {},
      success: false
    };

    try {
      // Step 1: Validate profile data
      const validationErrors = validateProfileUpdates(updates);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      // Step 2: Update locally first (optimistic UI)
      const updatedProfile = await db.transaction('rw', db.user_profiles, async (tx) => {
        const existing = await tx.user_profiles.where('user_id').equals(userId).first();
        if (!existing) {
          throw new Error('User profile not found');
        }

        const updateData = {
          ...updates,
          updated_at: new Date().toISOString()
        };

        await tx.user_profiles.update(existing.id!, updateData);
        return await tx.user_profiles.get(existing.id!);
      });

      result.local = updatedProfile!;

      // Step 3: Sync to remote (graceful degradation)
      if (accessToken) {
        try {
          const { data: remoteProfile, error: remoteError } = await supabaseClient
            .from('user_profiles')
            .update(updates)
            .eq('user_id', userId)
            .select()
            .single();

          if (remoteError) throw remoteError;
          result.remote = remoteProfile;
        } catch (error) {
          result.errors.remote = new NetworkError(
            'Failed to sync profile to remote - changes saved locally',
            error as Error
          );
        }
      }

      result.success = true;
      return result;
    } catch (error) {
      result.errors.local = error as Error;
      throw error;
    }
  }
};

// Task 2: Enhanced Input Component
// CREATE src/pages/Settings/components/EnhancedInput.tsx
import React from 'react';

interface EnhancedInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: 'text' | 'email';
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
}

export const EnhancedInput: React.FC<EnhancedInputProps> = ({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  error,
  required = false,
  disabled = false,
  maxLength,
  className = ''
}) => {
  const inputId = `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  
  return (
    <div className={`mb-4 ${className}`}>
      <label 
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </label>
      
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        className={`
          w-full px-3 py-2 border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-accent
          disabled:bg-gray-50 disabled:cursor-not-allowed
          ${error 
            ? 'border-error focus:ring-error' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
        aria-describedby={error ? `${inputId}-error` : undefined}
        aria-invalid={!!error}
      />
      
      {error && (
        <p 
          id={`${inputId}-error`}
          className="mt-1 text-sm text-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};

// Task 3: Profile Update Hook
// CREATE src/pages/Settings/hooks/useProfileUpdates.ts
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { dataService } from '../../../services/dataService';
import { db } from '../../../services/localDb';

export function useProfileUpdates() {
  const { user, getCurrentUserId } = useAuth();
  const [formState, setFormState] = useState<ProfileFormState>({
    email: '',
    fullName: '',
    timezone: 'UTC',
    preferredTranslation: 'ESV',
    referenceDisplayMode: 'full',
    isLoading: false,
    errors: {},
    hasUnsavedChanges: false
  });

  // Load current profile on mount
  useEffect(() => {
    loadCurrentProfile();
  }, [user]);

  const loadCurrentProfile = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      const profile = await db.user_profiles.where('user_id').equals(userId).first();
      
      if (profile) {
        setFormState(prev => ({
          ...prev,
          email: profile.email || '',
          fullName: profile.full_name || '',
          timezone: profile.timezone || 'UTC',
          preferredTranslation: profile.preferred_translation || 'ESV',
          referenceDisplayMode: profile.reference_display_mode as any || 'full',
          hasUnsavedChanges: false
        }));
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }, [getCurrentUserId]);

  const updateField = useCallback((field: string, value: string) => {
    setFormState(prev => ({
      ...prev,
      [field]: value,
      hasUnsavedChanges: true,
      errors: { ...prev.errors, [field]: '' } // Clear field error
    }));
  }, []);

  const saveProfile = useCallback(async () => {
    try {
      setFormState(prev => ({ ...prev, isLoading: true, errors: {} }));
      
      const userId = await getCurrentUserId();
      const updates: ProfileUpdateData = {
        email: formState.email || null,
        full_name: formState.fullName || null,
        timezone: formState.timezone,
        preferred_translation: formState.preferredTranslation,
        reference_display_mode: formState.referenceDisplayMode
      };

      const result = await dataService.updateUserProfile(userId, updates);
      
      setFormState(prev => ({
        ...prev,
        isLoading: false,
        hasUnsavedChanges: false
      }));

      return result;
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        isLoading: false,
        errors: { general: (error as Error).message }
      }));
      throw error;
    }
  }, [formState, getCurrentUserId]);

  return {
    formState,
    updateField,
    saveProfile,
    loadCurrentProfile
  };
}
```

### Integration Points
```yaml
DATA_SERVICE:
  - extend: "Add updateUserProfile with dual-write pattern"
  - preserve: "Existing syncUserProfile method"
  - integrate: "Use existing error handling and validation patterns"

COMPONENTS:
  - build: "Enhanced form components following existing Button patterns"
  - integrate: "Use existing design system colors and spacing"
  - enhance: "Add validation feedback similar to VerseReferenceInput"

CONTEXTS:
  - integrate: "Use existing AuthContext for user state"
  - utilize: "Leverage TimezoneContext for timezone defaults"
  - maintain: "Preserve existing authentication flow"

DATABASE:
  - enhance: "Improve userProfiles operations in localDb"
  - preserve: "Existing schema and transaction patterns"
  - extend: "Add validation and error handling"
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint                    # ESLint checks
npm run typecheck              # TypeScript compilation

# Expected: No errors. If errors exist, read error messages and fix before proceeding
```

### Level 2: Component Testing
```typescript
// CREATE src/pages/Settings/components/EnhancedInput.test.tsx
describe('EnhancedInput', () => {
  test('renders label and input correctly', () => {
    render(
      <EnhancedInput
        label="Email Address"
        value="test@example.com"
        onChange={jest.fn()}
      />
    );
    
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  test('displays error state correctly', () => {
    render(
      <EnhancedInput
        label="Email"
        value="invalid-email"
        onChange={jest.fn()}
        error="Please enter a valid email address"
      />
    );
    
    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
  });

  test('calls onChange when input value changes', async () => {
    const handleChange = jest.fn();
    render(
      <EnhancedInput
        label="Name"
        value=""
        onChange={handleChange}
      />
    );
    
    const input = screen.getByLabelText(/name/i);
    await user.type(input, 'John Doe');
    
    expect(handleChange).toHaveBeenCalledWith('J');
    expect(handleChange).toHaveBeenCalledWith('o');
    // ... etc
  });
});

// CREATE src/pages/Settings/hooks/useProfileUpdates.test.ts
describe('useProfileUpdates', () => {
  test('loads profile on mount', async () => {
    mockUserProfile({ email: 'test@example.com', full_name: 'Test User' });
    
    const { result } = renderHook(() => useProfileUpdates());
    
    await waitFor(() => {
      expect(result.current.formState.email).toBe('test@example.com');
      expect(result.current.formState.fullName).toBe('Test User');
    });
  });

  test('updates field values correctly', () => {
    const { result } = renderHook(() => useProfileUpdates());
    
    act(() => {
      result.current.updateField('email', 'new@example.com');
    });
    
    expect(result.current.formState.email).toBe('new@example.com');
    expect(result.current.formState.hasUnsavedChanges).toBe(true);
  });

  test('saves profile with dual-write pattern', async () => {
    const mockUpdate = jest.spyOn(dataService, 'updateUserProfile');
    mockUpdate.mockResolvedValue({ success: true, local: {}, remote: {}, errors: {} });
    
    const { result } = renderHook(() => useProfileUpdates());
    
    act(() => {
      result.current.updateField('email', 'updated@example.com');
    });
    
    await act(async () => {
      await result.current.saveProfile();
    });
    
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        email: 'updated@example.com'
      })
    );
    
    expect(result.current.formState.hasUnsavedChanges).toBe(false);
  });
});
```

```bash
# Run and iterate until passing:
npm test -- Settings
npm test -- useProfileUpdates
# If tests fail: Read error messages, fix issues, re-run
```

### Level 3: Integration Testing
```bash
# Start development server
npm run dev

# Test profile updates in browser:
# 1. Navigate to Settings page
# 2. Modify profile fields (email, name, timezone)
# 3. Save changes
# 4. Verify immediate UI update
# 5. Check browser DevTools -> IndexedDB for local updates
# 6. Check Network tab for remote sync request

# Expected behavior:
# - Immediate local updates (optimistic UI)
# - Background sync to remote
# - Success feedback on completion
# - Error handling for failed syncs
```

## Final Validation Checklist
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run typecheck`
- [ ] All editable profile fields are functional
- [ ] Form validation prevents invalid data
- [ ] Changes save locally immediately (IndexedDB)
- [ ] Remote sync occurs in background
- [ ] Loading states show during operations
- [ ] Success feedback confirms updates
- [ ] Error handling works for network failures
- [ ] Offline functionality maintained
- [ ] Consistent with existing design system
- [ ] Accessible with proper ARIA attributes

---

## Anti-Patterns to Avoid
- ❌ Don't break existing Settings page functionality (account creation, sign out)
- ❌ Don't skip local-first updates - users expect immediate feedback
- ❌ Don't ignore validation - prevent invalid profile data
- ❌ Don't forget loading states - users need feedback during operations
- ❌ Don't hardcode timezone lists - use standards-based approach
- ❌ Don't bypass dual-write pattern - maintain consistency with app architecture
- ❌ Don't skip accessibility features - ensure keyboard navigation and screen reader support

## Performance & UX Considerations
- ✅ Optimistic UI updates for immediate feedback
- ✅ Debounced validation to avoid excessive API calls
- ✅ Graceful degradation for offline usage
- ✅ Clear loading states and progress indicators
- ✅ Keyboard navigation and accessibility compliance
- ✅ Responsive design for all screen sizes
- ✅ Form auto-save or unsaved changes warning

**Confidence Score: 9/10** - Very high confidence due to comprehensive analysis of existing patterns, detailed component specifications following established design system, clear integration points with existing auth and data layers, and extensive validation gates that ensure quality implementation.