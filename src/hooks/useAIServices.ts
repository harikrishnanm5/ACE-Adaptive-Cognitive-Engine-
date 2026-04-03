import Groq from 'groq-sdk';
// Using fetch for Deepgram to avoid SDK bundling/versioning issues in browser while using the latest nova-3 model

// ===== Groq Key Rotation System =====
const GROQ_API_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
  process.env.GROQ_API_KEY_6,
].filter(Boolean) as string[];

let currentGroqKeyIndex = 0;

function getGroqClient(): Groq {
  return new Groq({ apiKey: GROQ_API_KEYS[currentGroqKeyIndex], dangerouslyAllowBrowser: true });
}

function rotateGroqKey(): boolean {
  const nextIndex = currentGroqKeyIndex + 1;
  if (nextIndex < GROQ_API_KEYS.length) {
    currentGroqKeyIndex = nextIndex;
    console.log(`🔄 Groq key rotated → using key #${nextIndex + 1} of ${GROQ_API_KEYS.length}`);
    return true;
  }
  return false;
}

// ===== Groq Chat Completion (text) =====
export async function groqChatCompletion(messages: any[], model = "llama-3.3-70b-versatile", temperature = 0.5) {
  let lastError: any;
  for (let attempt = 0; attempt < GROQ_API_KEYS.length; attempt++) {
    try {
      const client = getGroqClient();
      const completion = await client.chat.completions.create({ messages, model, temperature });
      return completion;
    } catch (error: any) {
      lastError = error;
      if (error?.status === 429 || error?.message?.includes('rate_limit')) {
        console.warn(`⚠️ Groq key #${currentGroqKeyIndex + 1} rate-limited.`);
        if (!rotateGroqKey()) {
          currentGroqKeyIndex = 0;
          throw new Error(`All ${GROQ_API_KEYS.length} Groq API keys are rate-limited. Please wait a few minutes and try again.`);
        }
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

// ===== Groq Vision (image analysis via llama-4-scout multimodal) =====
export async function groqProcessImage(base64Data: string, mimeType: string, prompt: string): Promise<string> {
  let lastError: any;
  for (let attempt = 0; attempt < GROQ_API_KEYS.length; attempt++) {
    try {
      const client = getGroqClient();
      const completion = await client.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
              { type: "text", text: prompt }
            ] as any,
          },
        ],
        temperature: 0.3,
      });
      return completion.choices[0]?.message?.content || "";
    } catch (error: any) {
      lastError = error;
      if (error?.status === 429 || error?.message?.includes('rate_limit')) {
        if (!rotateGroqKey()) { currentGroqKeyIndex = 0; throw new Error("All Groq keys rate-limited for vision."); }
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

// ===== Deepgram STT (audio/video transcription via REST API) =====
export async function deepgramTranscribeAudio(audioBlob: Blob): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("Deepgram API Key not found");

  try {
    // Using nova-3 as requested for maximum speed and accuracy
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': audioBlob.type || 'audio/webm'
      },
      body: audioBlob
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepgram Transcription failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result.results?.channels[0]?.alternatives[0]?.transcript || "";
  } catch (err) {
    console.error("Deepgram Transcription failed:", err);
    throw err;
  }
}

// ===== Deepgram STT (URL transcription via REST API) =====
export async function deepgramTranscribeUrl(url: string): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("Deepgram API Key not found");

  try {
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepgram URL Transcription failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result.results?.channels[0]?.alternatives[0]?.transcript || "";
  } catch (err) {
    console.error("Deepgram URL Transcription failed:", err);
    throw err;
  }
}

// ===== Transcription Service (Deepgram primary, Groq fallback) =====
export async function transcribeAudio(audioBlob: Blob, filename = "audio.webm"): Promise<string> {
  console.log(`🎙️ Transcribing ${filename} (${audioBlob.size} bytes)...`);
  
  try {
    return await deepgramTranscribeAudio(audioBlob);
  } catch (err) {
    console.warn("⚠️ Deepgram failed, falling back to Groq Whisper:", err);
    return await groqTranscribeAudio(audioBlob, filename);
  }
}

