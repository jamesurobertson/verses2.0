import React from 'react';
import { buttonStyles } from './Button.styles';

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  'data-testid'?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  'data-testid': testId,
  ...rest
}) => {
  const styles = buttonStyles({ variant, size, disabled });
  const combinedClassName = `${styles} ${className}`.trim();

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={combinedClassName}
      data-testid={testId}
      {...rest}
    >
      {children}
    </button>
  );
};