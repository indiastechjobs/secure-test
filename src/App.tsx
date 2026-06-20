import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  Sparkles,
  Bot,
  User,
  Settings,
  Volume2,
  VolumeX,
  Share2,
  Code,
  GraduationCap,
  PenTool,
  Briefcase,
  HelpCircle,
  Menu,
  X,
  RefreshCw,
  ChevronRight,
  Info,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Message, ChatSession, Persona } from "./types";
import { DEFAULT_PERSONAS } from "./data/personas";
import { MarkdownView } from "./components/MarkdownView";

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPersonaId, setSelectedPersonaId] = useState("general");
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize and load sessions from LocalStorage
  useEffect(() => {
    const storedSessions = localStorage.getItem("gemini_chat_sessions");
    const storedActiveId = localStorage.getItem("gemini_chat_active_id");

    if (storedSessions) {
      try {
        const parsed = JSON.parse(storedSessions);
        setSessions(parsed);
        if (storedActiveId && parsed.some((s: any) => s.id === storedActiveId)) {
          setActiveSessionId(storedActiveId);
        } else if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse stored chat sessions:", e);
        createNewSession("general");
      }
    } else {
      // Create first default session
      createNewSession("general");
    }
  }, []);

  // Save sessions to LocalStorage on modifications
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("gemini_chat_sessions", JSON.stringify(sessions));
    } else {
      localStorage.removeItem("gemini_chat_sessions");
    }
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem("gemini_chat_active_id", activeSessionId);
      // Synchronize selected persona id with the loaded session persona
      const currentSession = sessions.find((s) => s.id === activeSessionId);
      if (currentSession) {
        setSelectedPersonaId(currentSession.personaId);
      }
    } else {
      localStorage.removeItem("gemini_chat_active_id");
    }
  }, [activeSessionId, sessions]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessions, isGenerating]);

  // Adjust textarea height on word wraps
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputText]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const currentPersona = DEFAULT_PERSONAS.find((p) => p.id === selectedPersonaId) || DEFAULT_PERSONAS[0];

  const handlePersonaChange = (personaId: string) => {
    setSelectedPersonaId(personaId);
    if (activeSession) {
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? { ...s, personaId } : s))
      );
    }
  };

  const createNewSession = (personaId = "general") => {
    const newSessionId = `session-${Date.now()}`;
    const persona = DEFAULT_PERSONAS.find((p) => p.id === personaId) || DEFAULT_PERSONAS[0];
    const newSession: ChatSession = {
      id: newSessionId,
      title: `${persona.emoji} New ${persona.name} Chat`,
      messages: [],
      personaId: personaId,
      createdAt: new Date().toLocaleTimeString(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSessionId);
    setSelectedPersonaId(personaId);
    setErrorMessage(null);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);

    if (activeSessionId === id) {
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      } else {
        // Automatically spawn a new one to prevent blank state
        createNewSession("general");
      }
    }
  };

  // Speaks using window.speechSynthesis
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // cancel current speech

    // Clean markdown before speaking
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "[Code block omitted]")
      .replace(/[*#`_\-]/g, "")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(utterance);
  };

  const handleSpeakToggle = () => {
    if (isSpeakerEnabled) {
      window.speechSynthesis?.cancel();
    }
    setIsSpeakerEnabled(!isSpeakerEnabled);
  };

  const renameSession = (id: string, currentTitle: string) => {
    const cleanTitle = currentTitle.replace(/^[\u0000-\uFFFF]\s*/, ""); // Strip leading emoji
    const newTitle = prompt("Enter a new title for this conversation:", cleanTitle);
    if (newTitle && newTitle.trim()) {
      const activePers = DEFAULT_PERSONAS.find((p) => p.id === activeSession?.personaId) || DEFAULT_PERSONAS[0];
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, title: `${activePers.emoji} ${newTitle.trim()}` } : s
        )
      );
    }
  };

  // Submit flow
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isGenerating || !activeSession) return;

    setErrorMessage(null);
    const userMessageContent = inputText.trim();
    setInputText("");

    // Create a new localized user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: userMessageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };

    // Update active session locally
    const updatedMessages = [...activeSession.messages, userMessage];

    // Auto-update summary title if it's the first actual message in this blank conversation
    let updatedTitle = activeSession.title;
    if (activeSession.messages.length === 0) {
      const charLimit = 22;
      const previewText =
        userMessageContent.length > charLimit
          ? userMessageContent.substring(0, charLimit) + "..."
          : userMessageContent;
      updatedTitle = `${currentPersona.emoji} ${previewText}`;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? { ...s, messages: updatedMessages, title: updatedTitle }
          : s
      )
    );

    setIsGenerating(true);

    try {
      // Map entire history for context matching
      const historyPayload = updatedMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessageContent,
          history: historyPayload,
          systemInstruction: currentPersona.systemInstruction,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate reply");
      }

      const data = await res.json();
      const modelMessage: Message = {
        id: `msg-${Date.now()}-model`,
        role: "model",
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id ? { ...s, messages: [...updatedMessages, modelMessage] } : s
        )
      );

      // Trigger automatic SpeechSynthesis if toggled on
      if (isSpeakerEnabled) {
        speakText(data.reply);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An error occurred. Check internet connection.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const exportChatAsMarkdown = () => {
    if (!activeSession || activeSession.messages.length === 0) return;

    let mdText = `# Chat Session: ${activeSession.title}\n`;
    mdText += `*Created: ${activeSession.createdAt} | Persona: ${currentPersona.name}*\n\n---\n\n`;

    activeSession.messages.forEach((m) => {
      mdText += `### **${m.role === "user" ? "You" : currentPersona.name}** *(${m.timestamp})*\n\n`;
      mdText += `${m.content}\n\n`;
    });

    const blob = new Blob([mdText], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${activeSession.title.replace(/[^\w\s-]/gi, "").trim() || "chat"}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get matching icon for personas display
  const getPersonaIcon = (id: string) => {
    switch (id) {
      case "coder":
        return <Code className="w-5 h-5 text-indigo-500" />;
      case "tutor":
        return <GraduationCap className="w-5 h-5 text-amber-500" />;
      case "creative":
        return <PenTool className="w-5 h-5 text-pink-500" />;
      case "executive":
        return <Briefcase className="w-5 h-5 text-sky-500" />;
      default:
        return <HelpCircle className="w-5 h-5 text-emerald-500" />;
    }
  };

  const loadSuggestionPrompt = (promptText: string) => {
    setInputText(promptText);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  return (
    <div id="app_root" className="flex h-screen bg-zinc-50 overflow-hidden font-sans text-zinc-900 antialiased">
      {/* MOBILE COLLAPSIBLE SIDEBAR BACKDROP */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-xs"
          />
        )}
      </AnimatePresence>

      {/* CHAT SESSION LIST SIDEBAR */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 flex flex-col w-72 md:w-80 bg-zinc-900 border-r border-zinc-800 text-zinc-100 transition-transform duration-300 transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* BRAND CORNER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h1 className="font-semibold text-sm leading-tight">Gemini Chatbot TEST 1</h1>
              <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">
                v3.5 Flash Model
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg hover:bg-zinc-800/80 text-zinc-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ACTIONS */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => createNewSession("general")}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-md shadow-indigo-900/10 active:scale-[0.98]"
          >
            <Plus size={16} />
            New Conversation
          </button>
        </div>

        {/* CHAT SESSIONS CONTAINER */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 scrollbar-thin">
          <span className="block px-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">
            Conversations ({sessions.length})
          </span>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              No conversations yet. Create one above!
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setSelectedPersonaId(session.personaId);
                    setErrorMessage(null);
                    // Close sidebar on mobile
                    if (window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`group flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-all duration-150 ${
                    isActive
                      ? "bg-zinc-800 text-white font-medium shadow-sm border border-zinc-700/50"
                      : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <MessageSquare size={16} className={isActive ? "text-indigo-400" : "text-zinc-500"} />
                    <span className="truncate text-xs md:text-sm">{session.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        renameSession(session.id, session.title);
                      }}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
                      title="Rename conversation"
                    >
                      <Settings size={12} />
                    </button>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="p-1 rounded hover:bg-red-950 text-zinc-500 hover:text-red-400"
                      title="Delete conversation"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PERSONA CHANGER ACCORDION IN SIDEBAR */}
        <div className="border-t border-zinc-800 bg-zinc-950/40 p-4">
          <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2.5">
            Current Agent Persona
          </span>
          <div className="grid grid-cols-5 gap-1.5">
            {DEFAULT_PERSONAS.map((pers) => {
              const isSelected = pers.id === selectedPersonaId;
              return (
                <button
                  key={pers.id}
                  onClick={() => handlePersonaChange(pers.id)}
                  title={`${pers.name} (${pers.role})`}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-zinc-800 border-indigo-500/60 text-white font-semibold scale-105"
                      : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/60 hover:border-zinc-700 text-zinc-400"
                  }`}
                >
                  <span className="text-lg mb-0.5 filter drop-shadow-sm">{pers.emoji}</span>
                  <span className="text-[9px] truncate max-w-full font-medium leading-none">
                    {pers.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3.5 bg-zinc-900/50 rounded-lg p-2.5 border border-zinc-800/40">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-zinc-300">
                {currentPersona.emoji} {currentPersona.name}
              </span>
              <span className="text-[10px] text-zinc-500">— {currentPersona.role}</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal">{currentPersona.description}</p>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT FRAME */}
      <main className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        {/* UPPER STATUS BAR */}
        <header className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-zinc-150">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-lg shadow-inner border border-zinc-200">
                {currentPersona.emoji}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-bold text-sm md:text-base text-zinc-950 pr-0.5">
                    {currentPersona.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 font-medium">
                  {currentPersona.role} • Powered by Gemini 3.5
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* SPEECH SYNTHESIS SPEAKER TOGGLE */}
            <button
              onClick={handleSpeakToggle}
              className={`p-2 rounded-xl transition-all border ${
                isSpeakerEnabled
                  ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-xs"
                  : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
              }`}
              title={isSpeakerEnabled ? "Speech Synthesis Enabled" : "Speech Synthesis Disabled"}
            >
              {isSpeakerEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            {/* EXPORT MARKDOWN ACTION */}
            <button
              disabled={!activeSession || activeSession.messages.length === 0}
              onClick={exportChatAsMarkdown}
              className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 disabled:opacity-50 disabled:pointer-events-none transition-all"
              title="Export Conversation as Markdown"
            >
              <Share2 size={16} />
            </button>
          </div>
        </header>

        {/* ACTIVE CONVERSATION CANVAS */}
        <div className="flex-1 overflow-y-auto bg-zinc-50/70 p-4 md:p-6 space-y-6 scrollbar-thin">
          {!activeSession || activeSession.messages.length === 0 ? (
            /* BLANK DASHBOARD ON INITIAL CONVO */
            <div className="max-w-2xl mx-auto py-8 md:py-12 px-4 space-y-8">
              <div className="text-center space-y-2.5">
                <div className="inline-flex p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-xs mb-1">
                  <Bot className="w-6 h-6 animate-bounce" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">
                  Welcome to Gemini Chatbot!
                </h3>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                  Powered securely by Google Gemini 3.5. Choose your assistant's persona or try one of the
                  conversational prompts below.
                </p>
              </div>

              {/* PERSONAS SHORTLIST */}
              <div className="space-y-3">
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest text-center">
                  Select A Specialized Assistant Persona
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {DEFAULT_PERSONAS.map((pers) => (
                    <div
                      key={pers.id}
                      onClick={() => handlePersonaChange(pers.id)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        pers.id === selectedPersonaId
                          ? "bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500/10"
                          : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
                      }`}
                    >
                      <span className="text-2xl p-1 bg-zinc-100 rounded-lg shadow-inner">
                        {pers.emoji}
                      </span>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-semibold text-zinc-950">{pers.name}</h4>
                          {pers.id === selectedPersonaId && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 leading-normal">{pers.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PROMPTS BOARD */}
              <div className="space-y-3">
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest text-center">
                  Quick Starter Ideas
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <button
                    onClick={() =>
                      loadSuggestionPrompt("Format a professional polite apology email for missing the deadline due to server updates.")
                    }
                    className="flex items-center justify-between text-left px-4 py-3 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-all text-sm group"
                  >
                    <span className="text-zinc-650 font-medium truncate">✉️ Format an email apology</span>
                    <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={() =>
                      loadSuggestionPrompt("How do I make a clean, lightweight debounce helper in React with hook cleanup?")
                    }
                    className="flex items-center justify-between text-left px-4 py-3 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-all text-sm group"
                  >
                    <span className="text-zinc-650 font-medium truncate">💻 React Hook helper help</span>
                    <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={() =>
                      loadSuggestionPrompt("Explain the historical significance of the Silk Road simply, utilizing some bullet list structures.")
                    }
                    className="flex items-center justify-between text-left px-4 py-3 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-all text-sm group"
                  >
                    <span className="text-zinc-650 font-medium truncate">🎓 Explain Silk Road history</span>
                    <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={() =>
                      loadSuggestionPrompt("Write an epic 3-sentence Sci-Fi scene where an astronaut discovers a neon flower on Triton.")
                    }
                    className="flex items-center justify-between text-left px-4 py-3 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-all text-sm group"
                  >
                    <span className="text-zinc-650 font-medium truncate">✨ Write Triton sci-fi story</span>
                    <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* CONVERSATION STREAM LAYOUT */
            <div className="max-w-3xl mx-auto space-y-4">
              {activeSession.messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* AVATAR BOX */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm border font-sans select-none flex-shrink-0 ${
                        isUser
                          ? "bg-zinc-950 text-white border-zinc-800 font-bold"
                          : "bg-white text-zinc-800 border-zinc-200"
                      }`}
                    >
                      {isUser ? <User size={15} /> : <span>{currentPersona.emoji}</span>}
                    </div>

                    {/* SPEECH AND CHAT BUBBLE CONTROLS */}
                    <div className="space-y-1.5 max-w-[82%]">
                      <div
                        className={`px-4 py-3 rounded-2xl shadow-xs border ${
                          isUser
                            ? "bg-zinc-900 border-zinc-850 text-white"
                            : "bg-white border-zinc-200 text-zinc-900"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base font-sans font-normal">
                            {msg.content}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <MarkdownView text={msg.content} />
                          </div>
                        )}
                      </div>

                      {/* EXTRA AUXILIARY DETAILS OR SPEAK CURRENT BUBBLE INDENT */}
                      <div
                        className={`flex items-center gap-2.5 px-1.5 text-[10px] text-zinc-400 select-none ${
                          isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        <span>{msg.timestamp}</span>
                        {!isUser && (
                          <button
                            onClick={() => speakText(msg.content)}
                            className="text-zinc-400 hover:text-indigo-500 transition-colors"
                            title="Speak Response Aloud"
                          >
                            <Volume2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* DYNAMIC PENDING LOADER SPECKLES */}
              {isGenerating && (
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 text-zinc-800 flex items-center justify-center text-sm flex-shrink-0">
                    {currentPersona.emoji}
                  </div>
                  <div className="px-5 py-4 rounded-2xl bg-white border border-zinc-200 shadow-xs flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                  </div>
                </div>
              )}

              {/* CORE EXPLAINED ERRORS DIALOG */}
              {errorMessage && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 max-w-fit mx-auto shadow-xs text-red-800 text-xs font-medium">
                  <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span>{errorMessage}</span>
                  <button
                    onClick={() => handleSendMessage()}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-100 hover:bg-red-200 transition-colors ml-2"
                  >
                    <RefreshCw size={11} className="animate-spin-slow" />
                    Retry
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* BOTTOM USER INPUT UNIT */}
        <footer className="p-4 bg-white border-t border-zinc-150">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSendMessage} className="relative">
              <div className="relative flex items-center bg-zinc-50 hover:bg-zinc-100/70 focus-within:bg-white rounded-2xl border border-zinc-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all pl-4 pr-14 py-2.5 shadow-inner">
                {/* AUTOEXPAND TEXT CELL */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={`Message ${currentPersona.name}...`}
                  disabled={!activeSession || isGenerating}
                  className="flex-1 w-full bg-transparent resize-none border-0 text-sm md:text-base text-zinc-900 placeholder-zinc-500 focus:outline-hidden focus:ring-0 overflow-y-auto leading-relaxed max-h-44 pr-1 py-1"
                />

                {/* ACTION TRIGGER */}
                <div className="absolute right-3.5 bottom-2.5">
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isGenerating || !activeSession}
                    className="p-2.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 disabled:bg-zinc-250 text-white shadow-md shadow-indigo-650/10 hover:shadow-indigo-500/20 disabled:shadow-none active:scale-[0.96] disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </form>

            {/* LOWER CAPTIONS */}
            <div className="flex items-center justify-between mt-2.5 px-1.5 text-[11px] text-zinc-400 select-none">
              <div className="flex items-center gap-1">
                <Info size={11} />
                <span>Shift + Enter for multi-line. System prompts customized dynamically.</span>
              </div>
              <div>{inputText.length} characters</div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
