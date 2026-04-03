import { useState, useEffect } from 'react';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from '../firebase';
import { User } from './useAuth';

export type SourceType = 'text' | 'url' | 'audio' | 'video';

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  ownerId: string;
  lastModified?: number;
}

export interface Source {
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

export interface ChatMessage {
  id: string;
  notebookId: string;
  role: 'user' | 'assistant';
  content: string;
  authorId?: string;
  createdAt: number;
}

export interface Note {
  id: string;
  notebookId: string;
  content: string;
  createdAt: number;
  authorId: string;
  type?: 'text' | 'audio' | 'slides' | 'video' | 'mindmap' | 'report' | 'flashcards' | 'quiz' | 'infographic' | 'datatable' | 'code' | 'analysis';
  sourceCount?: number;
}

export interface NotebookVersion {
  id: string;
  notebookId: string;
  content: string;
  createdAt: number;
  authorId: string;
  authorName: string;
  note?: string;
}

export function useNotebook(user: User | null) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [currentNotebookId, setCurrentNotebookId] = useState<string | null>(null);
  const [currentNotebook, setCurrentNotebook] = useState<Notebook | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebookVersions, setNotebookVersions] = useState<NotebookVersion[]>([]);
  const [notebookContent, setNotebookContent] = useState<string>('');

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
      setNotebooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notebook[]);
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

    const unsubNotebook = onSnapshot(doc(db, 'notebooks', currentNotebookId), (doc) => {
      if (doc.exists()) setCurrentNotebook({ id: doc.id, ...doc.data() } as Notebook);
    });

    const unsubSources = onSnapshot(query(collection(db, 'notebooks', currentNotebookId, 'sources'), orderBy('createdAt', 'asc')), (snapshot) => {
      setSources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Source[]);
    });

    const unsubChat = onSnapshot(query(collection(db, 'notebooks', currentNotebookId, 'chatMessages'), orderBy('createdAt', 'asc')), (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[]);
    });

    const unsubNotes = onSnapshot(query(collection(db, 'notebooks', currentNotebookId, 'notes'), orderBy('createdAt', 'desc')), (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Note[]);
    });

    const unsubVersions = onSnapshot(query(collection(db, 'notebooks', currentNotebookId, 'versions'), orderBy('createdAt', 'desc')), (snapshot) => {
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

  const createNewNotebook = async (title?: string, initialMessage?: string) => {
    if (!user) return;
    const id = Math.random().toString(36).substring(7);
    const newNotebook = {
      id,
      title: title || 'Untitled Notebook',
      ownerId: user.id,
      createdAt: Date.now(),
      lastModified: Date.now()
    };
    await setDoc(doc(db, 'notebooks', id), newNotebook);
    
    if (initialMessage) {
      const msgId = Math.random().toString(36).substring(7);
      await setDoc(doc(db, 'notebooks', id, 'chatMessages', msgId), {
        id: msgId,
        notebookId: id,
        role: 'assistant',
        content: initialMessage,
        createdAt: Date.now()
      });
    }

    setCurrentNotebookId(id);
    return id;
  };

  const deleteNotebook = async (id: string) => {
    await deleteDoc(doc(db, 'notebooks', id));
    if (currentNotebookId === id) setCurrentNotebookId(null);
  };

  const renameNotebook = async (id: string, newTitle: string) => {
    await updateDoc(doc(db, 'notebooks', id), {
      title: newTitle,
      lastModified: Date.now()
    });
  };

  const addSource = async (notebookId: string, source: Omit<Source, 'id' | 'createdAt'>) => {
    const id = Math.random().toString(36).substring(7);
    await setDoc(doc(db, 'notebooks', notebookId, 'sources', id), { 
      ...source, 
      id, 
      createdAt: Date.now() 
    });
  };

  const removeSource = async (notebookId: string, sourceId: string) => {
    await deleteDoc(doc(db, 'notebooks', notebookId, 'sources', sourceId));
  };

  const addChatMessage = async (notebookId: string, message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    const id = Math.random().toString(36).substring(7);
    await setDoc(doc(db, 'notebooks', notebookId, 'chatMessages', id), { 
      ...message, 
      id, 
      createdAt: Date.now() 
    });
  };

  const addNote = async (notebookId: string, note: Omit<Note, 'id' | 'createdAt'>) => {
    const id = Math.random().toString(36).substring(7);
    await setDoc(doc(db, 'notebooks', notebookId, 'notes', id), { 
      ...note, 
      id, 
      createdAt: Date.now() 
    });
  };

  const removeNote = async (notebookId: string, noteId: string) => {
    await deleteDoc(doc(db, 'notebooks', notebookId, 'notes', noteId));
  };

  const saveVersion = async (notebookId: string, version: Omit<NotebookVersion, 'id' | 'createdAt'>) => {
    const id = Math.random().toString(36).substring(7);
    await setDoc(doc(db, 'notebooks', notebookId, 'versions', id), { 
      ...version, 
      id, 
      createdAt: Date.now() 
    });
  };

  return {
    notebooks,
    currentNotebookId,
    setCurrentNotebookId,
    currentNotebook,
    sources,
    chatMessages,
    notes,
    notebookVersions,
    notebookContent,
    setNotebookContent,
    createNewNotebook,
    deleteNotebook,
    renameNotebook,
    addSource,
    removeSource,
    addChatMessage,
    addNote,
    removeNote,
    saveVersion
  };
}
