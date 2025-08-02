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
      'bg-accent',
      'text-white',
      'hover:bg-accent/90',
      'focus:ring-accent',
      'font-roboto',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
    ],
    secondary: [
      'bg-primary/10',
      'text-primary',
      'hover:bg-primary/20',
      'focus:ring-primary',
      'font-roboto',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
    ],
    outline: [
      'border',
      'border-primary/20',
      'bg-background',
      'text-primary',
      'hover:bg-primary/5',
      'focus:ring-accent',
      'font-roboto',
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