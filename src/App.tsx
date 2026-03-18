/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Sparkles, User, Bot, Trash2, Loader2, 
  Plus, FolderPlus, Folder, MessageSquare, 
  ChevronRight, ChevronDown, MoreVertical, Edit2,
  Menu, X, Search
} from 'lucide-react';
import { getGeminiResponse } from './services/geminiService';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  folderId: string | null;
  lastModified: Date;
}

interface Folder {
  id: string;
  name: string;
}

export default function App() {
  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem('lumina_folders');
    return saved ? JSON.parse(saved) : [];
  });
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('lumina_conversations');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((c: any) => ({
        ...c,
        lastModified: new Date(c.lastModified),
        messages: c.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      }));
    }
    return [];
  });
  const [activeId, setActiveId] = useState<string | null>(() => {
    return localStorage.getItem('lumina_active_id');
  });

  useEffect(() => {
    localStorage.setItem('lumina_folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('lumina_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (activeId) {
      localStorage.setItem('lumina_active_id', activeId);
    } else {
      localStorage.removeItem('lumina_active_id');
    }
  }, [activeId]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find(c => c.id === activeId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.messages, isLoading]);

  // Create initial conversation if none exists
  useEffect(() => {
    if (conversations.length === 0) {
      createNewConversation();
    }
  }, []);

  const createNewConversation = (folderId: string | null = null) => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "Nouvelle conversation",
      messages: [],
      folderId,
      lastModified: new Date(),
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newConv.id);
  };

  const createNewFolder = () => {
    const name = window.prompt("Nom du dossier :");
    if (name) {
      const newFolder: Folder = {
        id: Date.now().toString(),
        name,
      };
      setFolders(prev => [...prev, newFolder]);
    }
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Supprimer cette conversation ?")) {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeId === id) {
        const remaining = conversations.filter(c => c.id !== id);
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  const renameConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTitle = window.prompt("Nouveau titre :");
    if (newTitle) {
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    }
  };

  const moveConversation = (convId: string, folderId: string | null) => {
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, folderId } : c));
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !activeId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: new Date(),
    };

    // Update conversation with user message
    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        const updatedMessages = [...c.messages, userMessage];
        // Auto-rename if it's the first message
        const title = c.messages.length === 0 ? userMessage.text.slice(0, 30) + (userMessage.text.length > 30 ? "..." : "") : c.title;
        return { ...c, messages: updatedMessages, title, lastModified: new Date() };
      }
      return c;
    }));

    setInput('');
    setIsLoading(true);

    try {
      const history = activeConversation?.messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      })) || [];

      const aiResponseText = await getGeminiResponse(userMessage.text, history);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: aiResponseText || "Désolé, je n'ai pas pu générer de réponse.",
        timestamp: new Date(),
      };

      setConversations(prev => prev.map(c => {
        if (c.id === activeId) {
          return { ...c, messages: [...c.messages, aiMessage], lastModified: new Date() };
        }
        return c;
      }));
    } catch (error) {
      console.error("Error fetching AI response:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Oups ! Une erreur est survenue lors de la connexion à l'intelligence artificielle.",
        timestamp: new Date(),
      };
      setConversations(prev => prev.map(c => {
        if (c.id === activeId) {
          return { ...c, messages: [...c.messages, errorMessage], lastModified: new Date() };
        }
        return c;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.messages.some(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-72 bg-white border-r border-slate-200 flex flex-col z-30"
          >
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-brand-500 rounded-lg text-white">
                    <Sparkles size={18} />
                  </div>
                  <span className="font-display font-bold text-lg">Lumina</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                  <X size={20} />
                </button>
              </div>
              
              <button 
                onClick={() => createNewConversation()}
                className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white py-2 px-4 rounded-xl transition-all shadow-md shadow-brand-500/20 font-medium mb-3"
              >
                <Plus size={18} />
                Nouvelle discussion
              </button>

              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Rechercher..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {/* Folders Section */}
              <div>
                <div className="flex items-center justify-between px-2 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dossiers</span>
                  <button onClick={createNewFolder} className="p-1 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded transition-colors">
                    <FolderPlus size={14} />
                  </button>
                </div>
                <div className="space-y-1">
                  {folders.map(folder => (
                    <FolderItem 
                      key={folder.id} 
                      folder={folder} 
                      conversations={filteredConversations.filter(c => c.folderId === folder.id)}
                      activeId={activeId}
                      setActiveId={setActiveId}
                      deleteConversation={deleteConversation}
                      renameConversation={renameConversation}
                    />
                  ))}
                </div>
              </div>

              {/* Uncategorized Conversations */}
              <div>
                <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Récents</span>
                <div className="space-y-1">
                  {filteredConversations.filter(c => !c.folderId).map(conv => (
                    <ConversationItem 
                      key={conv.id} 
                      conv={conv} 
                      isActive={activeId === conv.id}
                      onClick={() => setActiveId(conv.id)}
                      onDelete={(e) => deleteConversation(conv.id, e)}
                      onRename={(e) => renameConversation(conv.id, e)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs">
                  FA
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">fagnihoun205@gmail.com</p>
                  <p className="text-[10px] text-slate-500">Plan Gratuit</p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile/Closed Sidebar Toggle */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-20 p-2 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-10">
          <div className="flex items-center gap-3 ml-10 lg:ml-0">
            <div className="hidden md:block">
              <h1 className="font-display font-bold text-xl text-slate-900 truncate max-w-[200px] md:max-w-md">
                {activeConversation?.title || "Lumina Chat"}
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                {isLoading ? "Lumina écrit..." : "Prêt à vous aider"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors">
              <Sparkles size={20} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth bg-slate-50/50"
        >
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 bg-brand-50 rounded-3xl flex items-center justify-center text-brand-500 mb-2 rotate-3"
              >
                <Bot size={40} />
              </motion.div>
              <h2 className="font-display font-semibold text-2xl text-slate-800">Comment puis-je vous aider ?</h2>
              <p className="text-slate-500 text-sm">
                Je suis Lumina, votre assistant IA. Posez-moi une question, demandez-moi d'écrire du code ou de traduire un texte.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-4">
                {[
                  { icon: "✍️", text: "Écris un email pro" },
                  { icon: "💡", text: "Idées de cadeaux" },
                  { icon: "🌍", text: "Traduis en anglais" },
                  { icon: "🍳", text: "Recette rapide" }
                ].map((s) => (
                  <button
                    key={s.text}
                    onClick={() => { setInput(s.text); }}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl hover:border-brand-500 hover:text-brand-600 hover:shadow-md transition-all text-left"
                  >
                    <span className="text-lg">{s.icon}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              <AnimatePresence initial={false}>
                {activeConversation.messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        msg.role === 'user' ? 'bg-brand-100 text-brand-600' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                      </div>
                      <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                        <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <span className={`text-[10px] mt-1 block opacity-60 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center">
                      <Bot size={18} />
                    </div>
                    <div className="chat-bubble-ai flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-brand-500" />
                      <span className="text-sm text-slate-500 italic">Lumina réfléchit...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </main>

        {/* Input Area */}
        <footer className="p-4 md:p-6 bg-white border-t border-slate-200">
          <form 
            onSubmit={handleSend}
            className="max-w-3xl mx-auto relative flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 pr-12 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-800 shadow-inner"
              disabled={isLoading || !activeId}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || !activeId}
              className={`p-3.5 rounded-xl transition-all ${
                !input.trim() || isLoading || !activeId
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 active:scale-95'
              }`}
            >
              <Send size={20} />
            </button>
          </form>
          <p className="text-[10px] text-center text-slate-400 mt-3">
            Lumina peut faire des erreurs. Vérifiez les informations importantes.
          </p>
        </footer>
      </div>
    </div>
  );
}

const FolderItem: React.FC<{ 
  folder: Folder, 
  conversations: Conversation[],
  activeId: string | null,
  setActiveId: (id: string | null) => void,
  deleteConversation: (id: string, e: React.MouseEvent) => void,
  renameConversation: (id: string, e: React.MouseEvent) => void
}> = ({ folder, conversations, activeId, setActiveId, deleteConversation, renameConversation }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="space-y-1">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors group"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Folder size={14} className="text-brand-500" />
        <span className="flex-1 text-left truncate">{folder.name}</span>
        <span className="text-[10px] bg-slate-100 px-1.5 rounded-full group-hover:bg-white">{conversations.length}</span>
      </button>
      
      {isOpen && (
        <div className="pl-4 space-y-1">
          {conversations.map(conv => (
            <ConversationItem 
              key={conv.id} 
              conv={conv} 
              isActive={activeId === conv.id}
              onClick={() => setActiveId(conv.id)}
              onDelete={(e) => deleteConversation(conv.id, e)}
              onRename={(e) => renameConversation(conv.id, e)}
            />
          ))}
          {conversations.length === 0 && (
            <p className="text-[10px] text-slate-400 italic px-2 py-1">Dossier vide</p>
          )}
        </div>
      )}
    </div>
  );
};

const ConversationItem: React.FC<{ 
  conv: Conversation, 
  isActive: boolean,
  onClick: () => void,
  onDelete: (e: React.MouseEvent) => void,
  onRename: (e: React.MouseEvent) => void
}> = ({ conv, isActive, onClick, onDelete, onRename }) => {
  return (
    <div
      onClick={onClick}
      className={`w-full group flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-all cursor-pointer ${
        isActive 
          ? 'bg-brand-50 text-brand-600 font-medium' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <MessageSquare size={14} className={isActive ? 'text-brand-500' : 'text-slate-400'} />
      <span className="flex-1 text-left truncate">{conv.title}</span>
      
      <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100' : ''}`}>
        <button 
          onClick={onRename}
          className="p-1 hover:bg-white rounded text-slate-400 hover:text-brand-500 transition-colors"
          title="Renommer"
        >
          <Edit2 size={12} />
        </button>
        <button 
          onClick={onDelete}
          className="p-1 hover:bg-white rounded text-slate-400 hover:text-rose-500 transition-colors"
          title="Supprimer"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};
