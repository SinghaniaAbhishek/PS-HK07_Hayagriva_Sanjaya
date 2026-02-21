import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ className = 'h-8 w-8' }: { className?: string }) => (
  <Loader2 className={`animate-spin text-primary ${className}`} />
);

export const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <LoadingSpinner className="h-12 w-12" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);
