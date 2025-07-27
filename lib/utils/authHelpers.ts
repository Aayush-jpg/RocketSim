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

/**
 * Manage session storage for better chat experience
 */
export function cleanupOldSessions(): void {
  try {
    // Clean up old chat scroll positions (keep only last 5 projects)
    const keys = Object.keys(sessionStorage);
    const chatScrollKeys = keys.filter(key => key.startsWith('chat-scroll-'));
    
    if (chatScrollKeys.length > 5) {
      // Sort by last access (rough estimate) and keep most recent
      chatScrollKeys.sort().slice(0, -5).forEach(key => {
        sessionStorage.removeItem(key);
      });
    }
    
    // Clean up very old localStorage auth tokens (older than 7 days)
    const authKeys = keys.filter(key => key.includes('supabase') || key.includes('rocket-auth'));
    authKeys.forEach(key => {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed.expires_at) {
            const expiresAt = new Date(parsed.expires_at * 1000);
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            if (expiresAt < weekAgo) {
              localStorage.removeItem(key);
            }
          }
        }
      } catch (e) {
        // Invalid JSON, remove it
        localStorage.removeItem(key);
      }
    });
    
    console.log('✅ Cleaned up old session data');
  } catch (error) {
    console.warn('Could not cleanup old sessions:', error);
  }
}

/**
 * Initialize session management on app start
 */
export function initializeSessionManagement(): void {
  // Clean up old sessions on app start
  cleanupOldSessions();
  
  // Set up periodic cleanup (every 30 minutes)
  if (typeof window !== 'undefined') {
    setInterval(cleanupOldSessions, 30 * 60 * 1000);
  }
} 