/**
 * Shared empty state component
 */
interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: string;
}

export function EmptyState({ 
  title, 
  description, 
  actionText, 
  actionHref, 
  onAction, 
  icon = "📚" 
}: EmptyStateProps) {
  const ActionComponent = actionHref ? 'a' : 'button';
  
  return (
    <div className="bg-background border border-primary/10 rounded-xl p-12 text-center shadow-sm">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-primary font-medium mb-3 text-lg">{title}</h3>
      <p className="text-primary/70 mb-8 max-w-md mx-auto">
        {description}
      </p>
      {(actionText && (actionHref || onAction)) && (
        <ActionComponent
          href={actionHref}
          onClick={onAction}
          className="inline-flex items-center px-6 py-3 bg-accent border border-primary/20 rounded-xl hover:bg-accent/90 font-medium transition-colors"
        >
          {actionText}
        </ActionComponent>
      )}
    </div>
  );
}