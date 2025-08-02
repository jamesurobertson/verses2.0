interface SvgStylesProps {
  variant: 'primary' | 'secondary' | 'outline';
  size: 'small' | 'medium' | 'large';
  disabled: boolean;
}

export const svgStrokeStyles = ({ variant, size, disabled }: SvgStylesProps): string => {
  const baseStyles = [
    'stroke-current',      // Use current text color for stroke
    'fill-none',
    'transition-colors',
  ];

  const variantStyles = {
    primary: [
      'text-accent',       // stroke color via currentColor
      disabled ? 'opacity-50' : 'opacity-100',
    ],
    secondary: [
      'text-primary',
      disabled ? 'opacity-50' : 'opacity-100',
    ],
    outline: [
      'text-primary/60',
      disabled ? 'opacity-30' : 'opacity-100',
    ],
  };

  const sizeStyles = {
    small: ['stroke-[1.5]'],  // stroke width 1.5px
    medium: ['stroke-[2]'],
    large: ['stroke-[3]'],
  };

  const allStyles = [
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
  ].filter(Boolean);

  return allStyles.join(' ');
};
