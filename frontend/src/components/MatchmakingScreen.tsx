import { useNakama } from '../context/NakamaContext';

export function MatchmakingScreen() {
  const { cancelMatchmaking } = useNakama();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="flex flex-col items-center gap-8">
        <div className="animate-fade-up flex flex-col items-center gap-3">
          <h2 className="font-display text-2xl font-700 letter-tight text-txt-primary">
            Searching
          </h2>
          <p className="text-sm text-txt-muted">
            Looking for an opponent...
          </p>
        </div>

        {/* Animated dots */}
        <div className="animate-fade-up-d1 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: '200ms' }} />
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: '400ms' }} />
        </div>

        <button
          onClick={cancelMatchmaking}
          className="animate-fade-up-d2 px-6 py-2.5 text-sm font-medium text-txt-muted border border-border rounded-md transition-all duration-150 hover:text-txt-secondary hover:border-border-strong active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
