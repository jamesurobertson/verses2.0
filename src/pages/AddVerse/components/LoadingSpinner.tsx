import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  className?: string;
  'data-testid'?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  message,
  className = '',
  'data-testid': testId,
}) => {
  // Size variants
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return 'w-4 h-4';
      case 'large':
        return 'w-12 h-12';
      case 'medium':
      default:
        return 'w-8 h-8';
    }
  };

  const getContainerStyles = () => {
    switch (size) {
      case 'small':
        return 'gap-2 text-sm';
      case 'large':
        return 'gap-4 text-lg';
      case 'medium':
      default:
        return 'gap-3 text-base';
    }
  };

  const spinnerStyles = `${getSizeStyles()} border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin`;
  const containerStyles = `flex items-center justify-center ${getContainerStyles()} ${className}`.trim();

  return (
    <div className={containerStyles} data-testid={testId} role="status" aria-live="polite">
      <div className={spinnerStyles} aria-hidden="true"></div>
      {message && (
        <span className="text-gray-600">
          {message}
        </span>
      )}
      <span className="sr-only">
        {message || 'Loading...'}
      </span>
    </div>
  );
};