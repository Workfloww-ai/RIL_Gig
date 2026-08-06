import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ButtonProps = {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  children?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-[8px] px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary: 'bg-brand-blue text-white hover:bg-blue-700',
    secondary: 'bg-brand-purple-light text-brand-purple hover:bg-purple-200',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 bg-white',
    text: 'text-brand-blue hover:underline bg-transparent px-0 py-0',
  };

  return <button className={cn(baseStyles, variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-white rounded-[8px] border border-slate-200 shadow-sm overflow-hidden', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

export function Badge({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'purple', className?: string }) {
  const base = 'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium';
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    purple: 'bg-brand-purple-light text-brand-purple',
  };
  return <span className={cn(base, variants[variant], className)}>{children}</span>;
}
