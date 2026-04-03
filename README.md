# ACE: Adaptive Cognitive Engine

![ACE Banner](https://github.com/user-attachments/assets/ae28e622-4a0b-410a-8bf7-1091d264defa)

**ACE (Adaptive Cognitive Engine)** is a high-fidelity, hybrid AI research laboratory designed to transform raw information into structured knowledge at lightning speed. By combining the massive context processing of **Gemini 1.5 Flash** with the ultra-low latency reasoning of **Groq**, ACE provides a premium academic and professional research experience.

---

## 💎 Primary Features

### 🧠 Hybrid "Power" Intelligence
*   **Gemini 1.5 Flash**: Ingests complex sources including YouTube videos, web searches, and large documents for deep context analysis.
*   **Groq (Llama 3.3 70B)**: Drives the chat and reasoning engine with sub-500ms response times for a "thought-speed" interaction.
*   **Deepgram Aura & Nova-2**: Powers high-fidelity text-to-speech (TTS) and real-time speech-to-text (STT) for natural human-AI interaction.

### 🎙️ Audio Overviews (Podcast Mode)
*   Transform your research into a professional 2-person educational podcast script.
*   **Smart Synthesis**: Uses Deepgram's Aura model with automated text-chunking to handle scripts of any length without errors.
*   **Persistent Playback**: Saved directly to your library with high-fidelity animated playback controls.

### 📽️ Presenton Slide Integration
*   Generate full professional presentations from your sources with a single click.
*   **Direct Sync**: ACE connects to **Presenton.ai** to build real `.pptx` files.
*   **Live Editor**: View and edit your generated slides instantly via a direct editor link.

### 🗣️ Interactive Mode
*   Full-screen, real-time voice conversation with ACE.
*   Ask questions in the middle of a lesson, get instant vocal feedback, and learn hands-free.

### 📚 High-Fidelity Library
*   Redesigned row-based interface matching modern professional research tools.
*   Categorized icons for all outputs: Audio, Slides, Quizzes, Reports, Mindmaps, and Tables.
*   Contextual metadata tracking source counts and creation dates.

---

## 🛠 Tech Stack
*   **Frontend**: React 19 (TSX), Vite, Tailwind CSS (v4), Framer Motion.
*   **AI SDKs**: Groq SDK, Google Generative AI (@google/genai), Deepgram SDK.
*   **Backend/Database**: Firebase (Authentication, Firestore, Storage).
*   **APIs**: Presenton API (Slides), Deepgram Speak (TTS), Groq (LLM).

---

## 🚀 Quick Start

1.  **Environment Setup**:
    Create a `.env` file with your API keys:
    ```env
    GEMINI_API_KEY=your_key
    GROQ_API_KEY=your_key
    DEEPGRAM_API_KEY=your_key
    PRESENTON_API_KEY=your_key
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

---

## 🏛 UI Architecture
ACE follows a "Professional Research Laboratory" aesthetic, utilizing **glassmorphism**, **dynamic animations**, and a **high-density metadata sidebar** to ensure that tools are always within reach without cluttering the workbench.

---

> [!NOTE]
> ACE is an AI-powered tool. Always verify synthesized outputs against the original sources.
