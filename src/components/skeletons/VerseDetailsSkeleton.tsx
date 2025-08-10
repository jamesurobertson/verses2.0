import React from 'react';
import { useNavigate } from 'react-router-dom';

interface VerseDetailsSkeletonProps {
  className?: string;
}

export const VerseDetailsSkeleton: React.FC<VerseDetailsSkeletonProps> = ({
  className = ''
}) => {
  const navigate = useNavigate();
  
  return (
    <div className={`min-h-screen bg-background ${className}`}>
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-8 sm:px-6 lg:px-8">
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
          
          {/* Delete button skeleton */}
          <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>

        {/* Verse Reference and Text */}
        <div className="mb-8">
          {/* Reference title */}
          <div className="h-9 bg-gray-200 rounded-md w-1/3 mb-4 animate-pulse"></div>
          
          {/* Verse card */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm animate-pulse">
            <div className="max-h-48">
              <div className="space-y-3">
                <div className="h-5 bg-gray-200 rounded w-full"></div>
                <div className="h-5 bg-gray-200 rounded w-5/6"></div>
                <div className="h-5 bg-gray-200 rounded w-4/5"></div>
                <div className="h-5 bg-gray-200 rounded w-full"></div>
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
            {/* Translation label */}
            <div className="h-4 bg-gray-200 rounded w-12 mt-4"></div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Phase Information Card */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm animate-pulse">
            {/* Card title */}
            <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
            
            <div className="space-y-4">
              {/* Current Phase row */}
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-8 bg-gray-200 rounded w-24"></div>
              </div>
              
              {/* Progress Count row */}
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-2/5"></div>
                <div className="h-5 bg-gray-200 rounded w-8"></div>
              </div>
              
              {/* Assignment row */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-5 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Information Card */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm animate-pulse">
            {/* Card title */}
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
            
            <div className="space-y-3">
              {/* Current Streak */}
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-2/5"></div>
                <div className="h-5 bg-gray-200 rounded w-16"></div>
              </div>
              
              {/* Best Streak */}
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-5 bg-gray-200 rounded w-16"></div>
              </div>
              
              {/* Next Due */}
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-5 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
          </div>

          {/* Review History Card */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm animate-pulse">
            {/* Card title */}
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
            
            <div className="space-y-3">
              {/* Last Reviewed */}
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-2/5"></div>
                <div className="h-5 bg-gray-200 rounded w-24"></div>
              </div>
              
              {/* Added */}
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-5 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};