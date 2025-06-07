"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useRocket } from "@/lib/store"
import { Project } from "@/types/rocket"
import UserProfile from "@/components/ui/UserProfile"
import { 
  Plus, 
  FileText, 
  MessageSquare, 
  BarChart3, 
  Trash2, 
  MoreVertical,
  Clock,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  Rocket,
  MoreHorizontal,
  AlertTriangle,
  Check
} from "lucide-react"
import { cleanupOrphanedSessions, deleteProject } from '@/lib/services/database.service'
import { useAuth } from "@/lib/auth/AuthContext"

interface LeftPanelProps {
  isCollapsed: boolean
  onCollapse: () => void
  onProjectClick?: (projectId: string) => void
  width?: number
}

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateProject: (name: string, template: 'basic' | 'advanced' | 'sport') => void
}

function NewProjectDialog({ open, onOpenChange, onCreateProject }: NewProjectDialogProps) {
  const [name, setName] = useState("")
  const [template, setTemplate] = useState<'basic' | 'advanced' | 'sport'>('basic')

  const handleCreate = () => {
    if (name.trim()) {
      onCreateProject(name.trim(), template)
      setName("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Choose a name and template for your new rocket project.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <Input
              placeholder="Enter project name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="text-black"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Template</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { 
                  key: 'basic', 
                  label: 'Basic', 
                  desc: 'Simple design',
                  icon: '🚀'
                },
                { 
                  key: 'advanced', 
                  label: 'Advanced', 
                  desc: 'Enhanced features',
                  icon: '⚡'
                },
                { 
                  key: 'sport', 
                  label: 'Sport', 
                  desc: 'High performance',
                  icon: '🏆'
                }
              ].map((t) => (
                <div
                  key={t.key}
                  className={cn(
                    "relative cursor-pointer rounded-lg border-2 p-3 transition-all hover:shadow-md",
                    template === t.key 
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" 
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                  onClick={() => setTemplate(t.key as typeof template)}
                >
                  {/* Selected indicator */}
                  {template === t.key && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  
                  <div className="text-center space-y-1">
                    <div className="text-lg">{t.icon}</div>
                    <div className={cn(
                      "font-medium text-sm",
                      template === t.key ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-gray-100"
                    )}>
                      {t.label}
                    </div>
                    <div className={cn(
                      "text-xs",
                      template === t.key ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                    )}>
                      {t.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProjectStatusBadge({ project }: { project: Project }) {
  const simCount = project.simulation_count || 0;
  if (simCount === 0) {
    return <Badge variant="secondary" className="text-xs">Draft</Badge>
  } else if (simCount >= 3) {
    return <Badge variant="default" className="text-xs bg-green-600">Tested</Badge>
  } else {
    return <Badge variant="default" className="text-xs bg-blue-600">Active</Badge>
  }
}

function getBadgeVariant(simCount: number): "default" | "secondary" | "destructive" | "outline" {
  if (simCount === 0) return "secondary";
  if (simCount >= 3) return "default";
  return "default";
}

function getProjectStatus(simCount: number): string {
  if (simCount === 0) return "Draft";
  if (simCount >= 3) return "Tested";
  return "Active";
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

// Delete Confirmation Dialog Component
interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  projectName: string;
}

function DeleteConfirmationDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  projectName 
}: DeleteConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-gradient-to-b from-gray-900 to-black text-white border border-red-500/20">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <DialogTitle className="text-red-400">Delete Project</DialogTitle>
          </div>
          <DialogDescription className="text-gray-300 pt-2">
            Are you sure you want to delete <span className="font-semibold text-white">"{projectName}"</span>?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-4">
            <p className="text-sm text-red-200 mb-3 font-medium">This will permanently delete:</p>
            <ul className="text-sm text-gray-300 space-y-1">
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                All rocket designs in this project
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                All conversation history
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                All simulation data
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                All version history
              </li>
            </ul>
            <p className="text-red-200 text-sm mt-3 font-medium">This action cannot be undone.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="bg-red-600 hover:bg-red-700 border-red-500"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LeftPanel({ isCollapsed, onCollapse, onProjectClick, width }: LeftPanelProps) {
  const { user } = useAuth()
  const { 
    isDatabaseConnected, 
    savedProjects, 
    currentProject,
    projectPagination,
    loadUserProjects,
    loadMoreProjects,
    loadProject,
    createAndLoadNewProject
  } = useRocket()
  
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Determine if panel is narrow based on width
  const isNarrow = width && width < 300;
  const isVeryNarrow = width && width < 250;

  // Load panel data when component mounts and database connects
  useEffect(() => {
    console.log('🔍 LeftPanel useEffect: isDatabaseConnected:', isDatabaseConnected);
    console.log('🔍 LeftPanel useEffect: savedProjects length:', savedProjects.length);
    console.log('🔍 LeftPanel useEffect: isLoadingMore:', projectPagination.isLoadingMore);
    
    let isMounted = true; // Track if component is still mounted
    let debounceTimeout: NodeJS.Timeout | null = null;
    
    const debouncedLoadProjects = () => {
      // Clear any existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      
      // Debounce the load call to prevent rapid successive calls
      debounceTimeout = setTimeout(() => {
        if (isMounted && isDatabaseConnected) {
          console.log('🔍 LeftPanel useEffect: Database connected, calling loadUserProjects()');
          loadUserProjects();
        }
        debounceTimeout = null;
      }, 300); // 300ms debounce
    };
    
    if (isDatabaseConnected) {
      debouncedLoadProjects();
    } else {
      console.log('🔍 LeftPanel useEffect: Database not connected, skipping project load');
    }
    
    return () => {
      isMounted = false;
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [isDatabaseConnected]) // Remove loadUserProjects from dependencies to prevent infinite loops

  const handleCreateProject = async (name: string, template: 'basic' | 'advanced' | 'sport') => {
    await createAndLoadNewProject(name, template)
    await loadUserProjects() // Refresh to show new project in list
    setIsNewProjectOpen(false)
  }

  const handleLoadProject = (project: Project) => {
    console.log('🚀 Loading project:', project.name, 'ID:', project.id)
    // Load the project in the store (this will load latest rocket and chat history)
    loadProject(project.id)
    
    // Notify parent component that a project was clicked so it can load project-specific chat
    if (onProjectClick) {
      onProjectClick(project.id)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    const project = savedProjects.find(p => p.id === projectId);
    const projectName = project?.name || 'this project';
    
    // Open custom delete confirmation dialog
    setProjectToDelete({ id: projectId, name: projectName });
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    
    try {
      console.log('🗑️ Deleting project:', projectToDelete.id, projectToDelete.name);
      
      // Check if we're deleting the currently active project
      const isDeletingCurrentProject = currentProject?.id === projectToDelete.id;
      
      // Delete the project from database
      const success = await deleteProject(projectToDelete.id);
      
      if (success) {
        console.log('✅ Project deleted successfully');
        
        // If we deleted the current project, clear it from state
        if (isDeletingCurrentProject) {
          // Reset to default state - clear current project and create new default rocket
          await createAndLoadNewProject('Default Rocket', 'basic');
          useRocket.setState({ currentProject: null }); // Clear current project
        }
        
        // Refresh the projects list
        await loadUserProjects();
        
        // Show success message
        console.log(`Project "${projectToDelete.name}" has been deleted.`);
      } else {
        throw new Error('Failed to delete project');
      }
    } catch (error) {
      console.error('❌ Error deleting project:', error);
      // For now, just log the error - could add a toast notification here
    } finally {
      setProjectToDelete(null);
    }
  };

  const refreshPanelData = () => {
    setIsRefreshing(true);
    loadUserProjects().finally(() => setIsRefreshing(false));
  };

  const handleCleanupSessions = async () => {
    setIsRefreshing(true);
    try {
      const cleaned = await cleanupOrphanedSessions();
      if (cleaned) {
        console.log('Orphaned sessions cleaned up');
        refreshPanelData();
      }
    } catch (error) {
      console.error('Session cleanup failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Render the projects list
  const renderProjects = () => {
    if (!isDatabaseConnected) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p>Connecting to database...</p>
        </div>
      )
    }

    if (savedProjects.length === 0 && !projectPagination.hasMore) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <div className="text-4xl mb-2">🚀</div>
          <p>No projects yet.</p>
          <p className="text-sm">Create your first rocket project!</p>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {savedProjects.map((project) => (
          <Card 
            key={project.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              isVeryNarrow ? "p-2" : isNarrow ? "p-2.5" : "p-3",
              currentProject?.id === project.id ? "border-blue-500 bg-blue-50/50" : "hover:border-blue-200"
            )}
            onClick={() => handleLoadProject(project)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-2 ${isVeryNarrow ? 'mb-0.5' : 'mb-1'}`}>
                  <h3 className={`font-medium truncate ${isVeryNarrow ? 'text-xs' : isNarrow ? 'text-xs' : 'text-sm'}`}>
                    {project.name}
                  </h3>
                  {!isVeryNarrow && (
                    <Badge variant={getBadgeVariant(project.simulation_count || 0)} className="text-xs">
                      {getProjectStatus(project.simulation_count || 0)}
                    </Badge>
                  )}
                </div>
                
                {project.description && !isVeryNarrow && (
                  <p className={`text-muted-foreground line-clamp-2 mb-2 ${isNarrow ? 'text-xs' : 'text-xs'}`}>
                    {project.description}
                  </p>
                )}
                
                <div className={`flex items-center gap-3 text-muted-foreground ${isVeryNarrow ? 'text-xs' : 'text-xs'}`}>
                  <div className="flex items-center gap-1">
                    <Rocket className="h-3 w-3" />
                    <span>{project.rocket_count || 0}</span>
                  </div>
                  {!isVeryNarrow && (
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{project.message_count || 0}</span>
                    </div>
                  )}
                  {!isNarrow && (
                    <div className="flex items-center gap-1">
                      <span>Updated {formatTimeAgo(project.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Project actions menu */}
              {!isVeryNarrow && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleLoadProject(project);
                    }}>
                      <FileText className="h-3 w-3 mr-2" />
                      Open Project
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="text-red-600"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </Card>
        ))}
        
        {/* Load More Button */}
        {projectPagination.hasMore && (
          <div className="pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={loadMoreProjects}
              disabled={projectPagination.isLoadingMore}
            >
              {projectPagination.isLoadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                  Loading...
                </>
              ) : (
                <>
                  Load More ({projectPagination.totalCount - savedProjects.length} remaining)
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (isCollapsed) {
    return (
      <div className="w-16 h-full bg-black border-r border-white/5 flex flex-col items-center py-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={onCollapse} className="p-2">
          <ChevronRight className="w-5 h-5" />
        </Button>

        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="p-2 relative">
            <Folder className="w-5 h-5" />
            {savedProjects.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                {savedProjects.length}
              </Badge>
            )}
          </Button>

          <Button variant="ghost" size="sm" className="p-2 relative">
            <BarChart3 className="w-5 h-5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 h-full bg-black border-r border-white/5 flex flex-col" style={{ width: width || 320 }}>
      {/* Header */}
      <div className={`border-b border-white/5 ${isVeryNarrow ? 'p-3' : isNarrow ? 'p-4' : 'p-6'}`}>
        <div className={`flex items-center justify-between ${isVeryNarrow ? 'mb-3' : isNarrow ? 'mb-4' : 'mb-6'}`}>
          <h1 className={`font-semibold text-white ${isVeryNarrow ? 'text-sm truncate' : isNarrow ? 'text-lg truncate' : 'text-xl'}`}>
            {isVeryNarrow ? 'R.v1' : isNarrow ? 'ROCKET' : 'ROCKETv1'}
          </h1>
          <Button variant="ghost" size="sm" onClick={onCollapse} className="p-2">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-1 bg-black/20 rounded-lg p-1">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
            >
              <Folder className="w-4 h-4 mr-2" />
              {isVeryNarrow ? '' : 'Projects'}
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs"
            onClick={() => setIsNewProjectOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            {isNarrow ? '' : 'New'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${isVeryNarrow ? 'p-3' : isNarrow ? 'p-4' : 'p-6'}`}>
        {!isDatabaseConnected ? (
          <div className="text-center text-gray-400 py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Database not connected</p>
            <p className="text-xs opacity-70">Running in offline mode</p>
          </div>
        ) : projectPagination.isLoadingMore ? (
          <div className="text-center text-gray-400 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-sm">Loading...</p>
          </div>
        ) : (
          renderProjects()
        )}
      </div>

      {/* Footer */}
      <div className={`border-t border-white/5 ${isVeryNarrow ? 'p-3' : isNarrow ? 'p-4' : 'p-6'}`}>
        <UserProfile />
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog 
        open={isNewProjectOpen}
        onOpenChange={setIsNewProjectOpen}
        onCreateProject={handleCreateProject}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDeleteProject}
        projectName={projectToDelete?.name || 'this project'}
      />
    </div>
  )
}
