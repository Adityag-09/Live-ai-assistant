import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import './App.css'

const detectLanguage = (text) => {
  const patterns = {
    hi: /[\u0900-\u097F]/,
    ar: /[\u0600-\u06FF]/,
    zh: /[\u4E00-\u9FFF]/,
    ja: /[\u3040-\u30FF]/,
    ko: /[\uAC00-\uD7AF]/,
    ru: /[\u0400-\u04FF]/,
    el: /[\u0370-\u03FF]/,
    fr: /\b(je|tu|nous|vous|bonjour|merci|est|une|des|les|pour|avec|dans)\b/i,
    es: /\b(hola|gracias|que|por|para|como|este|una|los|las|con|pero)\b/i,
    de: /\b(ich|du|wir|sie|ist|ein|und|der|die|das|mit|für|nicht|bitte)\b/i,
    pt: /\b(ola|obrigado|que|por|para|como|este|uma|com|mas|não|você)\b/i,
  }
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) return lang
  }
  return 'en'
}

const LANGUAGE_NAMES = {
  en: 'English', hi: 'Hindi', ar: 'Arabic', zh: 'Chinese',
  ja: 'Japanese', ko: 'Korean', ru: 'Russian', el: 'Greek',
  fr: 'French', es: 'Spanish', de: 'German', pt: 'Portuguese',
}

const LANGUAGE_FLAGS = {
  en: '🇬🇧', hi: '🇮🇳', ar: '🇸🇦', zh: '🇨🇳',
  ja: '🇯🇵', ko: '🇰🇷', ru: '🇷🇺', el: '🇬🇷',
  fr: '🇫🇷', es: '🇪🇸', de: '🇩🇪', pt: '🇵🇹',
}

const PLACEHOLDERS = {
  en: 'Type your message...', hi: 'अपना संदेश लिखें...',
  ar: 'اكتب رسالتك...', zh: '输入您的消息...',
  ja: 'メッセージを入力...', ko: '메시지를 입력하세요...',
  ru: 'Введите сообщение...', el: 'Γράψτε το μήνυμά σας...',
  fr: 'Écrivez votre message...', es: 'Escribe tu mensaje...',
  de: 'Nachricht eingeben...', pt: 'Digite sua mensagem...',
}

const SUGGESTIONS = [
  { icon: '🌐', text: "What's happening in AI today?" },
  { icon: '💡', text: 'Explain quantum computing simply' },
  { icon: '📈', text: 'Latest stock market news' },
  { icon: '🌍', text: 'Translate "Hello, how are you?" to French' },
]

function TypingDots() {
  return (
    <div className="typing-dots">
      <span /><span /><span />
    </div>
  )
}

function Message({ message }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const copyText = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`msg-row ${isUser ? 'msg-row--user' : 'msg-row--ai'}`}>
      {!isUser && (
        <div className="avatar avatar--ai">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        </div>
      )}
      <div className={`msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--ai'}`}>
        {message.detectedLang && message.detectedLang !== 'en' && (
          <div className="lang-badge">
            {LANGUAGE_FLAGS[message.detectedLang]} Replying in {LANGUAGE_NAMES[message.detectedLang]}
          </div>
        )}
        <div className="msg-content">
          {isUser ? message.content : <ReactMarkdown>{message.content}</ReactMarkdown>}
        </div>
        {!isUser && (
          <button className={`copy-btn ${copied ? 'copy-btn--done' : ''}`} onClick={copyText}>
            {copied ? '✓ Copied' : '⧉ Copy'}
          </button>
        )}
      </div>
      {isUser && (
        <div className="avatar avatar--user">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
          </svg>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [detectedLang, setDetectedLang] = useState('en')
  const [darkMode, setDarkMode] = useState(true)  // ← NEW
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  // ← NEW: apply theme to <html> and save preference
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // ← NEW: load saved theme on first render
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved) setDarkMode(saved === 'dark')
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleInputChange = (e) => {
    const val = e.target.value
    setInput(val)
    if (val.trim().length > 2) setDetectedLang(detectLanguage(val))
    else setDetectedLang('en')
  }

  const sendMessage = async (text) => {
    const userMessage = (text || input).trim()
    if (!userMessage || loading) return

    const lang = detectLanguage(userMessage)
    setInput('')
    setDetectedLang('en')

    const langInstruction = lang !== 'en'
      ? `The user is writing in ${LANGUAGE_NAMES[lang]}. You MUST reply in ${LANGUAGE_NAMES[lang]} only.`
      : ''

    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)
    setSearching(false)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const response = await axios.post(`${API_URL}/chat`, {
        message: userMessage,
        history,
        language_instruction: langInstruction,
        detected_language: lang,
      })

      if (response.data.is_searching) setSearching(true)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.reply,
        detectedLang: lang !== 'en' ? lang : null,
      }])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Could not reach the server. Make sure your backend is running on port 8000.',
      }])
    } finally {
      setLoading(false)
      setSearching(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e) => { e.preventDefault(); sendMessage() }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const showLangHint = detectedLang !== 'en' && input.length > 2

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-logo">
            <div className="logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
            </div>
            <div>
              <div className="header-title">Live AI Assistant</div>
              <div className="header-sub">Powered by web search · speaks your language</div>
            </div>
          </div>

          <div className="header-right">
            {/* ← NEW: theme toggle */}
            <button className="theme-toggle" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
              {darkMode ? '☀️' : '🌙'}
            </button>
            <div className="status-dot">
              <span className="dot-pulse" />
              Online
            </div>
          </div>

        </div>
      </header>

      <main className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <h2>Ask me anything</h2>
            <p>I search the web for real-time answers and reply in your language automatically.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="suggestion-chip" onClick={() => sendMessage(s.text)}>
                  {s.icon} {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <Message key={i} message={msg} />)}

        {loading && (
          <div className="msg-row msg-row--ai">
            <div className="avatar avatar--ai">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
            </div>
            <div className="msg-bubble msg-bubble--ai msg-bubble--loading">
              {searching ? <span className="searching-text">🔍 Searching the web…</span> : <TypingDots />}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <footer className="input-area">
        {showLangHint && (
          <div className="lang-hint">
            {LANGUAGE_FLAGS[detectedLang]} Detected {LANGUAGE_NAMES[detectedLang]} — I'll reply in {LANGUAGE_NAMES[detectedLang]}
          </div>
        )}
        <form className="input-row" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDERS[detectedLang] || PLACEHOLDERS.en}
            disabled={loading}
            className="input-field"
            autoFocus
          />
          <button type="submit" disabled={loading || !input.trim()} className="send-btn">
            {loading ? '⟳' : '➤'}
          </button>
        </form>
        <div className="input-footer">Enter to send · Shift+Enter for new line</div>
      </footer>
    </div>
  )
}