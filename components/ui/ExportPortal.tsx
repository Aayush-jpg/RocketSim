/**
 * Export Portal Component
 * 
 * Renders the export panel at the root level of the document
 * to ensure it's not constrained by parent containers.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ExportPortalProps {
  children: React.ReactNode;
  isOpen: boolean;
}

export function ExportPortal({ children, isOpen }: ExportPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !isOpen) {
    return null;
  }

  // Create portal to document.body
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl max-h-[70vh] overflow-y-auto glass-panel rounded-xl p-5 border border-white/20 bg-black/80 shadow-2xl">
        {children}
      </div>
    </div>,
    document.body
  );
}
