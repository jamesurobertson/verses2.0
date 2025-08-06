import React, { useEffect, useRef } from 'react';

export interface VerseReferenceInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidation: (value: string) => Promise<boolean>;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  isValidating?: boolean;
  showManualEntry?: boolean;
  validationError?: string | null;
  'data-testid'?: string;
}

export const VerseReferenceInput: React.FC<VerseReferenceInputProps> = ({
  value,
  onChange,
  onValidation,
  disabled = false,
  className = '',
  placeholder = 'Enter a Bible reference (e.g., John 3:16)',
  isValidating = false,
  validationError = null,
  showManualEntry = false,
  'data-testid': testId,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle input change and trigger validation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Trigger validation after a brief delay
    if (newValue.trim()) {
      onValidation(newValue);
    }
  };

  // Handle Enter key submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Trigger form submission via parent component
      const form = inputRef.current?.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  };

  // Dynamic styling based on validation state using design system colors
  const getInputStyles = () => {
    const baseStyles = 'w-full px-4 py-4 text-lg border rounded-lg focus:outline-none focus:ring-2 transition-colors font-roboto bg-white';

    if (validationError) {
      return `${baseStyles} border-error focus:border-error focus:ring-error/20 bg-error/5 text-primary`;
    } else if (value.trim() && !isValidating && !validationError) {
      return `${baseStyles} border-success focus:border-success focus:ring-success/20 bg-success/5 text-primary`;
    } else {
      return `${baseStyles} border-primary/20 focus:border-accent focus:ring-accent/20 text-primary`;
    }
  };

  const combinedClassName = `${getInputStyles()} ${className}`.trim();

  return (
    <div className="relative">
      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={combinedClassName}
        data-testid={testId}
        autoComplete="off"
        spellCheck="false"
      />

      {/* Validation indicator */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
        {isValidating && (
          <div className="w-5 h-5">
            <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
          </div>
        )}
        {!isValidating && value.trim() && !validationError && (
          <div className="w-5 h-5 text-success">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        {!isValidating && validationError && (
          <div className="w-5 h-5 text-error">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Error message */}
      {validationError && (
        <p className="mt-3 text-sm text-error font-medium" role="alert">
          {validationError}
        </p>
      )}

      {/* Helper text */}
      {showManualEntry && (
        <p className="mt-3 text-sm text-red-800">
          You seem to be offline, please reconnect or enter the verse text manually.
        </p>
      )}
    </div>
  );
};