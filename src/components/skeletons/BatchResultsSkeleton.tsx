import React from 'react';

interface BatchResultsSkeletonProps {
  className?: string;
  cardCount?: number;
}

export const BatchResultsSkeleton: React.FC<BatchResultsSkeletonProps> = ({
  className = '',
  cardCount = 3
}) => {
  return (
    <div className={`max-w-2xl ${className}`}>
      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6 animate-pulse">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4"></div>
          <div className="h-8 bg-gray-200 rounded-md w-1/2 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
        </div>

        {/* Verse Cards */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {Array.from({ length: cardCount }).map((_, index) => (
            <div
              key={index}
              className="bg-gray-50 border border-gray-100 rounded-lg p-4"
            >
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                <div className="h-3 bg-gray-200 rounded w-4/5"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
          <div className="h-10 bg-gray-200 rounded-md flex-1"></div>
          <div className="h-10 bg-gray-200 rounded-md flex-1"></div>
          <div className="h-10 bg-gray-200 rounded-md flex-1"></div>
        </div>
      </div>
    </div>
  );
};