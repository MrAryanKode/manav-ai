
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowUp,
  AudioLines,
  BrainCircuit,
  CircleStop,
  Command,
  Cpu,
  Database,
  Globe2,
  Layers3,
  Menu,
  Mic,
  Monitor,
  Radio,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Terminal,
  Volume2,
  Wifi,
  X,
  Zap,
  MessageSquare,
} from "lucide-react";

type Message = {
  role: "user" | "model";
  content: string;
};

type SpeechResult = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionConstructor = new () => Recognition;

const agents = [
  { name: "RESEARCH", detail: "Information intelligence", icon: Search },
  { name: "CODING", detail: "Development systems", icon: Terminal },
  { name: "BROWSER", detail: "Web intelligence", icon: Globe2 },
  { name: "SYSTEM", detail: "Local operations", icon: Monitor },
];

const suggestions = [
  "Explain artificial intelligence",
  "Help me build a project",
  "Write Python code",
  "Research something for me",
];

const navItems = [
  { name: "COMMAND", icon: Command },
  { name: "CONVERSATIONS", icon: MessageSquare },
  { name: "AGENTS", icon: Layers3 },
  { name: "MEMORY", icon: BrainCircuit },
  { name: "SYSTEM", icon: Settings2 },
];

const bars = Array.from({ length: 50 }, (_, i) => i);

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [checking, setChecking] = useState(true);
  const [voiceMode, setVoiceMode] = useState<"natural" | "jarvis">("jarvis");
  const [listening, setListening] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("COMMAND");
  const [lastResponseTime, setLastResponseTime] = useState<number | null>(null);
  const [voiceStatus, setVoiceStatus] = useState("SYSTEM STANDBY");

  const sendingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const restartRecognitionRef = useRef(false);
  const wakeEnabledRef = useRef(false);
  const listeningModeRef = useRef<"wake" | "push" | null>(null);
  const wakeArmedRef = useRef(false);
  const speechBufferRef = useRef("");
  const speechStoppedRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, sending]);

  // Check the existing FastAPI health endpoint.
  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/health", {
          cache: "no-store",
        });

        const data = await response.json();

        if (active) {
          setBackendOnline(response.ok && data.status === "healthy");
          setChecking(false);
        }
      } catch {
        if (active) {
          setBackendOnline(false);
          setChecking(false);
        }
      }
    };

    void check();
    const timer = window.setInterval(check, 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const notify = useCallback((text: string) => {
    setNotice(text);

    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }

    noticeTimerRef.current = setTimeout(() => {
      setNotice("");
    }, 3500);
  }, []);

  // Speech synthesis for each completed sentence.
  const speakSentence = useCallback((text: string) => {
    if (speechStoppedRef.current || !text.trim()) return;
    if (!("speechSynthesis" in window)) return;

    const clean = text
      .replace(/```[\s\S]*?```/g, "I have included a code example in the chat.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "link")
      .trim();

    if (!clean) return;

    const hindi = /[\u0900-\u097F]/.test(clean);
    const voices = window.speechSynthesis.getVoices();

    const languageVoices = voices.filter((voice) =>
      voice.lang.toLowerCase().startsWith(hindi ? "hi" : "en")
    );

    const preferredNames =
      voiceMode === "jarvis"
        ? ["daniel", "george", "david", "mark", "guy", "thomas"]
        : ["ravi", "david", "alex", "daniel", "guy"];

    const selected =
      languageVoices.find((voice) =>
        preferredNames.some((name) =>
          voice.name.toLowerCase().includes(name)
        )
      ) ?? languageVoices[0];

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = hindi ? "hi-IN" : "en-IN";

    if (selected) {
      utterance.voice = selected;
      utterance.lang = selected.lang;
    }

    utterance.rate = voiceMode === "jarvis" ? 0.91 : 1.02;
    utterance.pitch = voiceMode === "jarvis" ? 0.78 : 1.1;
    utterance.volume = 1;

    utterance.onstart = () => setSpeaking(true);

    utterance.onend = () => {
      if (!window.speechSynthesis.speaking) {
        setSpeaking(false);
      }
    };

    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [voiceMode]);

  // Divide streamed text into complete sentences.
  const processSpeech = useCallback(
    (text: string, flush = false) => {
      speechBufferRef.current += text;

      while (true) {
        const match = speechBufferRef.current.match(
          /^([\s\S]*?[.!?।])(?:\s+|$)/
        );

        if (!match) break;

        speechBufferRef.current = speechBufferRef.current.slice(
          match[0].length
        );

        speakSentence(match[1].trim());
      }

      if (flush && speechBufferRef.current.trim()) {
        speakSentence(speechBufferRef.current.trim());
        speechBufferRef.current = "";
      }
    },
    [speakSentence]
  );

  // Stream the backend response using the existing SSE contract.
  const sendMessage = async (raw: string) => {
    const message = raw.trim();

    if (!message || sendingRef.current) return;

    if (!backendOnline) {
      notify("MANAV backend is offline. Start FastAPI first.");
      return;
    }

    const previous = messagesRef.current;

    const updated: Message[] = [
      ...previous,
      { role: "user", content: message },
      { role: "model", content: "" },
    ];

    messagesRef.current = updated;
    setMessages(updated);
    setCommand("");
    setSending(true);
    sendingRef.current = true;
    setActiveSection("COMMAND");

    speechStoppedRef.current = false;
    speechBufferRef.current = "";

    window.speechSynthesis?.cancel();
    setSpeaking(false);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message,
          history: previous.slice(-10),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = "The AI request could not be completed.";

        try {
          const data = await response.json();

          if (typeof data.detail === "string") {
            detail = data.detail;
          }
        } catch {
          // Keep the default error message.
        }

        throw new Error(detail);
      }

      if (!response.body) {
        throw new Error("Streaming is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let fullReply = "";
      let finished = false;

      const handleEvent = (eventText: string) => {
        const lines = eventText.split(/\r?\n/);
        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (!dataLines.length) return;

        const payload = JSON.parse(dataLines.join("\n")) as {
          text?: string;
          message?: string;
          response_time_seconds?: number;
        };

        if (
          eventName === "chunk" &&
          typeof payload.text === "string"
        ) {
          fullReply += payload.text;

          const nextMessages: Message[] = [
            ...updated.slice(0, -1),
            { role: "model", content: fullReply },
          ];

          messagesRef.current = nextMessages;
          setMessages(nextMessages);

          processSpeech(payload.text);
        }

        if (eventName === "done") {
          finished = true;
          processSpeech("", true);

          if (typeof payload.response_time_seconds === "number") {
            setLastResponseTime(payload.response_time_seconds);
          }
        }

        if (eventName === "error") {
          throw new Error(
            payload.message || "MANAV encountered an error."
          );
        }
      };

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";

        for (const eventText of events) {
          handleEvent(eventText);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        handleEvent(buffer);
      }

      if (!finished) {
        processSpeech("", true);
      }

      if (!fullReply.trim()) {
        throw new Error("MANAV returned an empty response.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      const detail =
        error instanceof Error
          ? error.message
          : "Unable to reach MANAV.";

      const errorMessages: Message[] = [
        ...updated.slice(0, -1),
        {
          role: "model",
          content: `I couldn't complete that request. ${detail}`,
        },
      ];

      messagesRef.current = errorMessages;
      setMessages(errorMessages);

      speechBufferRef.current = "";
      notify(detail);
    } finally {
      setSending(false);
      sendingRef.current = false;
      controllerRef.current = null;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(command);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(command);
    }
  };

  const stopSpeaking = () => {
    speechStoppedRef.current = true;
    speechBufferRef.current = "";

    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  // Browser microphone recognition.
  const startListening = (mode: "push" | "wake") => {
    const speechWindow = window as Window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };

    const Constructor =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!Constructor) {
      notify("Speech recognition is unavailable. Use Chrome.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new Constructor();

      recognition.lang = "en-IN";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let transcript = "";

        for (
          let i = event.resultIndex;
          i < event.results.length;
          i += 1
        ) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + " ";
          }
        }

        const spoken = transcript.trim();

        if (!spoken) return;

        if (listeningModeRef.current === "push") {
          setCommand(spoken);
          void sendMessage(spoken);
          recognitionRef.current?.stop();
          return;
        }

        if (listeningModeRef.current === "wake") {
          const match = spoken.match(/hey\s+manav[,.!\s]*/i);

          if (match) {
            const remaining = spoken
              .slice(match.index! + match[0].length)
              .trim();

            if (remaining) {
              wakeArmedRef.current = false;
              void sendMessage(remaining);
            } else {
              wakeArmedRef.current = true;
              setVoiceStatus("MANAV IS LISTENING");
            }
          } else if (wakeArmedRef.current) {
            wakeArmedRef.current = false;
            void sendMessage(spoken);
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "not-allowed") {
          restartRecognitionRef.current = false;
          wakeEnabledRef.current = false;

          setWakeEnabled(false);
          setListening(false);

          notify("Allow microphone permission in Chrome.");
        }
      };

      recognition.onend = () => {
        if (
          restartRecognitionRef.current &&
          wakeEnabledRef.current
        ) {
          window.setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // Browser may still be closing the previous session.
            }
          }, 400);
        } else {
          setListening(false);

          if (!wakeEnabledRef.current) {
            setVoiceStatus("SYSTEM STANDBY");
          }
        }
      };

      recognitionRef.current = recognition;
    }

    listeningModeRef.current = mode;

    if (mode === "wake") {
      wakeEnabledRef.current = true;
      restartRecognitionRef.current = true;

      setWakeEnabled(true);
      setVoiceStatus('SAY "HEY MANAV"');
    } else {
      wakeEnabledRef.current = false;
      restartRecognitionRef.current = false;

      setVoiceStatus("LISTENING TO YOUR VOICE");
    }

    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      notify("Microphone is already active.");
    }
  };

  const stopListening = () => {
    restartRecognitionRef.current = false;
    wakeEnabledRef.current = false;
    wakeArmedRef.current = false;
    listeningModeRef.current = null;

    setWakeEnabled(false);
    setListening(false);
    setVoiceStatus("SYSTEM STANDBY");

    recognitionRef.current?.stop();
  };

  const toggleWake = () => {
    if (wakeEnabled) {
      stopListening();
    } else {
      startListening("wake");
    }
  };

  const handlePushToTalk = () => {
    if (listening && !wakeEnabled) {
      stopListening();
      return;
    }

    if (wakeEnabled) {
      stopListening();
    }

    startListening("push");
  };

  useEffect(() => {
    return () => {
      restartRecognitionRef.current = false;
      recognitionRef.current?.abort();
      controllerRef.current?.abort();
      window.speechSynthesis?.cancel();

      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const systemState = listening
    ? "LISTENING"
    : speaking
      ? "SPEAKING"
      : sending
        ? "PROCESSING"
        : "STANDBY";

  const hologramClass = [
    "hologram",
    listening ? "hologram-listening" : "",
    sending ? "hologram-thinking" : "",
    speaking ? "hologram-speaking" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const navClick = (name: string) => {
    setActiveSection(name);
    setSidebarOpen(false);

    if (name !== "COMMAND") {
      notify(`${name} module is not integrated yet.`);
    }
  };

  return (
    <main className="manav-background min-h-screen overflow-hidden text-white">
      <div className="hud-grid fixed inset-0 pointer-events-none" />
      <div className="scanlines fixed inset-0 pointer-events-none" />

      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />
      <div className="ambient-orb ambient-orb-three" />

      <div className="app-shell">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="sidebar-backdrop"
              aria-label="Close sidebar"
            />
          )}
        </AnimatePresence>

        {/* LEFT NAVIGATION */}
        <aside
          className={`manav-sidebar ${
            sidebarOpen ? "sidebar-open" : ""
          }`}
        >
          <div className="brand-lockup">
            <div className="brand-symbol">
              <span>M</span>
              <i />
            </div>

            <div>
              <div className="brand-name">MANAV</div>
              <div className="brand-caption">
                PERSONAL INTELLIGENCE
              </div>
            </div>

            <button
              className="sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X size={17} />
            </button>
          </div>

          <div className="sidebar-label">WORKSPACE</div>

          <nav className="nav-stack">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => navClick(item.name)}
                  className={`nav-item ${
                    active ? "nav-item-active" : ""
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.name}</span>
                  {active && (
                    <span className="nav-active-indicator" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-label agents-label">
            INTELLIGENCE UNITS
          </div>

          <div className="agent-list">
            {agents.map((agent, index) => {
              const Icon = agent.icon;

              return (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.07 }}
                  className="sidebar-agent"
                >
                  <div className="agent-icon">
                    <Icon size={15} />
                  </div>

                  <div className="agent-copy">
                    <p>{agent.name}</p>
                    <span>{agent.detail}</span>
                  </div>

                  <span className="agent-status" />
                </motion.div>
              );
            })}
          </div>

          <div className="sidebar-bottom">
            <div className="security-panel">
              <Shield size={16} />

              <div>
                <p>LOCAL SESSION</p>
                <span>Permission-based access</span>
              </div>
            </div>

            <div className="sidebar-version">
              MANAV OS <span>BUILD 0.3</span>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <section className="main-column">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="mobile-menu"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>

              <div>
                <div className="eyebrow">
                  MANAV / CENTRAL INTELLIGENCE
                </div>

                <div className="topbar-title">
                  Personal AI Command Centre
                </div>
              </div>
            </div>

            <div className="topbar-right">
              <div className="system-connection">
                <span
                  className={`status-dot ${
                    backendOnline
                      ? "status-online"
                      : "status-offline"
                  }`}
                />

                <span>
                  {checking
                    ? "CONNECTING"
                    : backendOnline
                      ? "SYSTEM ONLINE"
                      : "SYSTEM OFFLINE"}
                </span>
              </div>

              <div className="profile-orb">A</div>
            </div>
          </header>

          <div className="workspace">
            <div className="workspace-heading">
              <div>
                <div className="eyebrow accent-eyebrow">
                  PERSONAL INTELLIGENCE / 001
                </div>

                <h1>
                  Good evening, <span>Aryan.</span>
                </h1>

                <p>
                  Your intelligence environment is standing by.
                </p>
              </div>

              <div className="live-indicator">
                <span className="live-pulse" />
                LIVE SYSTEM MONITORING
              </div>
            </div>

            <div className="command-layout">
              {/* CENTRAL AI CORE */}
              <section className="central-stage">
                <div className="stage-topline">
                  <span>CORE INTELLIGENCE</span>

                  <span className="stage-state">
                    <i /> MK · 001 / {systemState}
                  </span>
                </div>

                {/* HOLOGRAPHIC REACTOR */}
                <div className={hologramClass}>
                  <div className="holo-aura" />

                  <div className="holo-orbit holo-orbit-one" />
                  <div className="holo-orbit holo-orbit-two" />
                  <div className="holo-orbit holo-orbit-three" />
                  <div className="holo-orbit holo-orbit-four" />
                  <div className="holo-orbit holo-orbit-five" />

                  <div className="holo-scan" />

                  <div className="holo-particles">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <span
                        key={i}
                        style={{ "--i": i } as CSSProperties}
                      />
                    ))}
                  </div>

                  <motion.div
                    className="holo-core"
                    animate={{
                      scale:
                        listening || speaking
                          ? [1, 1.065, 1]
                          : [1, 1.025, 1],
                    }}
                    transition={{
                      duration:
                        listening || speaking ? 1.1 : 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="core-glass" />

                    <div className="holo-core-inner">
                      <Sparkles size={25} />
                      <span className="core-letter">M</span>
                      <span className="core-word">MANAV</span>
                    </div>
                  </motion.div>

                  <div className="holo-caption">
                    <span className="holo-caption-dot" />
                    {systemState}
                  </div>
                </div>

                {/* DYNAMIC STATUS */}
                <div className="stage-message">
                  <h2>
                    {listening
                      ? "I'm listening."
                      : sending
                        ? "Processing intelligence."
                        : speaking
                          ? "Speaking with you."
                          : "At your command."}
                  </h2>

                  <p>
                    {listening
                      ? "Your voice input is being captured."
                      : sending
                        ? "Your request is moving through the intelligence stream."
                        : "Intelligence is not just a response. It is a system ready to work with you."}
                  </p>
                </div>

                {/* VOICE VISUALIZER */}
                <div
                  className={`voice-visualizer ${
                    listening ? "visualizer-active" : ""
                  } ${
                    speaking ? "visualizer-speaking" : ""
                  }`}
                >
                  {bars.map((bar) => (
                    <motion.span
                      key={bar}
                      animate={
                        listening || speaking
                          ? {
                              height: [
                                5,
                                9 + ((bar * 13) % 34),
                                7 + ((bar * 7) % 25),
                                5,
                              ],
                            }
                          : {
                              height: 4 + ((bar * 5) % 9),
                            }
                      }
                      transition={{
                        duration: 0.55 + (bar % 5) * 0.12,
                        repeat:
                          listening || speaking
                            ? Infinity
                            : 0,
                        delay: (bar % 11) * 0.025,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>

                {/* CHAT */}
                <div className="chat-window">
                  {messages.length === 0 ? (
                    <div className="empty-chat">
                      <div className="empty-chat-icon">
                        <AudioLines size={17} />
                      </div>

                      <p className="empty-title">
                        Your conversation starts here
                      </p>

                      <span>
                        Send a command or speak to MANAV.
                      </span>
                    </div>
                  ) : (
                    <div className="message-list">
                      {messages.map((message, index) => (
                        <motion.div
                          key={`${index}-${message.role}`}
                          initial={{ opacity: 0, y: 9 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`chat-message ${
                            message.role === "user"
                              ? "chat-user"
                              : "chat-model"
                          }`}
                        >
                          <div className="chat-avatar">
                            {message.role === "user" ? "A" : "M"}
                          </div>

                          <div className="message-body">
                            <div className="message-meta">
                              {message.role === "user"
                                ? "YOU"
                                : "MANAV"}
                            </div>

                            <p>
                              {message.content ||
                                (sending ? "Thinking…" : "")}
                            </p>
                          </div>
                        </motion.div>
                      ))}

                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>

                {/* COMMAND INPUT */}
                <form
                  className="input-console"
                  onSubmit={handleSubmit}
                >
                  <textarea
                    value={command}
                    onChange={(event) =>
                      setCommand(event.target.value)
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Give MANAV a command..."
                    rows={2}
                    disabled={sending}
                    aria-label="Message MANAV"
                  />

                  <div className="input-console-bottom">
                    <div className="input-hint">
                      <span className="keyboard-key">↵</span>
                      SEND
                      <span className="hint-divider" />
                      <span>SHIFT + ENTER FOR NEW LINE</span>
                    </div>

                    <button
                      className="send-button"
                      type="submit"
                      disabled={!command.trim() || sending}
                      aria-label="Send message"
                    >
                      {sending ? (
                        <CircleStop size={17} />
                      ) : (
                        <ArrowUp size={19} />
                      )}
                    </button>
                  </div>
                </form>

                {/* VOICE CONTROLS */}
                <div className="voice-settings">
                  <div className="voice-controls">
                    <button
                      className={`control-chip ${
                        listening && !wakeEnabled
                          ? "control-chip-active"
                          : ""
                      }`}
                      onClick={handlePushToTalk}
                      type="button"
                    >
                      <Mic size={14} />

                      {listening && !wakeEnabled
                        ? "STOP LISTENING"
                        : "PUSH TO TALK"}
                    </button>

                    <button
                      className={`control-chip ${
                        wakeEnabled ? "control-chip-active" : ""
                      }`}
                      onClick={toggleWake}
                      type="button"
                    >
                      <Radio size={14} />

                      {wakeEnabled
                        ? "WAKE WORD ON"
                        : "HEY MANAV"}
                    </button>

                    {speaking && (
                      <button
                        className="control-chip stop-chip"
                        onClick={stopSpeaking}
                        type="button"
                      >
                        <Volume2 size={14} />
                        STOP VOICE
                      </button>
                    )}
                  </div>

                  <div className="voice-mode-switch">
                    <button
                      type="button"
                      className={
                        voiceMode === "natural" ? "selected" : ""
                      }
                      onClick={() => setVoiceMode("natural")}
                    >
                      NATURAL
                    </button>

                    <button
                      type="button"
                      className={
                        voiceMode === "jarvis" ? "selected" : ""
                      }
                      onClick={() => setVoiceMode("jarvis")}
                    >
                      JARVIS
                    </button>
                  </div>
                </div>

                {/* QUICK PROMPTS */}
                <div className="quick-actions">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void sendMessage(suggestion)}
                    >
                      <Sparkles size={12} />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </section>

              {/* RIGHT INTELLIGENCE RAIL */}
              <aside className="intelligence-rail">
                <div className="rail-heading">
                  <div>
                    <div className="eyebrow">SYSTEM OVERVIEW</div>
                    <h3>Live telemetry</h3>
                  </div>

                  <div className="rail-icon">
                    <Activity size={17} />
                  </div>
                </div>

                {/* TELEMETRY */}
                <div className="telemetry-panel">
                  <div className="telemetry-row">
                    <div className="telemetry-icon">
                      <Cpu size={15} />
                    </div>

                    <div className="telemetry-copy">
                      <p>AI CORE</p>
                      <span>
                        {sending
                          ? "Generating response"
                          : "Ready for requests"}
                      </span>
                    </div>

                    <i
                      className={`telemetry-dot ${
                        backendOnline ? "online" : ""
                      }`}
                    />
                  </div>

                  <div className="telemetry-row">
                    <div className="telemetry-icon">
                      <Wifi size={15} />
                    </div>

                    <div className="telemetry-copy">
                      <p>BACKEND LINK</p>
                      <span>
                        {checking
                          ? "Checking connection"
                          : backendOnline
                            ? "FastAPI connected"
                            : "Connection unavailable"}
                      </span>
                    </div>

                    <i
                      className={`telemetry-dot ${
                        backendOnline ? "online" : ""
                      }`}
                    />
                  </div>

                  <div className="telemetry-row">
                    <div className="telemetry-icon">
                      <Mic size={15} />
                    </div>

                    <div className="telemetry-copy">
                      <p>VOICE INPUT</p>
                      <span>
                        {listening
                          ? voiceStatus
                          : "Microphone standby"}
                      </span>
                    </div>

                    <i
                      className={`telemetry-dot ${
                        listening ? "online" : ""
                      }`}
                    />
                  </div>

                  <div className="telemetry-row">
                    <div className="telemetry-icon">
                      <Volume2 size={15} />
                    </div>

                    <div className="telemetry-copy">
                      <p>VOICE OUTPUT</p>
                      <span>
                        {speaking
                          ? "Speech synthesis active"
                          : "Audio standby"}
                      </span>
                    </div>

                    <i
                      className={`telemetry-dot ${
                        speaking ? "online" : ""
                      }`}
                    />
                  </div>

                  <div className="telemetry-row">
                    <div className="telemetry-icon">
                      <Database size={15} />
                    </div>

                    <div className="telemetry-copy">
                      <p>MEMORY SYSTEM</p>
                      <span>Integration pending</span>
                    </div>

                    <i className="telemetry-dot" />
                  </div>
                </div>

                {/* AGENT NETWORK */}
                <div className="rail-section">
                  <div className="rail-section-heading">
                    <div>
                      <div className="eyebrow">
                        AUTONOMOUS UNITS
                      </div>
                      <h3>Agent network</h3>
                    </div>

                    <span className="unit-count">04 UNITS</span>
                  </div>

                  <div className="rail-agent-list">
                    {agents.map((agent) => {
                      const Icon = agent.icon;

                      return (
                        <motion.div
                          key={agent.name}
                          whileHover={{ x: 4 }}
                          className="agent-card"
                        >
                          <div className="agent-card-icon">
                            <Icon size={16} />
                          </div>

                          <div className="agent-copy">
                            <p>{agent.name}</p>
                            <span>{agent.detail}</span>
                          </div>

                          <i className="agent-status" />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* ACTIVITY FEED */}
                <div className="rail-section activity-section">
                  <div className="rail-section-heading">
                    <div>
                      <div className="eyebrow">
                        LIVE OPERATIONS
                      </div>
                      <h3>Activity feed</h3>
                    </div>

                    <Zap size={16} className="activity-zap" />
                  </div>

                  <div className="activity-entry">
                    <span className="activity-point" />

                    <div>
                      <p>
                        {sending
                          ? "Generating intelligence"
                          : speaking
                            ? "Voice output active"
                            : listening
                              ? "Microphone active"
                              : "System standing by"}
                      </p>

                      <span>
                        {sending
                          ? "Gemini response stream"
                          : "MANAV core status"}
                      </span>
                    </div>
                  </div>

                  <div className="activity-entry">
                    <span className="activity-point activity-point-muted" />

                    <div>
                      <p>Backend monitoring</p>
                      <span>
                        Health check · 10 second interval
                      </span>
                    </div>
                  </div>

                  {lastResponseTime !== null && (
                    <div className="response-metric">
                      <span>LAST RESPONSE</span>
                      <strong>
                        {lastResponseTime.toFixed(2)}s
                      </strong>
                    </div>
                  )}
                </div>

                <div className="rail-footer">
                  <div>
                    <Shield size={13} />
                    <span>LOCAL SESSION PROTECTED</span>
                  </div>

                  <span>MANAV AI · 0.3</span>
                </div>
              </aside>
            </div>

            <footer className="workspace-footer">
              <span>
                <span className="footer-live-dot" />
                {backendOnline
                  ? "LOCAL INTELLIGENCE LINK ACTIVE"
                  : "WAITING FOR BACKEND CONNECTION"}
              </span>

              <span>DESIGNED FOR HUMAN INTELLIGENCE</span>
            </footer>
          </div>
        </section>
      </div>

      {/* NOTIFICATION */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            className="manav-notice"
          >
            <Sparkles size={15} />
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
