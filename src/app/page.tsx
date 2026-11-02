
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AudioLines,
  BrainCircuit,
  Check,
  Copy,
  Globe2,
  Mic,
  MicOff,
  Plus,
  Radio,
  Send,
  Shield,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Wifi,
} from "lucide-react";

type Role = "user" | "model";

type Message = {
  role: Role;
  content: string;
  language?: string;
};

type Language =
  | "auto"
  | "en"
  | "hi"
  | "hinglish"
  | "gu"
  | "ta"
  | "te"
  | "bn"
  | "mr"
  | "fr"
  | "es"
  | "de";

const API = "http://127.0.0.1:8000";

const languageNames: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  hinglish: "Hinglish",
  gu: "Gujarati",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  mr: "Marathi",
  fr: "French",
  es: "Spanish",
  de: "German",
};

const supportedLanguages: { value: Language; label: string }[] = [
  { value: "auto", label: "Automatic detection" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
  { value: "gu", label: "Gujarati" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "bn", label: "Bengali" },
  { value: "mr", label: "Marathi" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
];

type RecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionConstructor = new () => Recognition;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(false);
  const [language, setLanguage] = useState<Language>("auto");
  const [lastLanguage, setLastLanguage] = useState("en");
  const [listening, setListening] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [googleVoice, setGoogleVoice] = useState(true);
  const [notice, setNotice] = useState("");
  const [latency, setLatency] = useState<number | null>(null);

  const messagesRef = useRef<Message[]>([]);
  const sendingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const wakeEnabledRef = useRef(false);
  const restartWakeRef = useRef(false);
  const wakeArmedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const response = await fetch(`${API}/health`, {
          cache: "no-store",
        });
        if (active) setOnline(response.ok);
      } catch {
        if (active) setOnline(false);
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
    window.setTimeout(() => setNotice(""), 3500);
  }, []);

  const stopVoice = useCallback(() => {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }, []);

  const browserSpeak = useCallback(
    (text: string, lang: string) => {
      if (!("speechSynthesis" in window)) {
        notify("No supported speech engine is available.");
        return;
      }

      const locale: Record<string, string> = {
        en: "en-IN",
        hi: "hi-IN",
        hinglish: "hi-IN",
        gu: "gu-IN",
        ta: "ta-IN",
        te: "te-IN",
        bn: "bn-IN",
        mr: "mr-IN",
        fr: "fr-FR",
        es: "es-ES",
        de: "de-DE",
      };

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale[lang] || "en-IN";
      utterance.rate = 0.96;
      utterance.pitch = 0.92;

      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(
        (item) =>
          item.lang.toLowerCase().startsWith(
            utterance.lang.slice(0, 2).toLowerCase(),
          ),
      );

      if (voice) utterance.voice = voice;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [notify],
  );

  const speakWithGoogle = useCallback(
    async (text: string, lang: string) => {
      if (!googleVoice) {
        browserSpeak(text, lang);
        return;
      }

      try {
        const response = await fetch(`${API}/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: lang }),
        });

        if (!response.ok) throw new Error("Google voice request failed");

        const data = await response.json();

        if (!data.success || !data.audio_base64) {
          throw new Error(data.message || "Google voice unavailable");
        }

        const audio = new Audio(
          `data:${data.content_type};base64,${data.audio_base64}`,
        );

        audioRef.current = audio;
        audio.onplay = () => setSpeaking(true);
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => {
          setSpeaking(false);
          browserSpeak(text, lang);
        };

        await audio.play();
      } catch (error) {
        console.warn("Google TTS fallback:", error);
        notify("Google voice unavailable. Using browser voice.");
        browserSpeak(text, lang);
      }
    },
    [googleVoice, browserSpeak, notify],
  );

  const sendMessage = async (raw: string) => {
    const message = raw.trim();

    if (!message || sendingRef.current) return;

    if (!online) {
      notify("MANAV backend is offline.");
      return;
    }

    const previous = messagesRef.current;

    // Never send empty streaming placeholders to FastAPI.
    const cleanHistory = previous
      .filter((item) => item.content.trim().length > 0)
      .slice(-10)
      .map((item) => ({
        role: item.role === "user" ? "user" : "model",
        content: item.content.trim(),
      }));

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
    stopVoice();

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message,
          history: cleanHistory,
          preferred_language: language,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = "The AI request could not be completed.";
        try {
          const data = await response.json();
          if (Array.isArray(data.detail)) {
            detail = data.detail
              .map((item: { msg?: string }) => item.msg || "")
              .join(", ");
          } else if (typeof data.detail === "string") {
            detail = data.detail;
          }
        } catch {
          // Keep fallback error.
        }
        throw new Error(detail);
      }

      if (!response.body) throw new Error("Streaming is unavailable.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullReply = "";
      let responseLanguage = "en";
      let completed = false;

      const processEvent = (eventText: string) => {
        const lines = eventText.split(/\r?\n/);
        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          }
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (!dataLines.length) return;

        const payload = JSON.parse(dataLines.join("\n"));

        if (eventName === "chunk" && typeof payload.text === "string") {
          fullReply += payload.text;

          const next = [
            ...updated.slice(0, -1),
            {
              role: "model" as const,
              content: fullReply,
              language: responseLanguage,
            },
          ];

          messagesRef.current = next;
          setMessages(next);
        }

        if (eventName === "done") {
          completed = true;
          responseLanguage = payload.language || "en";
          setLastLanguage(responseLanguage);

          if (typeof payload.response_time_seconds === "number") {
            setLatency(payload.response_time_seconds);
          }
        }

        if (eventName === "error") {
          throw new Error(payload.message || "MANAV encountered an error.");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";

        for (const event of events) processEvent(event);
      }

      buffer += decoder.decode();
      if (buffer.trim()) processEvent(buffer);

      if (!fullReply.trim()) {
        throw new Error("MANAV returned an empty response.");
      }

      if (!completed) {
        responseLanguage =
          language === "auto" ? "en" : language;
      }

      const finalMessages = [
        ...updated.slice(0, -1),
        {
          role: "model" as const,
          content: fullReply,
          language: responseLanguage,
        },
      ];

      messagesRef.current = finalMessages;
      setMessages(finalMessages);

      await speakWithGoogle(fullReply, responseLanguage);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;

      const detail =
        error instanceof Error ? error.message : "Unable to reach MANAV.";

      const failed = [
        ...updated.slice(0, -1),
        {
          role: "model" as const,
          content: `I couldn't complete that request. ${detail}`,
        },
      ];

      messagesRef.current = failed;
      setMessages(failed);
      notify(detail);
    } finally {
      setSending(false);
      sendingRef.current = false;
      controllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    controllerRef.current?.abort();
    stopVoice();
    sendingRef.current = false;
    setSending(false);
  };

  const startListening = (wakeMode: boolean) => {
    const speechWindow = window as Window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };

    const Constructor =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!Constructor) {
      notify("Speech recognition is unavailable. Try Chrome.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new Constructor();

      // Browser recognition language is selected here.
      // Browser support for automatic multilingual recognition varies.
      recognition.lang = "en-IN";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let transcript = "";

        for (
          let index = event.resultIndex;
          index < event.results.length;
          index += 1
        ) {
          if (event.results[index].isFinal) {
            transcript += event.results[index][0].transcript + " ";
          }
        }

        const spoken = transcript.trim();
        if (!spoken) return;

        if (!wakeMode) {
          void sendMessage(spoken);
          recognition.stop();
          return;
        }

        const match = spoken.match(/hey\s+manav[,.!\s]*/i);

        if (match) {
          const remainder = spoken
            .slice(match.index! + match[0].length)
            .trim();

          if (remainder) {
            wakeArmedRef.current = false;
            void sendMessage(remainder);
          } else {
            wakeArmedRef.current = true;
            notify("MANAV is listening. Speak your command.");
          }
        } else if (wakeArmedRef.current) {
          wakeArmedRef.current = false;
          void sendMessage(spoken);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "not-allowed") {
          restartWakeRef.current = false;
          wakeEnabledRef.current = false;
          setWakeEnabled(false);
          setListening(false);
          notify("Allow microphone access in your browser.");
        }
      };

      recognition.onend = () => {
        if (restartWakeRef.current && wakeEnabledRef.current) {
          window.setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // Recognition may still be closing.
            }
          }, 500);
        } else {
          setListening(false);
        }
      };

      recognitionRef.current = recognition;
    }

    try {
      if (wakeMode) {
        wakeEnabledRef.current = true;
        restartWakeRef.current = true;
        setWakeEnabled(true);
      } else {
        wakeEnabledRef.current = false;
        restartWakeRef.current = false;
      }

      recognitionRef.current.start();
      setListening(true);
    } catch {
      notify("Microphone is already active.");
    }
  };

  const stopListening = () => {
    restartWakeRef.current = false;
    wakeEnabledRef.current = false;
    wakeArmedRef.current = false;
    setWakeEnabled(false);
    setListening(false);
    recognitionRef.current?.stop();
  };

  const clearConversation = () => {
    if (sendingRef.current) stopGeneration();
    stopVoice();
    messagesRef.current = [];
    setMessages([]);
    setCommand("");
  };

  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("Copied to clipboard.");
    } catch {
      notify("Clipboard is unavailable.");
    }
  };

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
    };
  }, []);

  return (
    <main className="nexus-app">
      <div className="nexus-grid" />
      <div className="nexus-noise" />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div className="brand-text">
            <strong>MANAV®</strong>
            <small>PERSONAL INTELLIGENCE</small>
          </div>
        </div>

        <div className="sidebar-overline">WORKSPACE</div>
        <div className="navigation">
          <div className="nav-link active">
            <BrainCircuit size={17} />
            <span>Command centre</span>
          </div>
        </div>

        <div className="sidebar-overline">LANGUAGE ENGINE</div>
        <div className="unit-list">
          {supportedLanguages
            .filter((item) => item.value !== "auto")
            .map((item) => (
              <div className="unit-item" key={item.value}>
                <div className="unit-icon">
                  <Globe2 size={15} />
                </div>
                <div className="unit-copy">
                  <strong>{item.label}</strong>
                  <span>Multilingual support</span>
                </div>
                <span className="unit-pending" />
              </div>
            ))}
        </div>

        <div className="sidebar-bottom">
          <div className="privacy-card">
            <Shield size={17} />
            <div>
              <strong>PRIVATE SESSION</strong>
              <span>Local frontend connection</span>
            </div>
            <Check size={14} />
          </div>
          <div className="sidebar-build">
            <span>MANAV NEXUS</span>
            <span>BUILD 0.9.0</span>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>MANAV</span>
            <i>/</i>
            <strong>COMMAND CENTRE</strong>
          </div>
          <div className="topbar-right">
            <div className={`connection-pill ${online ? "connected" : "disconnected"}`}>
              <span className="connection-light" />
              {online ? "CORE CONNECTED" : "CORE DISCONNECTED"}
            </div>
            <div className="profile-chip">A</div>
          </div>
        </header>

        <div className="workspace">
          <section className="welcome-row">
            <div>
              <div className="section-kicker">
                <span /> MULTILINGUAL INTELLIGENCE SYSTEM · 001
              </div>
              <h1>Good to see you, <em>Aryan.</em></h1>
              <p>One intelligence. Multiple languages. Natural conversations.</p>
            </div>
            <div className="session-stamp">
              <Activity size={16} />
              <div>
                <strong>SESSION ACTIVE</strong>
                <small>LOCAL ENVIRONMENT</small>
              </div>
            </div>
          </section>

          <div className="command-grid">
            <section className="core-panel">
              <div className="panel-heading">
                <div><span className="panel-index">01</span> NEURAL INTERFACE</div>
                <div className="core-state">
                  <i /> {listening ? "LISTENING" : sending ? "PROCESSING" : speaking ? "SPEAKING" : "CORE STANDBY"}
                </div>
              </div>

              <div className={`reactor ${sending ? "reactor-processing" : ""}`}>
                <div className="reactor-aura" />
                <div className="reactor-grid" />
                <div className="reactor-ring ring-outer"><i /><b /></div>
                <div className="reactor-ring ring-middle"><i /><b /></div>
                <div className="reactor-ring ring-inner"><i /></div>
                <div className="reactor-sweep" />
                <div className="reactor-core">
                  <div className="core-glass" />
                  <div className="core-inner">
                    <span className="core-overline">NEXUS</span>
                    <strong>M</strong>
                    <span className="core-subline">INTELLIGENCE CORE</span>
                  </div>
                </div>
                <div className="reactor-caption">
                  <i /> {listening ? "Listening to your voice" : sending ? "Receiving streamed intelligence" : speaking ? "Voice output active" : "Ready for your next instruction"}
                </div>
              </div>

              <div className="core-status-strip">
                <div className="status-cell">
                  <BrainCircuit size={16} />
                  <div><small>INTELLIGENCE</small><strong>{sending ? "PROCESSING" : "READY"}</strong></div>
                </div>
                <div className="status-cell">
                  <Wifi size={16} />
                  <div><small>BACKEND LINK</small><strong>{online ? "CONNECTED" : "OFFLINE"}</strong></div>
                </div>
                <div className="status-cell">
                  <AudioLines size={16} />
                  <div><small>VOICE CHANNEL</small><strong>{speaking ? "ACTIVE" : "STANDBY"}</strong></div>
                </div>
              </div>
            </section>

            <aside className="telemetry-panel">
              <div className="panel-heading">
                <div><span className="panel-index">02</span> SYSTEM TELEMETRY</div>
                <Activity size={15} />
              </div>

              <div className="telemetry-summary">
                <div className="telemetry-summary-top">
                  <span>CORE STATUS</span>
                  <span>{online ? "ONLINE" : "OFFLINE"}</span>
                </div>
                <div className="telemetry-summary-main">
                  <strong>{online ? "01" : "00"}</strong>
                  <span>/ 01<br />API LINK</span>
                </div>
                <div className="telemetry-meter">
                  <i style={{ width: online ? "100%" : "4%" }} />
                </div>
                <small>{online ? "FastAPI endpoint responding" : "Waiting for local API"}</small>
              </div>

              <div className="telemetry-list">
                <div className="telemetry-row">
                  <Radio size={15} />
                  <div><strong>LANGUAGE</strong><small>{languageNames[lastLanguage] || lastLanguage}</small></div>
                  <i className="dot dot-green" />
                </div>
                <div className="telemetry-row">
                  <Volume2 size={15} />
                  <div><strong>VOICE ENGINE</strong><small>{googleVoice ? "Google Cloud + fallback" : "Browser voice"}</small></div>
                  <i className="dot dot-green" />
                </div>
                <div className="telemetry-row">
                  <Mic size={15} />
                  <div><strong>VOICE INPUT</strong><small>{listening ? "Microphone active" : "Microphone standby"}</small></div>
                  <i className={listening ? "dot dot-green" : "dot"} />
                </div>
              </div>

              <div className="telemetry-bottom">
                <div className="telemetry-bottom-label">RESPONSE LATENCY</div>
                <strong>{latency !== null ? `${latency.toFixed(2)}s` : "— —"}</strong>
                <small>Last completed Gemini response</small>
              </div>
            </aside>
          </div>

          <section className="command-deck">
            <div className="deck-topline">
              <div><span className="panel-index">03</span> COMMAND DECK</div>
              <div className="deck-encryption"><Shield size={12} /> PRIVATE SESSION</div>
            </div>

            <div className="language-row">
              <label htmlFor="language">RESPONSE LANGUAGE</label>
              <select
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
              >
                {supportedLanguages.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>

              <label className="voice-toggle">
                <input
                  type="checkbox"
                  checked={googleVoice}
                  onChange={(event) => setGoogleVoice(event.target.checked)}
                />
                Google premium voice
              </label>
            </div>

            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(command);
              }}
            >
              <div className="composer-leading"><Sparkles size={18} /></div>
              <textarea
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(command);
                  }
                }}
                placeholder="Give MANAV an instruction..."
                rows={2}
                disabled={sending}
                aria-label="Message MANAV"
              />
              <div className="composer-actions">
                <span className="composer-hint">ENTER TO SEND · SHIFT + ENTER FOR NEW LINE</span>
                {sending ? (
                  <button className="send-button stop-button" type="button" onClick={stopGeneration}>
                    <Square size={15} fill="currentColor" />
                  </button>
                ) : (
                  <button className="send-button" type="submit" disabled={!command.trim()}>
                    <Send size={17} />
                  </button>
                )}
              </div>
            </form>

            <div className="deck-toolbar">
              <div className="voice-controls">
                <button
                  type="button"
                  className={`mic-control ${listening ? "mic-active" : ""}`}
                  onClick={() => listening ? stopListening() : startListening(false)}
                >
                  {listening ? <MicOff size={15} /> : <Mic size={15} />}
                  {listening ? "STOP LISTENING" : "VOICE INPUT"}
                </button>

                <button
                  type="button"
                  className={`wake-control ${wakeEnabled ? "wake-active" : ""}`}
                  onClick={() => {
                    if (wakeEnabled) stopListening();
                    else startListening(true);
                  }}
                >
                  <Radio size={14} />
                  {wakeEnabled ? "WAKE ON" : "WAKE PHRASE"}
                </button>
              </div>

              <div className="voice-profile">
                <Volume2 size={14} />
                <span>VOICE</span>
                <strong>GOOGLE MULTILINGUAL</strong>
                {speaking && (
                  <button type="button" onClick={stopVoice} title="Stop voice">
                    <VolumeX size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="deck-footnote">
              <span><i /> {wakeEnabled ? 'WAKE PHRASE ACTIVE · SAY "HEY MANAV"' : "AUTOMATIC LANGUAGE DETECTION AVAILABLE"}</span>
              <button type="button" onClick={clearConversation}>
                <Plus size={13} /> NEW SESSION
              </button>
            </div>
          </section>

          <section className="conversation-section">
            <div className="conversation-heading">
              <div>
                <div className="section-kicker"><span /> INTERACTION LOG</div>
                <h2>{messages.length ? "Conversation" : "Start a conversation"}</h2>
              </div>
              {messages.length > 0 && (
                <button className="clear-button" type="button" onClick={clearConversation}>
                  <Plus size={14} /> NEW SESSION
                </button>
              )}
            </div>

            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Sparkles size={19} /></div>
                <div className="empty-state-copy">
                  <strong>Your next idea starts here.</strong>
                  <span>MANAV can converse in 11 supported language modes.</span>
                </div>
                <div className="prompt-grid">
                  {[
                    "Explain artificial intelligence from first principles.",
                    "Help me plan and build a software project.",
                    "Help me write a Python program.",
                    "Aaj mujhe ek naya concept samjhao.",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="prompt-card"
                      onClick={() => setCommand(prompt)}
                    >
                      <Sparkles size={15} />
                      <strong>{prompt}</strong>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="message-list">
                {messages.map((message, index) => (
                  <article
                    key={`${index}-${message.role}`}
                    className={`message-row ${message.role === "user" ? "message-user" : "message-model"}`}
                  >
                    <div className="message-avatar">
                      {message.role === "user" ? "A" : <Sparkles size={16} />}
                    </div>
                    <div className="message-body">
                      <div className="message-meta">
                        <strong>{message.role === "user" ? "YOU" : "MANAV"}</strong>
                        <span>{message.role === "user" ? "COMMAND INPUT" : languageNames[message.language || lastLanguage] || "AI RESPONSE"}</span>
                        {message.role === "model" && message.content && (
                          <button
                            type="button"
                            className="copy-button"
                            onClick={() => void copyMessage(message.content)}
                            aria-label="Copy response"
                          >
                            <Copy size={13} />
                          </button>
                        )}
                      </div>
                      <div className="message-content">
                        {message.content || (
                          sending && index === messages.length - 1 ? (
                            <span className="typing-indicator">
                              <i /><i /><i />
                              <small>MANAV IS THINKING</small>
                            </span>
                          ) : null
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <footer className="workspace-footer">
            <span><i className={online ? "footer-dot online" : "footer-dot"} />{online ? "LOCAL INTELLIGENCE LINK ACTIVE" : "WAITING FOR BACKEND"}</span>
            <span>MANAV AI · NEXUS BUILD 0.9.0</span>
          </footer>
        </div>
      </section>

      {notice && (
        <div className="toast">
          <Sparkles size={15} /> {notice}
        </div>
      )}
    </main>
  );
}
