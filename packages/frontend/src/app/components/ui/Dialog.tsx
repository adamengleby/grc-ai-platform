import React, { createContext, useContext, useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, setOpen]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange: setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

interface DialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DialogTrigger({ children, asChild }: DialogTriggerProps) {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('DialogTrigger must be used within a Dialog');
  }

  const { onOpenChange } = context;

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: () => onOpenChange(true)
    });
  }

  return (
    <div onClick={() => onOpenChange(true)} className="cursor-pointer">
      {children}
    </div>
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  showClose?: boolean;
}

export function DialogContent({ children, className = '', showClose = true }: DialogContentProps) {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('DialogContent must be used within a Dialog');
  }

  const { open, onOpenChange } = context;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Content */}
      <div 
        className={`
          relative bg-white rounded-lg shadow-xl border border-gray-200 
          w-full max-w-lg mx-4 sm:mx-6 md:mx-8 lg:mx-12 xl:mx-auto max-h-[95vh] 
          animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button
            className="absolute right-4 sm:right-6 lg:right-8 top-4 sm:top-6 p-1 rounded-sm opacity-70 hover:opacity-100 transition-opacity z-10"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogHeader({ children, className = '' }: DialogHeaderProps) {
  return (
    <div className={`px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogTitle({ children, className = '' }: DialogTitleProps) {
  return (
    <h2 className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </h2>
  );
}

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogDescription({ children, className = '' }: DialogDescriptionProps) {
  return (
    <p className={`text-sm text-gray-600 mt-1 ${className}`}>
      {children}
    </p>
  );
}

interface DialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogBody({ children, className = '' }: DialogBodyProps) {
  return (
    <div className={`px-4 sm:px-6 lg:px-8 py-4 sm:py-6 ${className}`}>
      {children}
    </div>
  );
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogFooter({ children, className = '' }: DialogFooterProps) {
  return (
    <div className={`px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border-t border-gray-200 bg-white ${className}`}>
      {children}
    </div>
  );
}

// Components are already exported above individually