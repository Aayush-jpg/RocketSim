"use client"

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import NotificationSystem from '@/components/ui/NotificationSystem'

// Dynamically import panels to reduce initial load time
const LeftPanel = dynamic(() => import('@/components/panels/LeftPanel'))
const MiddlePanel = dynamic(() => import('@/components/panels/MiddlePanel'))
const RightPanel = dynamic(() => import('@/components/panels/RightPanel'))

export default function RocketSim() {
  // Panel sizing state (default widths in percentages)
  const [leftPanelWidth, setLeftPanelWidth] = useState(20)
  const [rightPanelWidth, setRightPanelWidth] = useState(30)
  
  // Panel collapse state
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false)
  
  // Calculate middle panel width based on collapsed states
  const middlePanelWidth = useMemo(() => {
    if (isLeftPanelCollapsed && isRightPanelCollapsed) {
      return 100; // Full width when both panels are collapsed
    } else if (isLeftPanelCollapsed) {
      return 100 - rightPanelWidth; // Only right panel visible
    } else if (isRightPanelCollapsed) {
      return 100 - leftPanelWidth; // Only left panel visible
    } else {
      return 100 - leftPanelWidth - rightPanelWidth; // Both panels visible
    }
  }, [isLeftPanelCollapsed, isRightPanelCollapsed, leftPanelWidth, rightPanelWidth]);
  
  // Handle resize of panels
  const handleLeftDividerDrag = (delta: number) => {
    const newLeftWidth = Math.max(10, Math.min(30, leftPanelWidth + delta))
    setLeftPanelWidth(newLeftWidth)
  }
  
  const handleRightDividerDrag = (delta: number) => {
    const newRightWidth = Math.max(20, Math.min(40, rightPanelWidth - delta))
    setRightPanelWidth(newRightWidth)
  }
  
  // Implement divider drag functionality
  const startLeftDividerDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const startX = e.clientX;
    const startLeftWidth = leftPanelWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / window.innerWidth) * 100;
      const newWidth = Math.max(10, Math.min(30, startLeftWidth + deltaPercent));
      setLeftPanelWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const startRightDividerDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const startX = e.clientX;
    const startRightWidth = rightPanelWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / window.innerWidth) * 100;
      const newWidth = Math.max(20, Math.min(40, startRightWidth - deltaPercent));
      setRightPanelWidth(newWidth);
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
  const toggleRightPanel = () => setIsRightPanelCollapsed(!isRightPanelCollapsed);
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch(e.key) {
        case '1':
          toggleLeftPanel();
          break;
        case '2':
          // Toggle both panels to focus on middle
          const allCollapsed = isLeftPanelCollapsed && isRightPanelCollapsed;
          const allExpanded = !isLeftPanelCollapsed && !isRightPanelCollapsed;
          
          if (allCollapsed || allExpanded) {
            // Toggle between all collapsed and all expanded
            setIsLeftPanelCollapsed(!allCollapsed);
            setIsRightPanelCollapsed(!allCollapsed);
          } else {
            // If in mixed state, collapse all to focus on middle
            setIsLeftPanelCollapsed(true);
            setIsRightPanelCollapsed(true);
          }
          break;
        case '3':
          toggleRightPanel();
          break;
        case 'f':
          if (e.shiftKey) {
            // Toggle fullscreen with Cmd+Shift+F
            const allCollapsed = isLeftPanelCollapsed && isRightPanelCollapsed;
            setIsLeftPanelCollapsed(!allCollapsed);
            setIsRightPanelCollapsed(!allCollapsed);
          }
          break;
        default:
          break;
      }
    } else if (e.key === 'F11') {
      // Toggle fullscreen with F11
      e.preventDefault();
      const allCollapsed = isLeftPanelCollapsed && isRightPanelCollapsed;
      setIsLeftPanelCollapsed(!allCollapsed);
      setIsRightPanelCollapsed(!allCollapsed);
    }
  }

  // Toggle full screen
  const toggleFullScreen = () => {
    const allCollapsed = isLeftPanelCollapsed && isRightPanelCollapsed;
    setIsLeftPanelCollapsed(!allCollapsed);
    setIsRightPanelCollapsed(!allCollapsed);
  }

  // Add tooltips for first-time users
  const [showTooltips, setShowTooltips] = useState(true);
  
  useEffect(() => {
    // Hide tooltips after 5 seconds
    const timer = setTimeout(() => {
      setShowTooltips(false);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <main 
      className="flex h-screen w-screen overflow-hidden bg-black bg-opacity-90"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Left Panel - File & Settings */}
      <motion.div
        className="h-full relative"
        initial={{ width: `${leftPanelWidth}%` }}
        animate={{ 
          width: isLeftPanelCollapsed ? '60px' : `${leftPanelWidth}%`
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <LeftPanel 
          onCollapse={toggleLeftPanel} 
          isCollapsed={isLeftPanelCollapsed}
        />
        
        {/* Tooltip for left panel collapse */}
        {showTooltips && !isLeftPanelCollapsed && (
          <div className="absolute top-16 right-6 bg-black bg-opacity-80 text-white text-xs p-2 rounded shadow-lg pointer-events-none">
            Cmd+1 to toggle
          </div>
        )}
      </motion.div>
      
      {/* Left Panel Divider - only show when not collapsed */}
      {!isLeftPanelCollapsed && (
        <div 
          className="panel-divider-v relative z-10 cursor-col-resize"
          onMouseDown={startLeftDividerDrag}
        >
          <div className="absolute inset-0 w-3 -translate-x-1/2 hover:bg-cyan-500 hover:bg-opacity-20" />
        </div>
      )}
      
      {/* Middle Panel - 3D Visualization */}
      <motion.div
        className="h-full relative"
        initial={{ width: `${middlePanelWidth}%` }}
        animate={{ width: `${middlePanelWidth}%` }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <MiddlePanel 
          isMobile={false} 
          isSmallDesktop={middlePanelWidth < 40} 
          isFullScreen={isLeftPanelCollapsed && isRightPanelCollapsed}
        />
        
        {/* Tooltip for middle panel full screen */}
        {showTooltips && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white text-xs p-2 rounded shadow-lg pointer-events-none">
            Cmd+2 to toggle fullscreen
          </div>
        )}
      </motion.div>
      
      {/* Right Panel Divider - only show when not collapsed */}
      {!isRightPanelCollapsed && (
        <div 
          className="panel-divider-v relative z-10 cursor-col-resize"
          onMouseDown={startRightDividerDrag}
        >
          <div className="absolute inset-0 w-3 -translate-x-1/2 hover:bg-cyan-500 hover:bg-opacity-20" />
        </div>
      )}
      
      {/* Right Panel - Chat & Metrics */}
      <motion.div
        className="h-full relative"
        initial={{ width: `${rightPanelWidth}%` }}
        animate={{ 
          width: isRightPanelCollapsed ? '60px' : `${rightPanelWidth}%`
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        style={{ 
          maxWidth: isRightPanelCollapsed ? '60px' : '500px',
          minWidth: isRightPanelCollapsed ? '60px' : '350px'
        }}
      >
        <RightPanel 
          onCollapse={toggleRightPanel}
          isCollapsed={isRightPanelCollapsed}
        />
        
        {/* Tooltip for right panel collapse */}
        {showTooltips && !isRightPanelCollapsed && (
          <div className="absolute top-16 left-6 bg-black bg-opacity-80 text-white text-xs p-2 rounded shadow-lg pointer-events-none">
            Cmd+3 to toggle
          </div>
        )}
      </motion.div>
      
      {/* Floating exit fullscreen button - only show when both panels collapsed */}
      {isLeftPanelCollapsed && isRightPanelCollapsed && (
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
  )
} 