/**
 * Shared error card component
 */
interface ErrorCardProps {
  title: string;
  message: string;
  onRetry?: () => void;
  retryText?: string;
}

export function ErrorCard({ title, message, onRetry, retryText = "Retry" }: ErrorCardProps) {
  return (
    <div className="bg-background border border-error/30 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-error font-medium">{title}</h3>
          <p className="text-error/80 text-sm mt-1">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors font-medium"
          >
            {retryText}
          </button>
        )}
      </div>
    </div>
  );
}