import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProgressBarProps {
  progress: number;
  message: string;
  isActive: boolean;
}

export function ProgressBar({ progress, message, isActive }: ProgressBarProps) {
  if (!isActive) return null;

  return (
    <div className="p-4 bg-sage-light rounded-lg border border-forest-light/30 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="w-4 h-4 animate-spin text-forest-light" />
        <span className="text-sm font-medium text-forest-dark">{message}</span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-muted-foreground text-center mt-2">{progress}%</p>
    </div>
  );
}
