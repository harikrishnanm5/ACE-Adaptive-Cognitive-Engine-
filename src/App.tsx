import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Loader2,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';
import { cn } from './lib/utils';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useNotebook } from './hooks/useNotebook';
import { useAIServices } from './hooks/useAIServices';
import { motion } from 'motion/react';
import { stripMarkdown, truncateContext } from './lib/text';

// Components
import { Sidebar } from './components/Sidebar';
import { NotebookDashboard } from './components/NotebookDashboard';
import { LandingPage } from './components/LandingPage';
import { ChatContainer } from './components/ChatContainer';
import { StudioPanel } from './components/StudioPanel';
import { AddSourceModal } from './components/AddSourceModal';
import InteractiveTutor from './components/InteractiveTutor';

export default function App() {
  const { user, isAuthReady, login, logout } = useAuth();
  const {
    notebooks,
    currentNotebookId,
    setCurrentNotebookId,
    currentNotebook,
    sources,
    chatMessages,
    notes,
    notebookContent,
    setNotebookContent,
    createNewNotebook,
    deleteNotebook,
    renameNotebook,
    addSource,
    removeSource,
    addChatMessage,
    addNote,
    removeNote
  } = useNotebook(user);

  const { groqChatCompletion, groqProcessImage, transcribeAudio, lmStudioChatCompletion } = useAIServices();

  // Local State
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'created'>('recent');
  const [isProcessingSource, setIsProcessingSource] = useState(false);
  const [isGeneratingStudioContent, setIsGeneratingStudioContent] = useState(false);
  const [studioContent, setStudioContent] = useState<{ type: string; content: string } | null>(null);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [notebookTitle, setNotebookTitle] = useState('');
  const [isInteractiveModeOpen, setIsInteractiveModeOpen] = useState<string | boolean>(false);
  const [interactiveInitialContent, setInteractiveInitialContent] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<'local' | 'cloud'>('cloud');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Offline detection: Auto-switch to Local if internet is lost
  useEffect(() => {
    const handleConnectivityChange = () => {
      if (!navigator.onLine) {
        setAiProvider('local');
      }
    };
    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);
    return () => {
      window.removeEventListener('online', handleConnectivityChange);
      window.removeEventListener('offline', handleConnectivityChange);
    };
  }, []);

  const openInteractiveMode = (content: string | null = null) => {
    setInteractiveInitialContent(content);
    setIsInteractiveModeOpen(true);
  };

  // Sync notebook title
  useEffect(() => {
    if (currentNotebook) setNotebookTitle(currentNotebook.title);
  }, [currentNotebook]);

  // Handlers
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !currentNotebookId || !user) return;

    await addChatMessage(currentNotebookId, {
      notebookId: currentNotebookId,
      role: 'user',
      content: input,
      authorId: user.id
    });
    
    setInput('');
    setIsLoading(true);

    try {
      const sourceContext = sources.map(s => `Source: ${s.name}\nContent: ${s.content}`).join('\n\n---\n\n');
      
      // Strict Provider Enforcement (No Fallback)
      let res;
      if (aiProvider === 'local') {
        const truncatedContext = truncateContext(sourceContext);
        const prompt = `Context from sources:\n${truncatedContext}\n\nUser Question: ${input}\n\nPlease answer the question based ONLY on the provided sources. If the answer is not in the sources, say so.`;
        const localMessages = [
          { role: "system", content: "You are ACE (Adaptive Cognitive Engine). Provide concise, accurate answers based on the context." },
          { role: "user", content: prompt }
        ];
        res = await lmStudioChatCompletion(localMessages);
      } else {
        const prompt = `Context from sources:\n${sourceContext}\n\nUser Question: ${input}\n\nPlease answer the question based ONLY on the provided sources. If the answer is not in the sources, say so.`;
        const cloudMessages = [
          { role: "system", content: "You are ACE (Adaptive Cognitive Engine). Provide concise, accurate answers based on context." },
          { role: "user", content: prompt }
        ];
        res = await groqChatCompletion(cloudMessages);
      }

      const responseText = res.choices[0]?.message?.content;
      if (responseText) {
        await addChatMessage(currentNotebookId, {
          notebookId: currentNotebookId,
          role: 'assistant',
          content: responseText
        });
      }
    } catch (err: any) {
      console.error(err);
      if (aiProvider === 'local') {
        const errorMsg = "LM Studio is unreachable. Make sure it is running on http://localhost:1234 and a model is loaded.";
        await addChatMessage(currentNotebookId, { notebookId: currentNotebookId, role: 'assistant', content: errorMsg });
      } else if (err?.message?.includes('exhausted') || err?.message?.includes('wait')) {
        setShowRateLimitModal(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!currentNotebookId || !user) return;

    for (const file of acceptedFiles) {
      setIsProcessingSource(true);
      try {
        let content = '';
        let sourceType: any = 'text';
        const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        const isImage = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/');
        const isVideo = file.type.startsWith('video/');
        const isText = file.type.startsWith('text/') || file.name.endsWith('.md');

        if (isText) {
          content = await file.text();
          sourceType = 'text';

        } else if (isPDF) {
          sourceType = 'pdf';
          // Use pdfjs-dist to extract text without any AI API
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const pages: string[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            pages.push(textContent.items.map((item: any) => item.str).join(' '));
          }
          content = pages.join('\n\n');
          if (!content.trim()) content = 'No readable text found in PDF.';

        } else if (isImage) {
          sourceType = 'image';
          const base64 = await fileToBase64(file);
          content = await groqProcessImage(
            base64, file.type,
            'Describe this image in full detail. Extract all visible text, labels, data, structures, and concepts for use as a research source.'
          ) || 'Could not analyze image.';

        } else if (isAudio) {
          sourceType = 'audio';
          content = await transcribeAudio(file, file.name) || 'Could not transcribe audio.';

        } else if (isVideo) {
          sourceType = 'video';
          // Extract audio track from video and send to Whisper
          const audioBlob = await extractAudioFromVideo(file);
          content = await transcribeAudio(audioBlob, file.name.replace(/\.[^.]+$/, '.webm')) || 'Could not transcribe video.';
        }

        await addSource(currentNotebookId, {
          notebookId: currentNotebookId,
          name: file.name,
          content,
          type: file.type,
          sourceType,
          size: file.size,
          authorId: user.id
        });
      } catch (err) {
        console.error(`❌ Error processing file "${file.name}":`, err);
        if (err instanceof Error) {
          console.error("Original error message:", err.message);
          console.error("Stack trace:", err.stack);
        }
      } finally {
        setIsProcessingSource(false);
      }
    }
  }, [currentNotebookId, user, addSource, groqProcessImage, transcribeAudio]);

  // Helper: convert File to base64 string (without data URL prefix)
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve((e.target?.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Helper: use Web Audio API to extract audio from video
  async function extractAudioFromVideo(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.onloadedmetadata = async () => {
        const audioContext = new AudioContext();
        const arrayBuffer = await file.arrayBuffer();
        try {
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
          const source = offlineCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(offlineCtx.destination);
          source.start();
          const rendered = await offlineCtx.startRendering();
          // Convert to WAV blob
          const wavBuffer = audioBufferToWav(rendered);
          resolve(new Blob([wavBuffer], { type: 'audio/wav' }));
        } catch (e) {
          // Fallback: send video file directly to Whisper (it supports mp4/mkv)
          resolve(file);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video load failed')); };
      video.load();
    });
  }

  // Helper: minimal AudioBuffer → WAV ArrayBuffer
  function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + length, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true); writeStr(36, 'data'); view.setUint32(40, length, true);
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    return arrayBuffer;
  }

  const addUrlSource = async () => {
    if (!urlInput.trim() || !currentNotebookId || !user) return;
    setIsProcessingSource(true);
    try {
      const res = await groqChatCompletion([
        { role: "system", content: "You are a research assistant. Summarize and extract the key content from the given URL for a user's notebook." },
        { role: "user", content: `Please summarize the content of this URL: ${urlInput}` }
      ]);
      const content = res.choices[0]?.message?.content || 'Failed to fetch content.';
      await addSource(currentNotebookId, {
        notebookId: currentNotebookId,
        name: urlInput.replace(/^https?:\/\//, '').split('/')[0],
        content,
        type: 'text/url',
        sourceType: 'url',
        size: 0,
        authorId: user.id
      });
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
      const res = await groqChatCompletion([
        { role: "system", content: "You are a research assistant. Provide a comprehensive, detailed summary of the requested topic." },
        { role: "user", content: `Research and summarize the following topic for my notebook: ${searchQuery}` }
      ]);
      const content = res.choices[0]?.message?.content || 'No content found.';
      await addSource(currentNotebookId, {
        notebookId: currentNotebookId,
        name: searchQuery,
        content,
        type: 'text/search',
        sourceType: 'url',
        size: 0,
        authorId: user.id
      });
      setSearchQuery('');
      setIsAddSourceModalOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessingSource(false);
    }
  };

  const useStudioTool = async (toolType: string) => {
    if (sources.length === 0) return alert("Add sources first.");
    setIsGeneratingStudioContent(true);
    
    try {
      let sourceContext = sources.map(s => `Source: ${s.name}\nContent: ${s.content}`).join('\n\n');
      let prompt = "";
      switch (toolType) {
        case 'flashcards': prompt = "generate exactly 15 high-quality Q&A flashcards based on the sources. Format as a JSON array of objects with 'front' and 'back' properties. ONLY return the raw JSON array without markdown wrapping."; break;
        case 'quiz': prompt = "generate a 10-question multiple-choice interactive quiz. Format as a JSON array of objects with 'question', 'options' (array of strings), and 'correctAnswer' (index). ONLY return the raw JSON array without markdown."; break;
        case 'mindmap': prompt = "Create a detailed, hierarchical Mind Map of the core concepts from the sources. Return ONLY a nested Markdown bulleted list (using dashes like - Root,   - Branch,     - Leaf). Do NOT use Mermaid syntax or headings (#). Ensure the hierarchy is deep, logical, and comprehensive."; break;
        case 'slides': prompt = "Generate a comprehensive slide deck based on the sources. Return a JSON array (NO markdown) where each slide is: { \"title\": string, \"subtitle\": string (optional short tagline), \"bullets\": string[] (3-5 concise points), \"notes\": string (speaker notes), \"accent\": string (a hex color like #6366f1 or #10b981 that fits the topic) }. Include a title slide, content slides, and a summary slide."; break;
        case 'reports': prompt = "generate a highly detailed study guide and analytical report covering the material. Do NOT generate code. Return beautifully structured plain text with clear headings, summaries, and bullet points."; break;
        case 'data_table': break; // removed
        default: prompt = `perform a ${toolType} structure analysis of these sources.`;
      }

      let resText = "";
      let toolName = toolType;

      if (toolType === 'audio') {
        if (aiProvider === 'local') {
          const truncatedContext = truncateContext(sourceContext);
          const messages = [
            { role: "system", content: "You are a professional audio scriptwriter. Create a smooth, engaging monologue analyzing the source material. NO markdown, NO timestamps. The script must flow perfectly for a single voice speaking. The FIRST line MUST be just a compelling title for this talk." },
            { role: "user", content: `SOURCE MATERIAL:\n${truncatedContext}\n\nTASK: Generate the audio script now.` }
          ];
          const completion = await lmStudioChatCompletion(messages);
          resText = completion.choices?.[0]?.message?.content || "";
        } else {
          // Step 1: Deep analysis
          const analysis = await groqChatCompletion([
            { role: "system", content: "You are a research analyst. Perform an exhaustive analysis of the provided source material. Extract all key facts, data points, and concepts." },
            { role: "user", content: `SOURCE MATERIAL:\n${sourceContext}` }
          ]);
          const analysisText = analysis.choices[0]?.message?.content || "";

          // Step 2: Script generation
          const completion = await groqChatCompletion([
            { role: "system", content: "You are a professional audio scriptwriter. Create a smooth, engaging monologue based on the analysis. NO markdown stars (**), NO headers (#), NO speaker tags, NO timestamps. The script must be high-density knowledge but flow perfectly for a single voice speaking. The FIRST line MUST be just a compelling title for this talk, nothing else." },
            { role: "user", content: `RESEARCH ANALYSIS:\n${analysisText}\n\nTASK: Generate the audio script now.` }
          ]);
          resText = completion.choices[0]?.message?.content || "";
        }  
        // Use Global Strip Markdown Utility
        resText = stripMarkdown(resText);

        const lines = resText.split('\n');
        if (lines.length > 0) {
          toolName = lines[0].replace(/Title: /i, '').trim();
          resText = lines.slice(1).join('\n').trim();
        }
      } else {
        const truncatedContext = aiProvider === 'local' ? truncateContext(sourceContext) : sourceContext;
        const messages = [
          { role: "system", content: "You are ACE. Use ONLY the provided material." },
          { role: "user", content: `SOURCE MATERIAL:\n${truncatedContext}\n\nTASK: ${prompt}` }
        ];

        let completion;
        if (aiProvider === 'local') {
          completion = await lmStudioChatCompletion(messages);
        } else {
          completion = await groqChatCompletion(messages);
        }
        resText = completion.choices[0]?.message?.content || "";
      }

      // Slides are now generated natively by pptxgenjs in StudioPanel - no backend needed

      setStudioContent({ type: toolType, content: resText });
      await addNote(currentNotebookId!, {
        notebookId: currentNotebookId!,
        content: `Title: ${toolName}\n\n${resText}`,
        authorId: user!.id,
        type: toolType as any,
        sourceCount: sources.length
      });
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('exhausted') || err?.message?.includes('wait') || err?.message?.includes('429')) {
        setShowRateLimitModal(true);
      }
    } finally {
      setIsGeneratingStudioContent(false);
    }
  };

  const generateNotebookGuide = async () => {
    if (sources.length === 0) return;
    setIsLoading(true);
    try {
      const sourceContext = sources.map(s => `Source: ${s.name}\nContent: ${s.content}`).join('\n\n');
      const completion = await groqChatCompletion([
        { role: "user", content: `Generate a study guide from:\n${sourceContext}` }
      ]);
      const res = completion.choices[0]?.message?.content;
      if (res) {
        setNotebookContent(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Rendering
  if (!isAuthReady) return <div className="h-screen bg-[#0F1113] flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  if (!user) return <LandingPage login={login} />;
  if (!currentNotebookId) return (
    <NotebookDashboard 
      user={user} notebooks={notebooks} dashboardSearchQuery={dashboardSearchQuery}
      setDashboardSearchQuery={setDashboardSearchQuery} sortBy={sortBy} setSortBy={setSortBy}
      createNewNotebook={createNewNotebook} deleteNotebook={deleteNotebook}
      setCurrentNotebookId={setCurrentNotebookId} logout={logout}
    />
  );

  return (
    <div className="flex h-screen bg-[#0F1113] text-slate-200 font-sans overflow-hidden">
      {/* Column 1: Sources */}
      <Sidebar 
        sources={sources} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
        setIsAddSourceModalOpen={setIsAddSourceModalOpen} isProcessingSource={isProcessingSource}
        activeSourceId={activeSourceId} setActiveSourceId={setActiveSourceId} removeSource={(id) => removeSource(currentNotebookId, id)}
        setSources={() => {}}
      />

      {/* Main Content: Column 2 & 3 */}
      <main className="flex-1 flex min-w-0 relative bg-[#0F1113]">
        {/* Toggle Button for Sidebar when closed */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-5 p-1.5 hover:bg-white/5 rounded-lg text-slate-400 z-50 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Triple Column Layout Container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Column 2: Chat */}
          <div className="flex-[1.5] min-w-0 h-full">
            <ChatContainer 
              chatMessages={chatMessages} 
              user={user} 
              isLoading={isLoading} 
              chatEndRef={chatEndRef} 
              input={input}
              setInput={setInput}
              handleSendMessage={handleSendMessage}
              sourcesCount={sources.length}
              aiProvider={aiProvider}
              setAiProvider={setAiProvider}
            />
          </div>

          {/* Column 3: Studio */}
          <div className="flex-1 min-w-0 h-full">
            <StudioPanel 
              isGeneratingStudioContent={isGeneratingStudioContent} 
              studioContent={studioContent}
              setStudioContent={setStudioContent} 
              currentNotebookId={currentNotebookId} 
              notebookTitle={currentNotebook?.title}
              user={user}
              sources={sources} 
              notes={notes}
              addNote={addNote}
              removeNote={removeNote}
              notebookContent={notebookContent}
              generateNotebookGuide={generateNotebookGuide} 
              setIsVersionHistoryOpen={setIsVersionHistoryOpen} 
              isLoading={isLoading}
              useStudioTool={useStudioTool}
              setIsInteractiveModeOpen={(noteContent?: string) => openInteractiveMode(typeof noteContent === 'string' ? noteContent : null)}
            />
          </div>
        </div>

        {/* Global Controls Overlay */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 backdrop-blur-md pointer-events-auto">
          <button onClick={() => setCurrentNotebookId(null)} className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="h-3 w-px bg-white/10 mx-1" />
          {isEditingTitle ? (
            <input
              autoFocus
              value={notebookTitle}
              onChange={e => setNotebookTitle(e.target.value)}
              onBlur={async () => { if (notebookTitle.trim()) await renameNotebook(currentNotebookId!, notebookTitle.trim()); setIsEditingTitle(false); }}
              onKeyDown={async e => {
                if (e.key === 'Enter') { if (notebookTitle.trim()) await renameNotebook(currentNotebookId!, notebookTitle.trim()); setIsEditingTitle(false); }
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              className="bg-transparent border-b border-indigo-500 text-xs font-bold text-white outline-none max-w-[160px] pb-0.5"
            />
          ) : (
            <h1
              onClick={() => { setNotebookTitle(currentNotebook?.title || ''); setIsEditingTitle(true); }}
              className="text-xs font-bold text-slate-300 truncate max-w-[150px] cursor-pointer hover:text-white"
              title="Click to rename"
            >
              {currentNotebook?.title}
            </h1>
          )}
          <div className="h-3 w-px bg-white/10 mx-1" />
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="p-1 hover:bg-red-500/10 rounded text-slate-500 hover:text-red-400 transition-colors"
            title="Delete Notebook"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </main>

      <AddSourceModal 
        isOpen={isAddSourceModalOpen} onClose={() => setIsAddSourceModalOpen(false)}
        urlInput={urlInput} setUrlInput={setUrlInput} addUrlSource={addUrlSource}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleWebSearch={handleWebSearch}
        isProcessingSource={isProcessingSource} onDrop={onDrop}
        sourceCount={sources.length}
      />

      {isInteractiveModeOpen && (
        <InteractiveTutor 
          onClose={() => {
            setIsInteractiveModeOpen(false);
            setInteractiveInitialContent(null);
          }} 
          notebookId={currentNotebookId}
          sources={sources}
          userName={user.name}
          initialContent={interactiveInitialContent || undefined}
          aiProvider={aiProvider}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && currentNotebookId && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#1E1F22] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative"
          >
            <button 
              onClick={() => setShowDeleteModal(false)}
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
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    await deleteNotebook(currentNotebookId);
                    setShowDeleteModal(false);
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

      {showRateLimitModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-[#121316] border border-orange-500/20 rounded-3xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl -mr-16 -mt-16" />
            <button 
              onClick={() => setShowRateLimitModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center text-center space-y-5 relative z-10">
              <div className="w-20 h-20 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/10">
                <Loader2 className="w-10 h-10 animate-spin" />
              </div>
              <div>
                <h3 className="text-2xl font-display font-bold text-white mb-2 tracking-tight">AI Servers Busy</h3>
                <p className="text-slate-400 leading-relaxed">
                  We are experiencing extremely high traffic right now and our AI providers are temporarily rate-limited. 
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl w-full border border-white/5">
                <p className="text-sm font-bold tracking-widest text-orange-400 uppercase">
                  Please wait ~60 Seconds
                </p>
                <p className="text-xs text-slate-500 mt-1">Your limits will automatically continuously refresh.</p>
              </div>
              <button 
                onClick={() => setShowRateLimitModal(false)}
                className="w-full py-4 mt-2 rounded-xl font-bold bg-white/5 text-white hover:bg-white/10 transition-colors border border-white/10"
              >
                Understood
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
