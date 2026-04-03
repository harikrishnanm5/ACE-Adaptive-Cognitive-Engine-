import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import Groq from 'groq-sdk';
import InteractiveTutor from './components/InteractiveTutor';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  BookOpen, 
  Brain, 
  FileText, 
  GraduationCap, 
  Loader2, 
  Send, 
  Sparkles, 
  Upload,
  History,
  Download,
  Copy,
  Check,
  AlertCircle,
  Plus,
  X,
  MessageSquare,
  Notebook as NotebookIcon,
  Volume2,
  ChevronRight,
  ChevronLeft,
  Search,
  Settings,
  Trash2,
  FileUp,
  AudioLines,
  Globe,
  Video,
  Mic,
  Link as LinkIcon,
  PlayCircle,
  LayoutGrid,
  Presentation,
  FileVideo,
  Network,
  FileBarChart,
  Layers,
  HelpCircle,
  BarChart3,
  Table,
  RefreshCw,
  StickyNote,
  Share2,
  MoreHorizontal,
  Grid,
  LogOut,
  User as UserIcon,
  Clock,
  Filter,
  MoreVertical,
  Layout,
  Code2,
  Database,
  ArrowRight,
  HardDrive,
  Clipboard,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import { cn } from './lib/utils';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from './firebase';

// Initialize AI Engines
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, dangerouslyAllowBrowser: true });

type SourceType = 'text' | 'url' | 'audio' | 'video';

interface User {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  email?: string;
}

interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  ownerId: string;
  lastModified?: number;
}

interface Source {
  id: string;
  notebookId: string;
  name: string;
  content: string;
  type: string;
  sourceType: SourceType;
  size: number;
  authorId: string;
  createdAt: number;
}

interface ChatMessage {
  id: string;
  notebookId: string;
  role: 'user' | 'assistant';
  content: string;
  authorId?: string;
  createdAt: number;
}

interface NotebookVersion {
  id: string;
  notebookId: string;
  content: string;
  createdAt: number;
  authorId: string;
  authorName: string;
  note?: string;
}

interface Note {
  id: string;
  notebookId: string;
  content: string;
  createdAt: number;
  authorId: string;
  type?: 'text' | 'audio';
  sourceCount?: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [currentNotebookId, setCurrentNotebookId] = useState<string | null>(null);
  const [currentNotebook, setCurrentNotebook] = useState<Notebook | null>(null);
  
