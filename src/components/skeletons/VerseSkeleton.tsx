import React from 'react';

interface VerseSkeletonProps {
  className?: string;
  showTitle?: boolean;
}

export const VerseSkeleton: React.FC<VerseSkeletonProps> = ({
  className = '',
  showTitle = true
}) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {showTitle && (
        <div className="h-6 bg-gray-200 rounded-md w-1/3 mb-4"></div>
      )}
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/5"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    </div>
  );
};