/**
 * Shared card component for consistent styling
 */
interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className = "", title }: CardProps) {
  return (
    <div className={`bg-background border border-primary/10 rounded-xl p-6 shadow-sm ${className}`}>
      {title && <h2 className="text-lg font-semibold text-primary mb-4">{title}</h2>}
      {children}
    </div>
  );
}