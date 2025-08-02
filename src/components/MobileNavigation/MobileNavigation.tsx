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
      icon: '📚', // Will be replaced with proper icons later
    },
    {
      path: '/library',
      label: 'Library',
      icon: '📖',
    },
    {
      path: '/add',
      label: 'Add',
      icon: '➕',
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: '⚙️',
    },
  ];

  return (
    <nav 
      role="navigation" 
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden"
      aria-label="Main navigation"
    >
      <div className="flex">
        {navItems.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors duration-200 ${
                isActive
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`
            }
            style={{ minHeight: '60px' }} // Ensures 44px+ touch target
          >
            <span className="text-xl mb-1">{icon}</span>
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}