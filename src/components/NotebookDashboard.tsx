import React, { useState } from 'react';
import { 
  Notebook as NotebookIcon, 
  Plus, 
  Clock, 
  Layout, 
  Search, 
  Trash2, 
  ChevronRight, 
  LogOut, 
  Sparkles, 
  FileText, 
  MessageSquare, 
  GraduationCap,
  AlertTriangle,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { User } from '../hooks/useAuth';
import { Notebook } from '../hooks/useNotebook';

interface NotebookDashboardProps {
  user: User;
  notebooks: Notebook[];
  dashboardSearchQuery: string;
  setDashboardSearchQuery: (query: string) => void;
  sortBy: 'recent' | 'title' | 'created';
  setSortBy: (sort: 'recent' | 'title' | 'created') => void;
  createNewNotebook: () => Promise<string | undefined>;
  deleteNotebook: (id: string) => Promise<void>;
  setCurrentNotebookId: (id: string) => void;
  logout: () => void;
}

export const NotebookDashboard: React.FC<NotebookDashboardProps> = ({
  user,
  notebooks,
  dashboardSearchQuery,
  setDashboardSearchQuery,
  sortBy,
  setSortBy,
  createNewNotebook,
  deleteNotebook,
  setCurrentNotebookId,
  logout
}) => {
  const [notebookToDelete, setNotebookToDelete] = useState<string | null>(null);

  return (
    <div className="h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden flex flex-col">
      <header className="h-20 border-b border-white/5 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-8 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <NotebookIcon className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-white">AI Notebook</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/5 rounded-2xl">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-indigo-500/20 overflow-hidden">
              {user.avatar ? <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" /> : user.name[0]}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold truncate text-white">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Pro Member</p>
            </div>
            <button onClick={logout} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-red-400 transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 lg:p-12 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          
          {/* Hero Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-2">
              <h2 className="text-4xl font-display font-bold text-white tracking-tight">Welcome back, {user.name.split(' ')[0]}</h2>
              <p className="text-slate-400 text-lg">You have {notebooks.length} notebooks across your projects.</p>
            </div>
            <button 
              onClick={createNewNotebook}
              className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-3 self-start md:self-center group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              New Notebook
            </button>
          </div>

          {/* Featured Templates */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Featured Templates
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: 'Research Paper Analysis', desc: 'Deep dive into academic papers with AI-powered summaries.', icon: FileText, color: 'bg-blue-500' },
                { title: 'Meeting Strategist', desc: 'Transform meeting transcripts into actionable items.', icon: MessageSquare, color: 'bg-purple-500' },
                { title: 'Exam Preparation', desc: 'Generate quizzes and flashcards from your study notes.', icon: GraduationCap, color: 'bg-emerald-500' }
              ].map((template, i) => (
                <div key={i} className="group p-6 bg-slate-900 border border-white/5 rounded-3xl hover:border-indigo-500/30 transition-all cursor-pointer relative overflow-hidden shadow-lg border-2 border-transparent">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all" />
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg", template.color)}>
                    <template.icon className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">{template.title}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{template.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Notebooks Section */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Your Notebooks
              </h3>
              
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text"
                    value={dashboardSearchQuery}
                    onChange={(e) => setDashboardSearchQuery(e.target.value)}
                    placeholder="Search notebooks..."
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all text-white placeholder:text-slate-600 outline-none"
                  />
                </div>
                
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1">
                  {[
                    { id: 'recent', label: 'Recent', icon: Clock },
                    { id: 'title', label: 'A-Z', icon: Layout },
                    { id: 'created', label: 'Newest', icon: Plus }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSortBy(option.id as any)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                        sortBy === option.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      <option.icon className="w-3 h-3" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {notebooks.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] space-y-4 bg-white/[0.02]">
                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto">
                  <NotebookIcon className="w-8 h-8 text-slate-700" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-400">No notebooks yet</p>
                  <p className="text-sm text-slate-500">Create your first notebook to start researching.</p>
                </div>
                <button 
                  onClick={createNewNotebook}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-sm font-bold transition-all border border-white/10"
                >
                  Create Notebook
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {notebooks
                  .filter(nb => nb.title.toLowerCase().includes(dashboardSearchQuery.toLowerCase()))
                  .sort((a, b) => {
                    if (sortBy === 'title') return a.title.localeCompare(b.title);
                    if (sortBy === 'created') return b.createdAt - a.createdAt;
                    return (b.lastModified || b.createdAt) - (a.lastModified || a.createdAt);
                  })
                  .map(notebook => (
                  <motion.div 
                    key={notebook.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setCurrentNotebookId(notebook.id)}
                    className="group p-6 bg-slate-900 border border-white/5 rounded-[2rem] hover:border-indigo-500/30 transition-all cursor-pointer flex flex-col h-full relative overflow-hidden shadow-xl hover:shadow-indigo-500/10"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-indigo-500/10 transition-all" />
                    
                    <div className="flex items-start justify-between mb-6 relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner group-hover:scale-110 transition-transform">
                        <NotebookIcon className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setNotebookToDelete(notebook.id);
                          }}
                          className="p-2 opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all relative z-20"
                        >
                          <Trash2 className="w-4 h-4 cursor-pointer" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="relative z-10 flex-1">
                      <h4 className="text-xl font-display font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors line-clamp-2 leading-tight">
                        {notebook.title}
                      </h4>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <div className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          {notebook.ownerId === user.id ? 'Owner' : 'Collaborator'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white uppercase">
                          {user.name[0]}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                          {new Date(notebook.lastModified || notebook.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {notebookToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#1E1F22] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative"
          >
            <button 
              onClick={() => setNotebookToDelete(null)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center text-center space-y-4 pt-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shadow-lg shadow-red-500/20">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white mb-2">Delete Notebook?</h3>
                <p className="text-sm text-slate-400">
                  Are you sure you want to delete this notebook? This action cannot be undone and will remove all sources, notes, and chat history.
                </p>
              </div>
              <div className="flex w-full gap-3 pt-4 border-t border-white/5">
                <button 
                  onClick={() => setNotebookToDelete(null)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    await deleteNotebook(notebookToDelete);
                    setNotebookToDelete(null);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
