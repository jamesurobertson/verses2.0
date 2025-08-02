interface ButtonStylesProps {
  variant: 'primary' | 'secondary' | 'outline';
  size: 'small' | 'medium' | 'large';
  disabled: boolean;
}

export const buttonStyles = ({ variant, size, disabled }: ButtonStylesProps): string => {
  const baseStyles = [
    'inline-flex',
    'items-center',
    'justify-center',
    'font-medium',
    'rounded-lg',
    'transition-colors',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
    // Mobile-first: minimum 44px touch target
    'min-h-[44px]',
    'min-w-[44px]',
  ];

  const variantStyles = {
    primary: [
      'bg-blue-600',
      'text-white',
      'hover:bg-blue-700',
      'focus:ring-blue-500',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
    ],
    secondary: [
      'bg-gray-200',
      'text-gray-900',
      'hover:bg-gray-300',
      'focus:ring-gray-500',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
    ],
    outline: [
      'border',
      'border-gray-300',
      'bg-white',
      'text-gray-700',
      'hover:bg-gray-50',
      'focus:ring-blue-500',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
    ],
  };

  const sizeStyles = {
    small: ['px-3', 'py-1.5', 'text-sm'],
    medium: ['px-4', 'py-2', 'text-base'],
    large: ['px-6', 'py-3', 'text-lg'],
  };

  const allStyles = [
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
  ].filter(Boolean);

  return allStyles.join(' ') + ` ${variant}`;
};