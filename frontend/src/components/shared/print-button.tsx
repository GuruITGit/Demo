'use client';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onClick: () => void;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default';
  disabled?: boolean;
}

export function PrintButton({ onClick, label = 'พิมพ์ / PDF', variant = 'outline', size = 'default', disabled }: Props) {
  return (
    <Button variant={variant} size={size} onClick={onClick} disabled={disabled} aria-label={label}>
      <Printer className="h-4 w-4 mr-1.5" aria-hidden />
      {label}
    </Button>
  );
}
