/**
 * Auth Helper Utilities
 * Utilities to help resolve auth timeout and initialization issues
 */

/**
 * Clear all auth-related browser storage to resolve timeout issues
 */
export function clearAuthStorage(): void {
  try {
    // Clear localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('auth') || key.includes('rocket'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('auth') || key.includes('rocket'))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

    console.log('✅ Cleared auth storage to resolve timeout issues');
  } catch (error) {
    console.warn('Could not clear auth storage:', error);
  }
}

/**
 * Reset auth state and reload page to fix timeout issues
 */
export function resetAuthState(): void {
  clearAuthStorage();
  
  // Force reload the page to get fresh auth state
  setTimeout(() => {
    window.location.reload();
  }, 100);
}

/**
 * Check if we're experiencing auth timeout issues
 */
export function detectAuthTimeout(): boolean {
  const now = Date.now();
  const lastAuthAttempt = localStorage.getItem('last-auth-attempt');
  
  if (lastAuthAttempt) {
    const timeSinceLastAttempt = now - parseInt(lastAuthAttempt);
    // If more than 10 seconds since last auth attempt, likely a timeout
    return timeSinceLastAttempt > 10000;
  }
  
  return false;
}

/**
 * Mark auth attempt timestamp
 */
export function markAuthAttempt(): void {
  localStorage.setItem('last-auth-attempt', Date.now().toString());
}

/**
 * Auto-recovery for auth timeouts
 */
export function autoRecoverFromAuthTimeout(): void {
  if (detectAuthTimeout()) {
    console.warn('🔄 Auto-recovering from auth timeout...');
    resetAuthState();
  }
} 