// ===== Groq Whisper (backup transcription) =====
export async function groqTranscribeAudio(audioBlob: Blob, filename = "audio.webm"): Promise<string> {
  let lastError: any = new Error("No transcription could be completed (available keys exhausted or model error).");
  for (let attempt = 0; attempt < GROQ_API_KEYS.length; attempt++) {
    try {
      const client = getGroqClient();
      const file = new File([audioBlob], filename, { type: audioBlob.type || 'audio/webm' });
      const transcription = await client.audio.transcriptions.create({
        file,
        model: "whisper-large-v3",
        response_format: "text",
      });
      return typeof transcription === 'string' ? transcription : (transcription as any).text || "";
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ Groq key #${currentGroqKeyIndex + 1} attempt failed:`, error.message || error);
      if (!rotateGroqKey()) {
        currentGroqKeyIndex = 0;
        break;
      }
    }
  }
  throw lastError;
}

// ===== Deepgram TTS (audio generation) =====
function chunkText(text: string, maxLength = 2000): string[] {
  const chunks: string[] = [];
  let current = "";
  // Split by common delimiters while keeping context
  const segments = text.split(/(?<=[.!?\n])\s+/);
  
  for (const segment of segments) {
    if (segment.length > maxLength) {
      // Emergency fallback for ultra-long sentences
      const subSegments = segment.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
      for (const s of subSegments) chunks.push(s);
      continue;
    }
    if (current.length + segment.length > maxLength) {
      if (current) chunks.push(current.trim());
      current = segment;
    } else {
      current += (current ? " " : "") + segment;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

export async function deepgramTTS(text: string): Promise<Blob> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("Deepgram API Key not found");

  const chunks = chunkText(text);
  const blobs: Blob[] = [];

  for (const chunk of chunks) {
    const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: chunk })
    });

    if (!response.ok) throw new Error(`Deepgram TTS failed on chunk: ${chunk.substring(0, 20)}...`);
    const blob = await response.blob();
    blobs.push(blob);
  }

  return new Blob(blobs, { type: 'audio/mpeg' });
}

// ===== LM Studio Helpers (Local AI) =====
async function getLMStudioModel(): Promise<string> {
  const preferredModel = "qwen2.5-coder-3b-instruct";
  try {
    const response = await fetch('http://localhost:1234/v1/models');
    if (!response.ok) return preferredModel;
    const data = await response.json();
    
    // 1. Try to find the exact preferred model
    const foundExact = data.data?.find((m: any) => m.id.includes(preferredModel));
    if (foundExact) return foundExact.id;
    
    // 2. Return the first available model if preferred not found
    return data.data?.[0]?.id || preferredModel;
  } catch {
    return preferredModel;
  }
}

export async function lmStudioChatCompletion(messages: any[]) {
  try {
    // 1. Auto-detect the loaded model (prioritizing Qwen2.5-Coder)
    const loadedModel = await getLMStudioModel();
    
    // 2. Send the completion request with strict CORS settings
    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      mode: 'cors', // Ensure CORS is handled
      body: JSON.stringify({
        model: loadedModel,
        messages,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ LM Studio Error (${response.status}):`, errorData);
      throw new Error(`LM Studio rejected the request (Status ${response.status}). Check if the correct model is loaded.`);
    }
    return await response.json();
  } catch (error: any) {
    console.error('❌ LM Studio Connection Failed:', error);
    throw new Error(error.message || 'LM Studio unreachable. Ensure the local server is running on port 1234.');
  }
}

export function useAIServices() {
  return {
    groqChatCompletion,
    groqProcessImage,
    groqTranscribeAudio,
    transcribeAudio,
    deepgramTTS,
    lmStudioChatCompletion,
  };
}
