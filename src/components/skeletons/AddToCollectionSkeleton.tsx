import React from 'react';
import { useNavigate } from 'react-router-dom';

interface AddToCollectionSkeletonProps {
  className?: string;
}

export const AddToCollectionSkeleton: React.FC<AddToCollectionSkeletonProps> = ({
  className = ''
}) => {
  const navigate = useNavigate();
  
  return (
    <div className={`min-h-screen bg-background p-4 ${className}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header with Back Button - REAL, not skeleton */}
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
          {/* Reference title */}
          <div className="h-8 bg-gray-200 rounded-md w-1/2 mx-auto mb-4 animate-pulse"></div>
          
          {/* Verse card */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-8 animate-pulse">
            <div className="max-h-48">
              <div className="space-y-3">
                <div className="h-5 bg-gray-200 rounded w-full"></div>
                <div className="h-5 bg-gray-200 rounded w-5/6 mx-auto"></div>
                <div className="h-5 bg-gray-200 rounded w-4/5 mx-auto"></div>
                <div className="h-5 bg-gray-200 rounded w-full"></div>
                <div className="h-5 bg-gray-200 rounded w-3/4 mx-auto"></div>
              </div>
            </div>
            {/* Translation label */}
            <div className="h-4 bg-gray-200 rounded w-12 mx-auto mt-4"></div>
          </div>

          {/* Description text */}
          <div className="mb-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>

          {/* Add button */}
          <div className="h-12 bg-gray-200 rounded-lg w-48 mx-auto animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};