  const [sources, setSources] = useState<Source[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'notebook'>('chat');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAudioGenerating, setIsAudioGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isNotebookAudioGenerating, setIsNotebookAudioGenerating] = useState(false);
  const [notebookAudioUrl, setNotebookAudioUrl] = useState<string | null>(null);
  const [notebookContent, setNotebookContent] = useState<string>('');
  const [notebookVersions, setNotebookVersions] = useState<NotebookVersion[]>([]);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isProcessingSource, setIsProcessingSource] = useState(false);
  const [isRenamingNotebook, setIsRenamingNotebook] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [notebookTitle, setNotebookTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'created'>('recent');
  const [isInteractiveModeOpen, setIsInteractiveModeOpen] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState<string | null>(null);
  const [currentPlaybackId, setCurrentPlaybackId] = useState<string | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          avatar: firebaseUser.photoURL || '',
          isOnline: true,
          email: firebaseUser.email || ''
        });
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Notebooks Listener
  useEffect(() => {
    if (!user) {
      setNotebooks([]);
      return;
    }

    const q = query(
      collection(db, 'notebooks'),
      where('ownerId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotebooks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notebook[];
      setNotebooks(fetchedNotebooks);
    });

    return () => unsubscribe();
  }, [user]);

  // Current Notebook Data Listeners
  useEffect(() => {
    if (!user || !currentNotebookId) {
      setSources([]);
      setChatMessages([]);
      setNotes([]);
      setNotebookVersions([]);
      setNotebookContent('');
      setCurrentNotebook(null);
      return;
    }

    // Notebook Metadata
    const notebookRef = doc(db, 'notebooks', currentNotebookId);
    const unsubNotebook = onSnapshot(notebookRef, (doc) => {
      if (doc.exists()) {
        setCurrentNotebook({ id: doc.id, ...doc.data() } as Notebook);
      }
    });

    // Sources
    const sourcesRef = collection(db, 'notebooks', currentNotebookId, 'sources');
    const unsubSources = onSnapshot(query(sourcesRef, orderBy('createdAt', 'asc')), (snapshot) => {
      setSources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Source[]);
    });

    // Chat Messages
    const chatRef = collection(db, 'notebooks', currentNotebookId, 'chatMessages');
    const unsubChat = onSnapshot(query(chatRef, orderBy('createdAt', 'asc')), (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[]);
    });

    // Notes
    const notesRef = collection(db, 'notebooks', currentNotebookId, 'notes');
    const unsubNotes = onSnapshot(query(notesRef, orderBy('createdAt', 'desc')), (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Note[]);
    });

    // Versions
    const versionsRef = collection(db, 'notebooks', currentNotebookId, 'versions');
    const unsubVersions = onSnapshot(query(versionsRef, orderBy('createdAt', 'desc')), (snapshot) => {
      setNotebookVersions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotebookVersion[]);
    });

    return () => {
      unsubNotebook();
      unsubSources();
      unsubChat();
      unsubNotes();
      unsubVersions();
    };
  }, [user, currentNotebookId]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentNotebookId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const createNewNotebook = async () => {
    if (!user) return;
    const id = Math.random().toString(36).substring(7);
    const newNotebook: Notebook = {
      id,
      title: 'Untitled Notebook',
      ownerId: user.id,
      createdAt: Date.now(),
      lastModified: Date.now()
    };
    await setDoc(doc(db, 'notebooks', id), newNotebook);
    setCurrentNotebookId(id);
    setView('chat');
  };

  const deleteNotebook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notebook?')) return;
    await deleteDoc(doc(db, 'notebooks', id));
    if (currentNotebookId === id) setCurrentNotebookId(null);
  };

  const renameNotebook = async () => {
    if (!currentNotebookId || !newNotebookTitle.trim()) return;
    await updateDoc(doc(db, 'notebooks', currentNotebookId), {
      title: newNotebookTitle,
      lastModified: Date.now()
    });
    setIsRenamingNotebook(false);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!currentNotebookId || !user) return;

    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result;
        if (!result) return;

        const id = Math.random().toString(36).substring(7);
        let content = '';
        let sourceType: SourceType = 'text';

        if (file.type.startsWith('text/') || file.name.endsWith('.md')) {
          content = result as string;
          sourceType = 'text';
        } else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
          setIsProcessingSource(true);
          try {
            sourceType = file.type.startsWith('audio/') ? 'audio' : 'video';
            const base64Data = (result as string).split(',')[1];
            
            const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: file.type
                  }
                },
                { text: "Please provide a detailed transcription and summary of this media file for my notebook." }
              ]
            });
            content = response.text || "Failed to transcribe media.";
          } catch (err) {
            console.error(err);
            content = "Error processing media file.";
          } finally {
            setIsProcessingSource(false);
          }
        }

        const newSource: Source = {
          id,
          notebookId: currentNotebookId,
          name: file.name,
          content,
          type: file.type,
          sourceType,
          size: file.size,
          authorId: user.id,
          createdAt: Date.now(),
        };
        await setDoc(doc(db, 'notebooks', currentNotebookId, 'sources', id), newSource);
      };

      if (file.type.startsWith('text/') || file.name.endsWith('.md')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  }, [currentNotebookId, user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'audio/*': ['.mp3', '.wav', '.m4a'],
      'video/*': ['.mp4', '.mov', '.webm'],
    },
    multiple: true
  });

  const addUrlSource = async () => {
    if (!urlInput.trim() || !currentNotebookId || !user) return;
    setIsProcessingSource(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Please summarize the content of this URL: ${urlInput}`,
        config: {
          tools: [{ urlContext: {} }]
        }
      });

      const id = Math.random().toString(36).substring(7);
      const newSource: Source = {
        id,
        notebookId: currentNotebookId,
        name: urlInput.replace(/^https?:\/\//, '').split('/')[0],
        content: response.text || "Failed to fetch content.",
        type: 'text/url',
        sourceType: 'url',
        size: 0,
        authorId: user.id,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, 'notebooks', currentNotebookId, 'sources', id), newSource);
      setUrlInput('');
      setIsAddSourceModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingSource(false);
    }
  };

  const handleWebSearch = async () => {
    if (!searchQuery.trim() || !currentNotebookId || !user) return;
    setIsProcessingSource(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Research and summarize the following topic for my notebook: ${searchQuery}`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      
      const id = Math.random().toString(36).substring(7);
      const newSource: Source = {
        id,
        notebookId: currentNotebookId,
        name: searchQuery,
        content: response.text || "No content found.",
        type: 'text/search',
        sourceType: 'url',
        size: 0,
        authorId: user.id,
        createdAt: Date.now(),
      };
      
      await setDoc(doc(db, 'notebooks', currentNotebookId, 'sources', id), newSource);
      setSearchQuery('');
      setIsAddSourceModalOpen(false);
    } catch (error) {
      console.error("Web Search Error:", error);
      alert("Failed to search the web. Please try again.");
    } finally {
      setIsProcessingSource(false);
    }
  };

  const removeSource = async (id: string) => {
    if (!currentNotebookId) return;
    await deleteDoc(doc(db, 'notebooks', currentNotebookId, 'sources', id));
    if (activeSourceId === id) setActiveSourceId(null);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !currentNotebookId || !user) return;

    const id = Math.random().toString(36).substring(7);
    const userMessage: ChatMessage = { 
      id,
      notebookId: currentNotebookId,
      role: 'user', 
      content: input,
      authorId: user.id,
      createdAt: Date.now()
    };
    
    await setDoc(doc(db, 'notebooks', currentNotebookId, 'chatMessages', id), userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const sourceContext = sources.map(s => `Source: ${s.name}\nContent: ${s.content}`).join('\n\n---\n\n');
      const prompt = `
        Context from sources:
        ${sourceContext}

        User Question: ${input}

        Please answer the question based ONLY on the provided sources. If the answer is not in the sources, say so.
      `;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are ACE (Adaptive Cognitive Engine), a high-speed research assistant. Provide concise, accurate answers based on the provided context." },
          { role: "user", content: prompt }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
      });

      const responseText = completion.choices[0]?.message?.content;

      if (responseText) {
        const aiId = Math.random().toString(36).substring(7);
        await setDoc(doc(db, 'notebooks', currentNotebookId, 'chatMessages', aiId), { 
          id: aiId,
          notebookId: currentNotebookId,
          role: 'assistant', 
          content: responseText,
          createdAt: Date.now()
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNotebookGuide = async () => {
    if (sources.length === 0 || !currentNotebookId || !user) return;
    setIsLoading(true);
    setView('notebook');

    try {
      const sourceContext = sources.map(s => `Source: ${s.name}\nContent: ${s.content}`).join('\n\n---\n\n');
      const prompt = `
        Based on the following sources, generate a comprehensive study guide.
        Include:
        1. A high-level summary.
        2. Key concepts and definitions.
        3. Frequently Asked Questions (FAQs).
        4. A set of practice questions.

        Sources:
        ${sourceContext}
      `;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are an expert educational strategist." },
          { role: "user", content: prompt }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
      });

      const responseText = completion.choices[0]?.message?.content;

      if (responseText) {
        setNotebookContent(responseText);
        
        const versionId = Math.random().toString(36).substring(7);
        const newVersion: NotebookVersion = {
          id: versionId,
          notebookId: currentNotebookId,
          content: responseText,
          createdAt: Date.now(),
          authorId: user.id,
          authorName: user.name,
          note: `Generated study guide from ${sources.length} sources`
        };
        await setDoc(doc(db, 'notebooks', currentNotebookId, 'versions', versionId), newVersion);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAudioOverview = async () => {
    if (sources.length === 0) return;
    setIsAudioGenerating(true);
    setAudioUrl(null);

    try {
      const sourceContext = sources.map(s => `Source: ${s.name}\nContent: ${s.content}`).join('\n\n---\n\n');
      
      const scriptResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a 1-minute podcast-style script summarizing these sources. Make it engaging and conversational. 
        Sources: ${sourceContext}`,
      });

      const script = scriptResponse.text || "Here is a summary of your sources.";

      const audioResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say enthusiastically: ${script}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAudioGenerating(false);
    }
  };

  const revertToVersion = async (version: NotebookVersion) => {
    if (!currentNotebookId || !user) return;
    setNotebookContent(version.content);
    setIsVersionHistoryOpen(false);
    
    const versionId = Math.random().toString(36).substring(7);
    const newVersion: NotebookVersion = {
      id: versionId,
      notebookId: currentNotebookId,
      content: version.content,
      createdAt: Date.now(),
      authorId: user.id,
      authorName: user.name,
      note: `Reverted to version from ${new Date(version.createdAt).toLocaleString()}`
    };
    await setDoc(doc(db, 'notebooks', currentNotebookId, 'versions', versionId), newVersion);
  };

  const generateNotebookAudio = async () => {
    if (!notebookContent) return;
    setIsNotebookAudioGenerating(true);
    setNotebookAudioUrl(null);

    try {
      const cleanContent = notebookContent.replace(/[#*`]/g, '').substring(0, 1500);

      const audioResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read this study guide clearly: ${cleanContent}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setNotebookAudioUrl(url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsNotebookAudioGenerating(false);
    }
  };

  const [isGeneratingStudioContent, setIsGeneratingStudioContent] = useState(false);
  const [studioContent, setStudioContent] = useState<{ type: string; content: string } | null>(null);

  const useStudioTool = async (toolType: string) => {
    if (sources.length === 0) {
      alert("Please add at least one source first.");
      return;
    }

    setIsGeneratingStudioContent(true);
    setView('notebook');
    
    try {
      const sourceContext = sources.map(s => `Source: ${s.name}\nContent: ${s.content}`).join('\n\n');
      
      let prompt = "";
      switch (toolType) {
        case 'audio':
          prompt = `Based on these sources, create a detailed script for a 5-minute educational podcast. Include a host introduction, key discussion points, and a summary. Format as a script.`;
          break;
        case 'slides':
          prompt = `Based on these sources, create a detailed slide-by-slide outline for a presentation. For each slide, provide a Title and 3-5 Bullet Points. Aim for 8-10 slides.`;
          break;
        case 'video':
          prompt = `Based on these sources, create a storyboard/script for a short educational video. Include visual descriptions and voiceover text for each scene.`;
          break;
        case 'mindmap':
          prompt = `Based on these sources, create a structured hierarchical outline that can be used to build a mind map. Use indentation to show relationships between concepts.`;
          break;
        case 'report':
          prompt = `Based on these sources, write a comprehensive formal report. Include an Executive Summary, Introduction, Detailed Analysis, and Conclusion. Use professional formatting.`;
          break;
        case 'flashcards':
          prompt = `Based on these sources, generate 15 high-quality flashcards. Format each as "Front: [Question]" and "Back: [Answer]". Focus on key concepts and definitions.`;
          break;
        case 'quiz':
          prompt = `Based on these sources, create a 10-question multiple-choice quiz. For each question, provide 4 options and indicate the correct answer with an explanation.`;
          break;
        case 'infographic':
          prompt = `Based on these sources, outline the content for an infographic. Include a catchy title, 5 key statistics or facts, and descriptions for 3-4 visual sections.`;
          break;
        case 'datatable':
          prompt = `Based on these sources, extract all key data points and organize them into a structured Markdown table. Include relevant columns based on the content.`;
          break;
        case 'code':
          prompt = `Based on these sources, generate relevant code snippets or scripts that implement the concepts discussed. Use appropriate programming languages and include comments.`;
          break;
        case 'analysis':
          prompt = `Perform a deep data analysis on the information provided in these sources. Identify trends, correlations, and key insights. Present your findings in a structured analytical report.`;
          break;
        default:
          prompt = `Summarize these sources.`;
      }

      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are ACE, a specialized tool for transforming research data." },
          { role: "user", content: `Context:\n${sourceContext}\n\nTask: ${prompt}` }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
      });

      let finalResponseText = completion.choices[0]?.message?.content || "Failed to generate content.";

      // Use Presenton for actual slide generation
      if (toolType === 'slides' && process.env.PRESENTON_API_KEY) {
        try {
          const presentonResponse = await fetch('https://api.presenton.ai/api/v1/ppt/presentation/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.PRESENTON_API_KEY}`
            },
            body: JSON.stringify({
              content: sourceContext,
              instructions: prompt,
              n_slides: 8,
              template: "general",
              export_as: "pptx",
              tone: "professional"
            })
          });

          if (presentonResponse.ok) {
            const data = await presentonResponse.json();
            if (data.edit_path || data.download_path) {
              finalResponseText = `Slides successfully generated via Presenton!\n\nView/Edit Slides: ${data.edit_path || data.download_path}\n\nOutline:\n${finalResponseText}`;
            }
          }
        } catch (err) {
          console.error("Presenton API Error:", err);
          // Fallback to text outline
        }
      }

      setStudioContent({ type: toolType, content: finalResponseText });

      // Automatically save all Studio outputs to Notes with metadata
      if (finalResponseText && currentNotebookId && user) {
        const id = Math.random().toString(36).substring(7);
        const newNote: Note = {
          id,
          notebookId: currentNotebookId,
          content: finalResponseText,
          createdAt: Date.now(),
          authorId: user.id,
          type: toolType as any,
          sourceCount: sources.length
        };
        await setDoc(doc(db, 'notebooks', currentNotebookId, 'notes', id), newNote);
      }
    } catch (error) {
      console.error("Studio Tool Error:", error);
      alert("Failed to generate content. Please try again.");
    } finally {
      setIsGeneratingStudioContent(false);
    }
  };

  const playAudioNote = async (noteId: string, text: string) => {
    if (isSynthesizing === noteId) return;
    
    if (currentPlaybackId === noteId) {
      audioPlaybackRef.current?.pause();
      setCurrentPlaybackId(null);
      return;
    }

    audioPlaybackRef.current?.pause();
    setIsSynthesizing(noteId);

    try {
      // Strip markdown symbols (+, *, #, etc) to prevent TTS from reading them literally
      const cleanText = text.replace(/[*#_>`~+-]/g, '').replace(/\[|\]|\(|\)/g, ' ');
      
      // Chunking text to avoid 413 error (Deepgram limit ~2000 chars)
      const chunks = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
      const combinedChunks: string[] = [];
      let currentChunk = "";
      
      for (const sentence of chunks) {
        if ((currentChunk + sentence).length > 1500) {
          combinedChunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
      if (currentChunk) combinedChunks.push(currentChunk);

      const audioBlobs: Blob[] = [];
      
      for (const chunk of combinedChunks) {
        const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text: chunk })
        });

        if (!response.ok) throw new Error(`TTS failed with status ${response.status}`);
        audioBlobs.push(await response.blob());
      }

      const finalBlob = new Blob(audioBlobs, { type: 'audio/mp3' });
      const url = URL.createObjectURL(finalBlob);
      
      const audio = new Audio(url);
      audioPlaybackRef.current = audio;
      setCurrentPlaybackId(noteId);
      
      audio.onended = () => {
        setCurrentPlaybackId(null);
        URL.revokeObjectURL(url);
      };
      
      await audio.play();
    } catch (err) {
      console.error('Audio Playback Error:', err);
    } finally {
      setIsSynthesizing(null);
    }
  };

  const addNote = async () => {
    if (!noteInput.trim() || !currentNotebookId || !user) return;
    const id = Math.random().toString(36).substring(7);
    const newNote: Note = {
      id,
      notebookId: currentNotebookId,
      content: noteInput,
      createdAt: Date.now(),
      authorId: user.id,
    };
    await setDoc(doc(db, 'notebooks', currentNotebookId, 'notes', id), newNote);
    setNoteInput('');
    setIsAddingNote(false);
  };

  if (!isAuthReady) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-4 space-y-8">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
          <div className="relative w-24 h-24 bg-slate-900 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
            <Brain className="w-12 h-12 text-indigo-400" />
          </div>
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h1 className="text-4xl font-display font-bold text-white tracking-tight">ACE</h1>
          <p className="text-indigo-400 font-bold uppercase tracking-widest text-[10px] mb-4">Adaptive Cognitive Engine</p>
          <p className="text-slate-400 text-lg">Your interactive AI research strategist. Organize, analyze, and master any subject with real-time reasoning.</p>
        </div>
        <button 
          onClick={login}
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-3 text-lg"
        >
          <Globe className="w-6 h-6" />
          Sign in with Google
        </button>
      </div>
    );
  }

  if (!currentNotebookId) {
    return (
      <div className="h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden flex flex-col">
        <header className="h-20 border-b border-white/5 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <NotebookIcon className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight">AI Notebook</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/5 rounded-2xl">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-indigo-500/20 overflow-hidden">
                {user.avatar ? <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" /> : user.avatar}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Pro Member</p>
              </div>
              <button onClick={logout} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-red-400 transition-all">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-12">
            {/* Hero Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-2">
                <h2 className="text-4xl font-display font-bold text-white tracking-tight">Welcome back, {user.name.split(' ')[0]}</h2>
                <p className="text-slate-400 text-lg">You have {notebooks.length} notebooks across your projects.</p>
              </div>
              <button 
                onClick={createNewNotebook}
                className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-3 self-start md:self-center"
              >
                <Plus className="w-5 h-5" />
                New Notebook
              </button>
            </div>

            {/* Featured Section */}
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
                  <div key={i} className="group p-6 bg-slate-900 border border-white/5 rounded-3xl hover:border-indigo-500/30 transition-all cursor-pointer relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all" />
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg", template.color)}>
                      <template.icon className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">{template.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{template.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Notebooks */}
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
                      className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all text-white placeholder:text-slate-600"
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
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl space-y-4">
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
                      className="group p-6 bg-slate-900 border border-white/5 rounded-[2rem] hover:border-indigo-500/30 transition-all cursor-pointer flex flex-col h-full relative overflow-hidden shadow-xl hover:shadow-indigo-500/5"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-indigo-500/10 transition-all" />
                      
                      <div className="flex items-start justify-between mb-6 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner group-hover:scale-110 transition-transform">
                          <NotebookIcon className="w-6 h-6" />
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotebook(notebook.id);
                            }}
                            className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-xl text-slate-500 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
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
                          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white">
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
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Left Sidebar: Sources */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 320 : 0 }}
        className="border-r border-white/5 bg-slate-900/50 flex flex-col relative z-20"
      >
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">ACE</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 hover:bg-white/5 rounded-md text-slate-400"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sources</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-600">{sources.length}</span>
                {sources.length > 0 && (
                  <button 
                    onClick={() => setSources([])}
                    className="text-[10px] font-bold text-red-500/50 hover:text-red-400 uppercase tracking-widest transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
            
            <button 
              onClick={() => setIsAddSourceModalOpen(true)}
              className="w-full p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center gap-3 text-indigo-400 hover:bg-indigo-600/20 transition-all group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              <span className="text-sm font-bold">Add Source</span>
            </button>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search sources..."
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            {isProcessingSource && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Processing...</p>
              </div>
            )}

            <div className="space-y-1">
              <AnimatePresence mode="popLayout">
                {sources.map(source => {
                  const Icon = {
                    text: FileText,
                    url: Globe,
                    audio: Mic,
                    video: Video
                  }[source.sourceType] || FileText;

                  return (
                    <motion.div
                      key={source.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className={cn(
                        "group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border border-transparent",
                        activeSourceId === source.id 
                          ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" 
                          : "hover:bg-white/5 text-slate-400 hover:text-slate-200"
                      )}
                      onClick={() => setActiveSourceId(source.id)}
                    >
                      <div className={cn(
                        "p-1.5 rounded-lg",
                        activeSourceId === source.id ? "bg-indigo-500/20" : "bg-slate-800"
                      )}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium truncate flex-1">{source.name}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeSource(source.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {sources.length === 0 && (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6 text-slate-600" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No sources yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-indigo-500/20 overflow-hidden">
              {user.avatar ? <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" /> : user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Pro Member</p>
            </div>
            <button onClick={logout} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-red-400 transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Toggle Sidebar Button (when closed) */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-50 p-2 bg-white border border-slate-200 rounded-lg shadow-md hover:bg-slate-50"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-slate-950">
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentNotebookId(null)}
                className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {isEditingTitle ? (
                <input 
                  autoFocus
                  type="text"
                  value={notebookTitle}
                  onChange={(e) => setNotebookTitle(e.target.value)}
                  onBlur={() => {
                    setIsEditingTitle(false);
                    setNewNotebookTitle(notebookTitle);
                    renameNotebook();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingTitle(false);
                      setNewNotebookTitle(notebookTitle);
                      renameNotebook();
                    }
                  }}
                  className="bg-white/5 border border-indigo-500/50 rounded-lg px-2 py-1 text-lg font-bold text-white focus:ring-0 outline-none"
                />
              ) : (
                <h1 
                  onClick={() => {
                    setIsEditingTitle(true);
                    setNotebookTitle(currentNotebook?.title || 'Untitled Notebook');
                  }}
                  className="font-display font-bold text-lg tracking-tight cursor-pointer hover:text-indigo-400 transition-colors"
                >
                  {currentNotebook?.title || 'Blank Canvas'}
                </h1>
              )}
              <div className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Active Engine</div>
            </div>
            
            <div className="h-8 w-px bg-white/5 mx-2" />
            
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setView('chat')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  view === 'chat' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </button>
              <button 
                onClick={() => setView('notebook')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  view === 'notebook' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Notebook
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex -space-x-2 mr-2">
              <div 
                className="w-8 h-8 rounded-full border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold text-white relative shadow-xl bg-indigo-600"
                title={`${user.name} (Online)`}
              >
                {user.avatar ? <img src={user.avatar} alt={user.name} className="rounded-full" referrerPolicy="no-referrer" /> : user.name[0]}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-950 rounded-full" />
              </div>
              <button className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button className="px-4 py-2 bg-white text-slate-950 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2 shadow-lg shadow-white/5">
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
            <button className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-all">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Middle Panel (Content) */}
          <div className="flex-1 flex flex-col border-r border-white/5 relative">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {view === 'chat' ? (
                /* Chat Interface */
                chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                      <div className="relative w-24 h-24 bg-slate-900 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
                        <Brain className="w-12 h-12 text-indigo-400" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-display font-bold text-white tracking-tight">{notebookTitle}</h2>
                      <p className="text-slate-500 text-sm font-medium">{sources.length} sources connected</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                      {[
                        { icon: Sparkles, label: 'Summarize all' },
                        { icon: FileBarChart, label: 'Key takeaways' },
                        { icon: HelpCircle, label: 'Generate quiz' },
                        { icon: Network, label: 'Create mind map' }
                      ].map(item => (
                        <button 
                          key={item.label}
                          onClick={() => setInput(item.label)}
                          className="p-4 text-left bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all group"
                        >
                          <item.icon className="w-5 h-5 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{item.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto w-full space-y-8">
                    {chatMessages.map((msg, i) => (
                      <motion.div 
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex gap-4",
                          msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-indigo-500/20">
                            <Brain className="w-6 h-6" />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[85%] p-5 rounded-3xl shadow-xl",
                          msg.role === 'user' 
                            ? "bg-indigo-600 text-white rounded-tr-none" 
                            : "bg-slate-900 border border-white/10 text-slate-200 rounded-tl-none prose prose-invert prose-sm max-w-none"
                        )}>
                          {msg.role === 'assistant' ? (
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            <p className="text-sm leading-relaxed font-medium">{msg.content}</p>
                          )}
                          <div className="mt-3 flex items-center gap-2 opacity-50">
                            <p className="text-[10px] font-bold uppercase tracking-tighter">
                              {msg.role === 'user' ? user.name : 'AI Assistant'} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                        <div className="bg-slate-900 border border-white/10 p-5 rounded-3xl rounded-tl-none">
                          <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )
              ) : (
                /* Notebook Interface */
                <div className="max-w-4xl mx-auto w-full space-y-8 pb-20">
                  {isGeneratingStudioContent ? (
                    <div className="py-20 text-center space-y-6">
                      <div className="relative inline-block">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
                        <div className="relative w-20 h-20 bg-slate-900 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
                          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">Generating Studio Content</h3>
                        <p className="text-slate-500 text-sm">Gemini is processing your sources to create something amazing...</p>
                      </div>
                    </div>
                  ) : studioContent ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
                            <Sparkles className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white tracking-tight capitalize">{studioContent.type} Generated</h3>
                            <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Studio Output</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={async () => {
                              if (!currentNotebookId || !user) return;
                              const id = Math.random().toString(36).substring(7);
                              const newNote: Note = {
                                id,
                                notebookId: currentNotebookId,
                                content: `Generated ${studioContent.type}:\n\n${studioContent.content}`,
                                createdAt: Date.now(),
                                authorId: user.id,
                              };
                              await setDoc(doc(db, 'notebooks', currentNotebookId, 'notes', id), newNote);
                            }}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300 transition-all flex items-center gap-2"
                          >
                            <StickyNote className="w-3.5 h-3.5" />
                            Save to Notes
                          </button>
                          <button 
                            onClick={() => setStudioContent(null)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300 transition-all flex items-center gap-2"
                          >
                            <X className="w-3.5 h-3.5" />
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {studioContent.content}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  ) : notebookContent ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-8"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
                            <BookOpen className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-display font-bold text-white tracking-tight">Study Guide</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Generated from {sources.length} sources</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setIsVersionHistoryOpen(true)}
                            className="p-2.5 hover:bg-white/5 rounded-xl text-slate-400 transition-all border border-white/5"
                            title="Version History"
                          >
                            <History className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={generateNotebookGuide}
                            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                            Regenerate
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl prose prose-invert prose-indigo max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {notebookContent}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20">
                      <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/5">
                        <BookOpen className="w-10 h-10 text-slate-700" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">No Study Guide Yet</h3>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto">Generate a comprehensive study guide from your sources to get started.</p>
                      </div>
                      <button 
                        onClick={generateNotebookGuide}
                        disabled={sources.length === 0 || isLoading}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate Study Guide
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat Input Area (Only visible in Chat view) */}
            {view === 'chat' && (
              <div className="p-6 bg-slate-950/80 backdrop-blur-md border-t border-white/5">
                <div className="max-w-3xl mx-auto relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur opacity-10 group-focus-within:opacity-25 transition-opacity" />
                  <div className="relative bg-slate-900 border border-white/10 rounded-3xl p-2 flex items-end gap-2 shadow-2xl">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask anything about your sources..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-4 min-h-[48px] max-h-[200px] resize-none text-white placeholder:text-slate-600"
                      rows={1}
                    />
                    <div className="flex items-center gap-1 p-1">
                      <button className="p-2 hover:bg-white/5 rounded-xl text-slate-500 transition-all">
                        <Mic className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isLoading}
                        className="p-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-center text-slate-600 mt-4 font-bold uppercase tracking-widest">
                  NotebookLM can be inaccurate; please double check its responses.
                </p>
              </div>
            )}
          </div>

          {/* Right Panel: Studio (Tools & Notes) */}
          <div className="w-96 flex flex-col bg-slate-900/30">
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Studio</h3>
                <button 
                  onClick={() => setIsInteractiveModeOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                  <Mic className="w-3 h-3" />
                  Go Interactive
                </button>
              </div>               <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'audio', icon: AudioLines, label: 'Audio', color: 'text-blue-400' },
                  { id: 'slides', icon: Presentation, label: 'Slides', color: 'text-orange-400' },
                  { id: 'video', icon: FileVideo, label: 'Video', color: 'text-red-400' },
                  { id: 'mindmap', icon: Network, label: 'Mind Map', color: 'text-purple-400' },
                  { id: 'report', icon: FileBarChart, label: 'Reports', color: 'text-emerald-400' },
                  { id: 'flashcards', icon: Layers, label: 'Flashcards', color: 'text-pink-400' },
                  { id: 'quiz', icon: HelpCircle, label: 'Quiz', color: 'text-yellow-400' },
                  { id: 'infographic', icon: BarChart3, label: 'Infographic', color: 'text-cyan-400' },
                  { id: 'datatable', icon: Table, label: 'Data Table', color: 'text-slate-400' },
                  { id: 'code', icon: Code2, label: 'Code Gen', color: 'text-indigo-400' },
                  { id: 'analysis', icon: Database, label: 'Analysis', color: 'text-orange-400' }
                ].map(tool => (
                  <button 
                    key={tool.id}
                    onClick={() => useStudioTool(tool.id)}
                    disabled={isGeneratingStudioContent}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group disabled:opacity-50"
                  >
                    <tool.icon className={cn("w-5 h-5 mb-2 group-hover:scale-110 transition-transform", tool.color)} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Library</h3>
                <button 
                  onClick={() => setIsAddingNote(true)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-indigo-400 transition-all border border-white/5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1">
                <AnimatePresence mode="popLayout">
                  {isAddingNote && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="mx-2 mb-4 p-4 bg-slate-800 border border-indigo-500/30 rounded-2xl shadow-2xl"
                    >
                      <textarea 
                        autoFocus
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Write a quick note..."
                        className="w-full bg-transparent border-none focus:ring-0 text-sm p-0 min-h-[100px] resize-none text-slate-200"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button 
                          onClick={() => setIsAddingNote(false)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={addNote}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                        >
                          Save
                        </button>
                      </div>
                    </motion.div>
                  )}
                  {notes.map(note => {
                    const isAudio = note.type === 'audio';
                    const isSlides = note.type === 'slides';
                    const title = note.content.split('\n')[0].replace(/[#*]/g, '').trim() || 'Untitled Content';
                    const pptUrlMatch = note.content.match(/View\/Edit Slides: (https:\/\/\S+)/);
                    const pptUrl = pptUrlMatch ? pptUrlMatch[1] : null;

                    return (
                      <motion.div 
                        key={note.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => {
                          if (!isAudio) setStudioContent({ type: note.type || 'note', content: note.content });
                        }}
                        className={cn(
                          "group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all hover:bg-white/5",
                          studioContent?.content === note.content ? "bg-white/5" : ""
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                            isAudio ? "bg-indigo-600/10 border-indigo-500/20" : "bg-white/5 border-white/5 group-hover:border-white/10"
                          )}>
                            {isAudio ? (
                              <div className="relative">
                                <AudioLines className="w-5 h-5 text-indigo-400" />
                                <Sparkles className="absolute -top-2 -right-2 w-2.5 h-2.5 text-indigo-300" />
                              </div>
                            ) : isSlides ? (
                              <div className="relative">
                                <Presentation className="w-5 h-5 text-orange-400" />
                                <Sparkles className="absolute -top-2 -right-2 w-2.5 h-2.5 text-orange-300" />
                              </div>
                            ) : note.type === 'datatable' ? (
                              <Table className="w-5 h-5 text-slate-400" />
                            ) : note.type === 'mindmap' ? (
                              <Network className="w-5 h-5 text-purple-400" />
                            ) : note.type === 'quiz' ? (
                              <HelpCircle className="w-5 h-5 text-yellow-400" />
                            ) : (
                              <StickyNote className="w-5 h-5 text-slate-500" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 pr-2">
                          <h4 className="text-sm font-bold text-white truncate leading-snug">
                            {title}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                              {note.type?.replace('_', ' ') || 'Note'}
                            </span>
                            <span className="w-0.5 h-0.5 rounded-full bg-slate-700" />
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                              {note.sourceCount || 0} sources
                            </span>
                            <span className="w-0.5 h-0.5 rounded-full bg-slate-700" />
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                              {new Date(note.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {isAudio ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                playAudioNote(note.id, note.content);
                              }}
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                currentPlaybackId === note.id 
                                  ? "bg-red-500 text-white" 
                                  : "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white"
                              )}
                            >
                              {isSynthesizing === note.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : currentPlaybackId === note.id ? (
                                <X className="w-4 h-4" />
                              ) : (
                                <PlayCircle className="w-5 h-5" />
                              )}
                            </button>
                          ) : isSlides && pptUrl ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(pptUrl, '_blank');
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-600/10 text-orange-400 hover:bg-orange-600 hover:text-white transition-all"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          ) : null}
                          
                          <div className="relative group/menu">
                            <button className="p-1.5 hover:bg-white/10 rounded-lg text-slate-600 transition-all opacity-0 group-hover:opacity-100">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 hidden group-hover/menu:block z-50 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-1 min-w-[120px]">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteDoc(doc(db, 'notebooks', currentNotebookId!, 'notes', note.id));
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {notes.length === 0 && !isAddingNote && (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/5">
                        <StickyNote className="w-8 h-8 text-slate-700" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-500">Your library is empty</p>
                        <p className="text-xs text-slate-600">Generated study aids will appear here.</p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Source Preview Panel (Optional) */}
      <AnimatePresence>
        {activeSourceId && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed inset-y-0 right-0 w-[450px] bg-slate-900 border-l border-white/10 shadow-2xl z-50 flex flex-col"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-950/50 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <FileText className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-sm text-white truncate block max-w-[280px]">
                    {sources.find(s => s.id === activeSourceId)?.name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Source Preview</span>
                </div>
              </div>
              <button 
                onClick={() => setActiveSourceId(null)}
                className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 prose prose-invert prose-sm max-w-none bg-slate-900/50">
              <pre className="whitespace-pre-wrap font-sans text-slate-300 leading-relaxed text-sm">
                {sources.find(s => s.id === activeSourceId)?.content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Version History Modal */}
      <AnimatePresence>
        {isVersionHistoryOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVersionHistoryOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Version History</h3>
                  <p className="text-xs text-slate-500">View and revert to previous versions</p>
                </div>
                <button 
                  onClick={() => setIsVersionHistoryOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/50">
                {notebookVersions.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/5">
                      <History className="w-8 h-8 text-slate-700" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">No versions saved yet.</p>
                  </div>
                ) : (
                  notebookVersions.map((version, idx) => (
                    <div 
                      key={version.id}
                      className="p-4 rounded-2xl border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center text-xs font-bold text-slate-400">
                            {version.authorName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">
                              {idx === 0 ? "Current Version" : `Version ${notebookVersions.length - idx}`}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                              {new Date(version.createdAt).toLocaleString()} • {version.authorName}
                            </p>
                          </div>
                        </div>
                        {idx !== 0 && (
                          <button 
                            onClick={() => revertToVersion(version)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                          >
                            Revert
                          </button>
                        )}
                      </div>
                      {version.note && (
                        <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/5 italic text-xs text-slate-400">
                          "{version.note}"
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="p-6 bg-slate-950 border-t border-white/5">
                <button 
                  onClick={() => setIsVersionHistoryOpen(false)}
                  className="w-full py-3 bg-white/5 border border-white/5 rounded-2xl text-sm font-bold text-slate-400 hover:bg-white/10 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Source Modal */}
      <AnimatePresence>
        {isAddSourceModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddSourceModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                      Create Audio and Video Overviews from
                    </h2>
                    <p className="text-slate-500 font-medium">your documents</p>
                  </div>
                  <button 
                    onClick={() => setIsAddSourceModalOpen(false)}
                    className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-slate-500 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-indigo-500/20 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <div className="relative bg-slate-950 border border-indigo-500/30 rounded-[1.5rem] p-3 flex items-center gap-3">
                    <Search className="w-5 h-5 text-slate-500 ml-2" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleWebSearch()}
                      placeholder="Search the web for new sources"
                      className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-slate-600 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300 flex items-center gap-2 transition-all">
                        <Globe className="w-3.5 h-3.5" />
                        Web
                        <ChevronLeft className="w-3 h-3 rotate-270" />
                      </button>
                      <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300 flex items-center gap-2 transition-all">
                        <Zap className="w-3.5 h-3.5 text-indigo-400" />
                        Fast Research
                        <ChevronLeft className="w-3 h-3 rotate-270" />
                      </button>
                      <button 
                        onClick={handleWebSearch}
                        disabled={!searchQuery.trim() || isProcessingSource}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-all disabled:opacity-50"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Drop Zone */}
                <div 
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-[2rem] p-12 text-center transition-all cursor-pointer group",
                    isDragActive ? "border-indigo-500 bg-indigo-500/5" : "border-white/5 hover:border-white/10"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-white">or drop your files</h3>
                    <p className="text-slate-500 text-sm">
                      pdf, images, docs, audio, <span className="underline decoration-slate-700">and more</span>
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-4 gap-4">
                  <button 
                    onClick={() => open()}
                    className="flex items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-white transition-all border border-white/5"
                  >
                    <Upload className="w-4 h-4" />
                    Upload files
                  </button>
                  <button 
                    onClick={() => {
                      const url = prompt("Enter website URL:");
                      if (url) {
                        setUrlInput(url);
                        addUrlSource();
                      }
                    }}
                    className="flex items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-white transition-all border border-white/5"
                  >
                    <LinkIcon className="w-4 h-4 text-red-500" />
                    Websites
                  </button>
                  <button className="flex items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-white transition-all border border-white/5">
                    <HardDrive className="w-4 h-4 text-slate-400" />
                    Drive
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) {
                          const id = Math.random().toString(36).substring(7);
                          const newSource: Source = {
                            id,
                            notebookId: currentNotebookId!,
                            name: `Pasted Text (${new Date().toLocaleTimeString()})`,
                            content: text,
                            type: 'text',
                            sourceType: 'text',
                            size: 0,
                            authorId: user!.id,
                            createdAt: Date.now(),
                          };
                          await setDoc(doc(db, 'notebooks', currentNotebookId!, 'sources', id), newSource);
                          setIsAddSourceModalOpen(false);
                        }
                      } catch (err) {
                        console.error("Clipboard error:", err);
                      }
                    }}
                    className="flex items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-white transition-all border border-white/5"
                  >
                    <Clipboard className="w-4 h-4 text-slate-400" />
                    Copied text
                  </button>
                </div>
              </div>

              {isProcessingSource && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                  <p className="text-sm font-bold text-white">Processing source...</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isInteractiveModeOpen && (
          <InteractiveTutor 
            onClose={() => setIsInteractiveModeOpen(false)}
            notebookId={currentNotebookId!}
            sources={sources.map(s => ({ name: s.name, content: s.content }))}
            userName={user?.name || 'Explorer'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
