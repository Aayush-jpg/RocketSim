"use client"

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/lib/auth/AuthContext'
import NotificationSystem from '@/components/ui/NotificationSystem'

// Dynamically import panels to reduce initial load time
const LeftPanel = dynamic(() => import('@/components/panels/LeftPanel'))
const MiddlePanel = dynamic(() => import('@/components/panels/MiddlePanel'))

export default function RocketSim() {
  const { user, userSession } = useAuth();
  
  // Panel sizing state (responsive defaults based on screen size)
  const [leftPanelWidth, setLeftPanelWidth] = useState(20)
  
  // Panel collapse state
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)
  
  // Window size state for responsive calculations
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  
  // Responsive width calculations
  const getResponsiveConstraints = () => {
    const screenWidth = windowSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1024);
    if (screenWidth < 768) { // Mobile
      return { minLeft: 280, maxLeft: 320 };
    } else if (screenWidth < 1024) { // Tablet
      return { minLeft: 300, maxLeft: 400 };
    } else { // Desktop
      return { minLeft: 320, maxLeft: 480 };
    }
  };
  
  // Calculate middle panel width based on collapsed states and fixed panel sizes
  const middlePanelWidth = useMemo(() => {
    const constraints = getResponsiveConstraints();
    const leftWidth = isLeftPanelCollapsed ? 64 : constraints.minLeft; // 64px when collapsed, minLeft when expanded
    
    const screenWidth = windowSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1024);
    const availableWidth = screenWidth - leftWidth;
    return Math.max(400, availableWidth); // Ensure minimum 400px for middle panel with integrated tabs
  }, [isLeftPanelCollapsed, windowSize]);
  
  // Handle resize of panels with responsive constraints
  const handleLeftDividerDrag = (delta: number) => {
    const constraints = getResponsiveConstraints();
    const currentWidthPx = isLeftPanelCollapsed ? 64 : constraints.minLeft;
    const deltaPercent = (delta / (windowSize.width || 1024)) * 100;
    const newWidthPx = Math.max(constraints.minLeft, Math.min(constraints.maxLeft, currentWidthPx + delta));
    
    // Update the actual left panel width constraint
    setLeftPanelWidth(newWidthPx);
  }
  

  
  // Implement divider drag functionality
  const startLeftDividerDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const startX = e.clientX;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      handleLeftDividerDrag(deltaX);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  

  
  // Toggle panel functions with keyboard shortcut support
  const toggleLeftPanel = () => setIsLeftPanelCollapsed(!isLeftPanelCollapsed);
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch(e.key) {
        case '1':
          toggleLeftPanel();
          break;
        case '2':
          // Toggle left panel to focus on middle (simplified from both panels)
          toggleLeftPanel();
          break;
        case 'f':
          if (e.shiftKey) {
            // Toggle fullscreen with Cmd+Shift+F
            setIsLeftPanelCollapsed(!isLeftPanelCollapsed);
          }
          break;
        default:
          break;
      }
    } else if (e.key === 'F11') {
      // Toggle fullscreen with F11
      e.preventDefault();
      setIsLeftPanelCollapsed(!isLeftPanelCollapsed);
    }
  }

  // Toggle full screen
  const toggleFullScreen = () => {
    setIsLeftPanelCollapsed(!isLeftPanelCollapsed);
  }

  // Add tooltips for first-time users
  const [showTooltips, setShowTooltips] = useState(false);
  
  const [loadChatSessionId, setLoadChatSessionId] = useState<string | null>(null); // Add state for loading specific chat sessions
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null); // Add state for project-specific conversations

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    // Set initial size
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle chat session loading
  const handleChatSessionClick = (sessionId: string) => {
    setLoadChatSessionId(sessionId);
    setCurrentProjectId(null); // Clear project-specific mode when loading a specific session
  };

  const handleChatSessionLoad = (sessionId: string | null) => {
    setLoadChatSessionId(sessionId);
  };

  // Handle project clicks - load project-specific conversations
  const handleProjectClick = (projectId: string) => {
    setCurrentProjectId(projectId);
    setLoadChatSessionId(null); // Clear session-specific mode when loading project conversations
  };

  useEffect(() => {
    // Hide tooltips after 5 seconds
    const timer = setTimeout(() => {
      setShowTooltips(false);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <ProtectedRoute>
      <main 
        className="flex h-screen w-screen overflow-hidden bg-black bg-opacity-90"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Left Panel */}
        {!isLeftPanelCollapsed && (
          <motion.div
            className="h-full relative flex-shrink-0"
            initial={{ width: getResponsiveConstraints().minLeft }}
            animate={{ width: leftPanelWidth > 64 ? leftPanelWidth : getResponsiveConstraints().minLeft }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <LeftPanel 
              isCollapsed={isLeftPanelCollapsed} 
              onCollapse={toggleLeftPanel}
              onProjectClick={handleProjectClick}
              width={leftPanelWidth > 64 ? leftPanelWidth : getResponsiveConstraints().minLeft}
            />
            
            {/* Tooltip for left panel */}
            {showTooltips && (
              <div className="absolute top-16 right-4 bg-black bg-opacity-80 text-white text-xs p-2 rounded shadow-lg pointer-events-none">
                Cmd+1 to toggle
              </div>
            )}
          </motion.div>
        )}
        
        {/* Collapsed Left Panel - Show minimal expand button */}
        {isLeftPanelCollapsed && (
          <motion.div
            className="h-full relative flex-shrink-0"
            initial={{ width: 64 }}
            animate={{ width: 64 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <LeftPanel 
              isCollapsed={isLeftPanelCollapsed} 
              onCollapse={toggleLeftPanel}
              onProjectClick={handleProjectClick}
              width={64}
            />
          </motion.div>
        )}
        
        {/* Left Panel Divider - only show when not collapsed */}
        {!isLeftPanelCollapsed && (
          <div 
            className="panel-divider-v relative z-10 cursor-col-resize flex-shrink-0 w-1"
            onMouseDown={startLeftDividerDrag}
          >
            <div className="absolute inset-0 w-3 -translate-x-1/2 hover:bg-cyan-500 hover:bg-opacity-20" />
          </div>
        )}
        
        {/* Middle Panel - 3D Visualization */}
        <motion.div
          className="h-full relative flex-1 min-w-0"
          style={{ minWidth: 300 }}
        >
          <MiddlePanel 
            isMobile={windowSize.width < 768} 
            isSmallDesktop={middlePanelWidth < 500} 
            isFullScreen={isLeftPanelCollapsed}
            loadSessionId={loadChatSessionId}
            onChatSessionLoad={handleChatSessionLoad}
            projectId={currentProjectId}
          />
          
          {/* Mobile Panel Toggle Buttons */}
          {windowSize.width < 768 && (
            <>
              {/* Left Panel Toggle - show when collapsed */}
              {isLeftPanelCollapsed && (
                <motion.button
                  className="absolute top-4 left-4 z-[100] p-3 rounded-full bg-black/80 backdrop-blur-sm text-white shadow-lg hover:bg-black/90 transition-all border border-white/20"
                  onClick={toggleLeftPanel}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h18"></path>
                    <path d="M3 6h18"></path>
                    <path d="M3 18h18"></path>
                  </svg>
                </motion.button>
              )}

            </>
          )}
          
          {/* Tooltip for middle panel full screen */}
          {showTooltips && (
            <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white text-xs p-2 rounded shadow-lg pointer-events-none">
              Cmd+2 to toggle fullscreen
            </div>
          )}
        </motion.div>
        

        
        {/* Floating exit fullscreen button - only show when left panel collapsed */}
        {isLeftPanelCollapsed && (
          <motion.button
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-full 
                       bg-black bg-opacity-40 backdrop-blur-sm text-white text-sm flex items-center space-x-2
                       border border-white border-opacity-20 shadow-lg hover:bg-opacity-60 transition-all"
            onClick={toggleFullScreen}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3"></path>
              <path d="M21 8h-3a2 2 0 0 1-2-2V3"></path>
              <path d="M3 16h3a2 2 0 0 1 2 2v3"></path>
              <path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>
            </svg>
            <span>Exit Fullscreen</span>
          </motion.button>
        )}
        
        {/* Notification System */}
        <NotificationSystem />
      </main>
    </ProtectedRoute>
  )
} 