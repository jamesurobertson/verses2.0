import { NavLink } from 'react-router-dom';

/**
 * Mobile-first bottom navigation component.
 * Provides quick access to main app sections with touch-friendly design.
 */
export function MobileNavigation() {
  const navItems = [
    {
      path: '/review',
      label: 'Review',
      icon: (isActive: boolean) => (
        <svg className={`w-6 h-6 ${isActive ? 'text-yellow-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      path: '/library',
      label: 'Library',
      icon: (isActive: boolean) => (
        <svg className={`w-6 h-6 ${isActive ? 'text-yellow-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      path: '/add',
      label: 'Add',
      icon: (isActive: boolean) => (
        <svg className={`w-6 h-6 ${isActive ? 'text-yellow-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
        </svg>
      ),
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: (isActive: boolean) => (
        <svg className={`w-6 h-6 ${isActive ? 'text-yellow-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <nav 
      role="navigation" 
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200"
      aria-label="Main navigation"
    >
      <div className="flex justify-center space-x-12 py-2 px-6">
        {navItems.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            className="p-2 flex flex-col items-center space-y-1"
          >
            {({ isActive }) => (
              <>
                {icon(isActive)}
                <span className={`text-xs ${isActive ? 'text-yellow-500' : 'text-gray-400'}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}