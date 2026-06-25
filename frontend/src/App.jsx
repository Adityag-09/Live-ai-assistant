import { lazy, Suspense } from 'react'
const SyntaxHighlighter = lazy(() => import('react-syntax-highlighter').then(m => ({ default: m.Prism })))
const oneDark = import('react-syntax-highlighter/dist/esm/styles/prism').then(m => m.oneDark)
import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import './App.css'


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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

const ALL_SUGGESTIONS = [
  { icon: '🌐', text: "What's happening in AI today?" },
  { icon: '💡', text: 'Explain quantum computing simply' },
  { icon: '📈', text: 'Latest stock market news' },
  { icon: '🌍', text: 'Translate "Hello, how are you?" to French' },
  { icon: '🚀', text: 'What are the latest space discoveries?' },
  { icon: '🎬', text: 'Top movies releasing this week' },
  { icon: '🤖', text: 'What can you help me with?' },
  { icon: '💰', text: 'What is Bitcoin price right now?' },
  { icon: '🧬', text: 'Latest breakthroughs in science' },
  { icon: '⚽', text: 'Latest football scores today' },
  { icon: '🌦️', text: "What's the weather like today?" },
  { icon: '📱', text: 'Best smartphones of 2025' },
  { icon: '🎵', text: 'Top trending songs right now' },
  { icon: '🍕', text: 'Give me a quick pasta recipe' },
  { icon: '💪', text: 'Best exercises for beginners at home' },
  { icon: '📚', text: 'Recommend me a book to read' },
  { icon: '🧠', text: 'How does the human brain work?' },
  { icon: '🌙', text: 'Fun facts about the moon' },
  { icon: '🐍', text: 'Teach me a Python tip in 1 minute' },
  { icon: '💼', text: 'How to ace a job interview?' },
  { icon: '🎮', text: 'Best games releasing this month' },
  { icon: '✈️', text: 'Best travel destinations in 2025' },
  { icon: '📰', text: "What's the biggest news today?" },
  { icon: '🔐', text: 'How to stay safe online?' },
  { icon: '🌿', text: 'Easy tips to live more sustainably' },
  { icon: '🧪', text: 'Explain DNA in simple terms' },
  { icon: '💬', text: 'How to improve my communication skills?' },
  { icon: '🪐', text: 'Tell me something amazing about space' },
  { icon: '📊', text: 'How does the stock market work?' },
  { icon: '🎯', text: 'How to stay productive all day?' },
]
const SUGGESTIONS = ALL_SUGGESTIONS.sort(() => Math.random() - 0.5).slice(0, 4)

const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' }
  if (hour < 17) return { text: 'Good afternoon', emoji: '👋' }
  if (hour < 21) return { text: 'Good evening', emoji: '🌆' }
  return { text: 'Good night', emoji: '🌙' }
}
const getFollowUpSuggestions = (content, userMsg) => {
  const text = (content + ' ' + userMsg).toLowerCase()
  if (text.match(/code|function|error|bug|python|javascript|html|css/))
    return ['🔍 Explain this further', '🐛 How to debug this?', '💡 Show me an example']
  if (text.match(/news|latest|today|current|price|stock|bitcoin/))
    return ['📰 Tell me more', '📊 Any related trends?', '🔄 What happened before this?']
  if (text.match(/health|exercise|diet|fitness|food|recipe/))
    return ['🥗 Give me more tips', '📋 Make a plan for me', '⚡ Quick version?']
  if (text.match(/history|science|math|explain|what is|how does/))
    return ['🧠 Go deeper', '📚 Give examples', '🎯 Simplify this']
  if (text.match(/travel|place|country|city|visit/))
    return ['🗺️ Best time to visit?', '💰 How much does it cost?', '🏨 Where to stay?']
  return ['💡 Tell me more', '🔍 Search for latest', '📋 Summarize this']
}
const authAxios = (token) => axios.create({
  baseURL: API_URL,
  headers: { Authorization: `Bearer ${token}` },
  timeout: 60000,
})

// ── Particle canvas ───────────────────────────────────────
function ParticleCanvas({ darkMode }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const COLOR = darkMode ? '255,255,255' : '79,143,255'
    const particles = Array.from({ length: 72 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.6,
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 130) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(${COLOR},${(1 - dist / 130) * (darkMode ? 0.15 : 0.12)})`
            ctx.lineWidth = 0.6
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${COLOR},${darkMode ? 0.45 : 0.35})`
        ctx.fill()
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [darkMode])
  return <canvas ref={canvasRef} className="particle-canvas" />
}

// ── Auth Page ─────────────────────────────────────────────
function AuthPage({ onAuth, darkMode, onGuestMode }) {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pwdStrength, setPwdStrength] = useState(0)

  const getPasswordStrength = (pwd) => {
    let score = 0
    if (pwd.length >= 6) score++
    if (pwd.length >= 10) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    return score
  }

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
  const strengthColor = ['', '#f87171', '#fb923c', '#facc15', '#4ade80', '#22c55e']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!isLogin) {
      if (!email.includes('@') || !email.includes('.')) { setError('Please enter a valid email address'); return }
      if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    }
    setLoading(true)
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup'
      const payload = isLogin ? { email, password } : { name, email, password }
      const res = await axios.post(`${API_URL}${endpoint}`, payload, { timeout: 60000 })
      onAuth(res.data.token, res.data.user)
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Server is waking up, please wait 30 seconds and try again')
      } else if (!err.response) {
        setError('Cannot reach server. Check your connection and try again')
      } else {
        setError(err.response?.data?.detail || 'Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <ParticleCanvas darkMode={darkMode} />
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        </div>
        <h1 className="auth-title">Aura</h1>
        <p className="auth-sub">{isLogin ? 'Welcome back!' : 'Create your account'}</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <input type="text" placeholder="Your name" value={name}
              onChange={e => setName(e.target.value)} className="auth-input" required />
          )}
          <input type="email" placeholder="Email address" value={email}
            onChange={e => setEmail(e.target.value)} className="auth-input" required />
          <div>
            <input type="password" placeholder="Password" value={password}
              onChange={e => { setPassword(e.target.value); setPwdStrength(getPasswordStrength(e.target.value)) }}
              className="auth-input" required />
            {!isLogin && password.length > 0 && (
              <div className="pwd-strength">
                <div className="pwd-strength-bar">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="pwd-strength-seg"
                      style={{ background: i <= pwdStrength ? strengthColor[pwdStrength] : 'var(--border)' }} />
                  ))}
                </div>
                <span style={{ color: strengthColor[pwdStrength], fontSize: '0.72rem' }}>
                  {strengthLabel[pwdStrength]}
                </span>
              </div>
            )}
          </div>
          {error && (
            <div className="auth-error">
              {error.includes('waking up') ? '⏳ ' : '⚠️ '}{error}
            </div>
          )}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="auth-loading">●●●</span> : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <button onClick={() => { setIsLogin(!isLogin); setError('') }}>
            {isLogin ? ' Sign Up' : ' Sign In'}
          </button>
        </p>

        <div className="auth-divider">or</div>
        <button className="guest-btn" onClick={onGuestMode}>
          Continue as Guest
        </button>
        <p className="guest-note">⚠️ Guest chats are not saved</p>
      </div>
    </div>
  )
}

// ── Typing dots ───────────────────────────────────────────
function TypingDots() {
  return <div className="typing-dots"><span /><span /><span /></div>
}

// ── Message ───────────────────────────────────────────────
function Message({ message, onRegenerate, isLast }) {
  const [copied, setCopied] = useState(false)
  const [reaction, setReaction] = useState(null)
  const [showReactions, setShowReactions] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translatedContent, setTranslatedContent] = useState(null)
  const [showTranslatePicker, setShowTranslatePicker] = useState(false)
  const TRANSLATE_LANGS = ['Hindi', 'French', 'Spanish', 'German', 'Arabic', 'Chinese', 'Japanese']

  const handleTranslate = async (lang) => {
    setShowTranslatePicker(false)
    setTranslating(true)
    try {
      const res = await fetch(`${API_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.content, target_language: lang })
      })
      const data = await res.json()
      setTranslatedContent(data.translated)
    } catch {}
    setTranslating(false)
  }
  const isUser = message.role === 'user'
  const REACTIONS = ['👍', '👎', '😂', '🤔', '❤️']
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
        {message.detectedLang && (
          <div className="lang-badge">{LANGUAGE_FLAGS[message.detectedLang]} Replying in {LANGUAGE_NAMES[message.detectedLang]}</div>
        )}
        <div className="msg-content">
          {isUser && message.attachedFile && (
            <div className="msg-file-preview">
              {message.attachedFile.type === 'image' && message.attachedFile.preview ? (
                <img src={message.attachedFile.preview} alt={message.attachedFile.name} className="msg-image-preview" />
              ) : (
                <div className="msg-file-chip">
                  <span>{message.attachedFile.name.endsWith('.pdf') ? '📄' :
                    message.attachedFile.name.match(/\.(xlsx|csv)$/) ? '📊' :
                    message.attachedFile.name.match(/\.(docx|doc)$/) ? '📝' :
                    message.attachedFile.name.match(/\.(py|js|jsx|ts|tsx|json)$/) ? '💻' : '📎'}
                  </span>
                  <span>{message.attachedFile.name}</span>
                </div>
              )}
            </div>
          )}
          {isUser ? message.content : (
            <ReactMarkdown
              key={translatedContent ? 'translated' : 'original'}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ borderRadius: '8px', fontSize: '0.82rem', margin: '0.5rem 0' }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  )
                }
              }}
            >
              {translatedContent || message.content}
            </ReactMarkdown>
          )}
        </div>
        <div className="msg-footer">
          {message.timestamp && <span className="msg-time">{formatTime(message.timestamp)}</span>}
          {!isUser && (
            <div className="msg-actions">
              <button className={`copy-btn ${copied ? 'copy-btn--done' : ''}`} onClick={copyText}>
                {copied ? '✓ Copied' : '⧉ Copy'}
              </button>
              {isLast && onRegenerate && (
                <button className="regen-btn" onClick={onRegenerate}>🔄 Retry</button>
              )}
              <div className="reaction-wrap">
                {!isUser && (
                <div className="translate-wrap">
                  <button className="translate-btn" onClick={() => setShowTranslatePicker(p => !p)} title="Translate">
                    {translating ? '⏳' : '🌐'}
                  </button>
                  {showTranslatePicker && (
                    <div className="translate-picker">
                      {TRANSLATE_LANGS.map(l => (
                        <button key={l} onClick={() => handleTranslate(l)}>{l}</button>
                      ))}
                      {translatedContent && <button onClick={() => setTranslatedContent(null)}>✕ Original</button>}
                    </div>
                  )}
                </div>
              )}
                {reaction ? (
                  <button className="reaction-chosen" onClick={() => setReaction(null)}>
                    {reaction}
                  </button>
                ) : (
                  <div className="reaction-trigger-wrap">
                    <button className="reaction-trigger" onClick={() => setShowReactions(r => !r)}>
                      🙂
                    </button>
                    {showReactions && (
                      <div className="reaction-picker">
                        {REACTIONS.map(r => (
                          <button key={r} onClick={() => { setReaction(r); setShowReactions(false) }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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

// ── Sidebar ───────────────────────────────────────────────
function Sidebar({ sessions, currentSessionId, onSelectSession, onNewChat, onDeleteSession, user, onLogout, darkMode, setDarkMode, open, setOpen, isGuest, onSignIn }) {
  const [sidebarSearch, setSidebarSearch] = useState('')
  const filteredSessions = sessions.filter(s =>
    (s.title || '').toLowerCase().includes(sidebarSearch.toLowerCase())
  )
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${!open ? 'sidebar--collapsed' : 'sidebar--open'}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={onNewChat}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Chat
          </button>
        </div>

        <div className="sidebar-sessions">
          <div className="sidebar-label-row">
            <span className="sidebar-label">Recent Chats</span>
            {sessions.length > 0 && (
              <span className="sidebar-badge">{sessions.length}</span>
            )}
          </div>
          {sessions.length > 3 && (
            <input
              type="text"
              className="sidebar-search"
              placeholder="Search chats..."
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
            />
          )}
          {isGuest ? (
            <div className="sidebar-empty">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔒</div>
              <div>Sign in to see history</div>
              <div style={{ fontSize: '0.72rem', marginTop: '0.25rem', opacity: 0.7 }}>Guest chats are not saved</div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="sidebar-empty">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💬</div>
              <div>No chats yet</div>
              <div style={{ fontSize: '0.72rem', marginTop: '0.25rem', opacity: 0.7 }}>Start a conversation!</div>
            </div>
          ) : (
            filteredSessions.map(s => (
              <div key={s.session_id}
                className={`session-item ${s.session_id === currentSessionId ? 'session-item--active' : ''}`}
                onClick={() => { onSelectSession(s.session_id); setOpen(false) }}
              >
                <span className="session-title">{s.title || 'Untitled Chat'}</span>
                <button className="session-delete" onClick={e => { e.stopPropagation(); onDeleteSession(s.session_id) }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <button className="theme-toggle-side" onClick={() => setDarkMode(d => !d)}>
            {darkMode ? '☀️ Light mode' : '🌙 Dark mode'}
          </button>
          {isGuest ? (
            <button className="signin-from-sidebar" onClick={onSignIn}>
              🔐 Sign in to save history
            </button>
          ) : (
            <div className="sidebar-user">
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user?.name}</div>
                <div className="sidebar-user-email">{user?.email}</div>
              </div>
              <button className="logout-btn" onClick={onLogout} title="Logout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [followUps, setFollowUps] = useState([])
  const [customPrompt, setCustomPrompt] = useState(() => localStorage.getItem('customPrompt') || '')
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'))
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [detectedLang, setDetectedLang] = useState('en')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')
  const [sessionId, setSessionId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const [guestMessageCount, setGuestMessageCount] = useState(0)
  const [showNudge, setShowNudge] = useState(true)
  const [serverWaking, setServerWaking] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const lastUserMessageRef = useRef('')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstall, setShowInstall] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)
  const [attachedFile, setAttachedFile] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const container = document.querySelector('.messages')
    if (!container) return
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 150)
    }
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollBtn(false)
  }
  useEffect(() => {
    if (showSearch) searchRef.current?.focus()
  }, [showSearch])

  useEffect(() => {
    const handleKeyboard = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        handleNewChat()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
        setSearchQuery('')
        setShowExportMenu(false)
      }
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [])

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp * 1000 < Date.now()) {
          handleLogout()
          return
        }
      } catch {}
      fetchSessions()
    }
  }, [token])

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setShowInstall(false)
    setInstallPrompt(null)
  }

  const fetchSessions = async () => {
    try {
      const res = await authAxios(token).get('/sessions')
      setSessions(res.data.sessions || [])
    } catch (err) {
      if (err.response?.status === 401) handleLogout()
    }
  }

  const handleAuth = (newToken, newUser) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
    setIsGuest(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
    setMessages([])
    setSessionId(null)
    setSessions([])
    setIsGuest(false)
  }

  const handleSignIn = () => {
    setIsGuest(false)
    setMessages([])
    setSessionId(null)
  }

  const handleNewChat = () => {
    setMessages([])
    setSessionId(null)
    inputRef.current?.focus()
  }

  const [loadingHistory, setLoadingHistory] = useState(false)

  const handleSelectSession = async (sid) => {
    setLoadingHistory(true)
    setMessages([])
    setSessionId(sid)
    try {
      const res = await authAxios(token).get(`/history/${sid}`)
      if (res.data.messages) {
        setMessages(res.data.messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp })))
      }
    } catch (err) {
      if (err.response?.status === 401) handleLogout()
    }
    finally { setLoadingHistory(false) }
  }
  const handleDeleteSession = async (sid) => {
    try {
      await authAxios(token).delete(`/history/${sid}`)
      setSessions(prev => prev.filter(s => s.session_id !== sid))
      if (sid === sessionId) handleNewChat()
    } catch {}
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setInput(val)
    if (val.trim().length > 2) setDetectedLang(detectLanguage(val))
    else setDetectedLang('en')
  }

  const sendMessage = async (text) => {
    const userMessage = (text || input).trim()
    if (!userMessage || loading) return

    // Image generation command
    const imageMatch = userMessage.match(/^\/image\s+(.+)/i) ||
      userMessage.match(/^generate (?:an? )?image (?:of|about|showing)?\s*(.+)/i) ||
      userMessage.match(/^create (?:an? )?image (?:of|about|showing)?\s*(.+)/i) ||
      userMessage.match(/^draw (?:me )?(?:an? )?(.+)/i)
    if (imageMatch) {
      const prompt = imageMatch[1].trim()
      if (!prompt) return
      setInput('')
      setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date().toISOString() }])
      setLoading(true)
      try {
        const res = await fetch(`${API_URL}/generate-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ prompt, session_id: sessionId || null })
        })
        const data = await res.json()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `🎨 **Generated image for:** "${prompt}"\n\n![${prompt}](${data.image_url})`,
          timestamp: new Date().toISOString(),
        }])
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Could not generate image. Try again.', timestamp: new Date().toISOString() }])
      }
      setLoading(false)
      if (!isGuest) fetchSessions()
      return
    }
    if (navigator.vibrate) navigator.vibrate(30)

    const lang = detectLanguage(userMessage)
    lastUserMessageRef.current = userMessage
    setInput('')
    setDetectedLang('en')
    setAttachedFile(null)
    setFollowUps([])

    const langInstruction = lang !== 'en'
      ? `The user is writing in ${LANGUAGE_NAMES[lang]}. You MUST reply in ${LANGUAGE_NAMES[lang]} only.`
      : ''
    const timestamp = new Date().toISOString()
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage, 
      timestamp,
      attachedFile: attachedFile ? { name: attachedFile.name, type: attachedFile.type, preview: attachedFile.preview } : null
    }])
    setLoading(true)
    setSearching(false)

    const wakingTimer = setTimeout(() => setServerWaking(true), 5000)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const endpoint = isGuest ? '/chat/guest/stream' : '/chat/stream'
      const headers = isGuest
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage, 
          history,
          language_instruction: langInstruction,
          detected_language: lang,
          session_id: sessionId,
          file_context: attachedFile?.content || null,
          file_type: attachedFile?.type || null,
          file_name: attachedFile?.name || null,
          mime_type: attachedFile?.mime || null,
          custom_prompt: customPrompt || null,
        }),
      })

      if (!response.ok) {
  if (response.status === 401) { handleLogout(); return }
  if (response.status === 429) {
    const errData = await response.json()
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: errData.detail || '⏳ Rate limit reached. Please wait before sending more messages.',
      timestamp: new Date().toISOString(),
    }])
    setLoading(false)
    return
  }
  throw new Error(`Server error: ${response.status}`)
}

      clearTimeout(wakingTimer)
      setServerWaking(false)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let streamingContent = ''
      let newSessionId = sessionId

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        detectedLang: lang !== 'en' ? lang : null,
        timestamp: new Date().toISOString(),
        streaming: true,
      }])

      while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value, { stream: true })
  const lines = chunk.split('\n')

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const raw = line.slice(6).trim()
    if (!raw) continue
    try {
      const data = JSON.parse(raw)

      if (data.type === 'status') {
        if (data.is_searching) setSearching(true)
        if (data.session_id) newSessionId = data.session_id
      }

      if (data.type === 'chunk') {
        streamingContent += data.content
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: streamingContent,
            }
          }
          return updated
        })
      }

      if (data.type === 'done') {
        setSearching(false)
        setLoading(false)
        if (data.session_id) newSessionId = data.session_id
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last) {
            updated[updated.length - 1] = { ...last, streaming: false }
            setFollowUps(getFollowUpSuggestions(last.content || '', userMessage))
          }
          return updated
        })
      }

      if (data.type === 'error') {
        throw new Error(data.message)
      }
    } catch (e) {
      // skip malformed JSON
    }
  }
}

      setSessionId(newSessionId)
      if (isGuest) setGuestMessageCount(c => c + 1)
      else fetchSessions()

    } catch (err) {
      clearTimeout(wakingTimer)
      setServerWaking(false)
      if (err.message?.includes('401')) handleLogout()
      else if (err.message?.includes('timeout') || err.name === 'AbortError') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '⏳ Server took too long. It may be waking up — please try again in 30 seconds.',
          timestamp: new Date().toISOString(),
        }])
      } 
      else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '⚠️ Could not reach the server. Please check your connection.',
          timestamp: new Date().toISOString(),
        }])
      }
    } finally {
      setLoading(false)
      setSearching(false)
      inputRef.current?.focus()
    }
  }
  const handleFileSelect = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  const MAX = 10 * 1024 * 1024
  if (file.size > MAX) {
    alert('File too large. Maximum size is 10MB.')
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.detail || 'Failed to process file.')
      return
    }
    const data = await res.json()
    setAttachedFile({
      name: data.filename,
      type: data.type,
      content: data.type === 'text' ? data.content : data.b64,
      mime: data.mime_type || null,
      preview: data.type === 'image' ? `data:${data.mime_type};base64,${data.b64}` : null,
    })
  } catch {
    alert('Could not upload file. Please try again.')
  }
  e.target.value = ''
}
const exportAsTxt = () => {
  if (!messages.length) return
  const lines = messages.map(m => {
    const role = m.role === 'user' ? 'You' : 'AI Assistant'
    const time = m.timestamp ? `[${formatTime(m.timestamp)}]` : ''
    return `${role} ${time}\n${m.content}\n`
  })
  const blob = new Blob([lines.join('\n---\n\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chat-${new Date().toISOString().slice(0,10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
  setShowExportMenu(false)
}

const exportAsPdf = () => {
  if (!messages.length) return
  const printWindow = window.open('', '_blank')
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Chat Export</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          background: #f0f2f5;
          color: #1a1a2e;
          padding: 30px 20px;
        }
        .page { max-width: 780px; margin: 0 auto; }

        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 16px;
          padding: 24px 28px;
          margin-bottom: 28px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .header-icon { font-size: 2rem; }
        .header-title { font-size: 1.3rem; font-weight: 700; }
        .header-sub { font-size: 0.82rem; opacity: 0.85; margin-top: 3px; }

        .messages { display: flex; flex-direction: column; gap: 14px; }

        .msg-wrap { display: flex; flex-direction: column; }
        .msg-wrap.user { align-items: flex-end; }
        .msg-wrap.ai { align-items: flex-start; }

        .role-label {
          font-size: 0.72rem;
          font-weight: 600;
          margin-bottom: 4px;
          color: #666;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .bubble {
          max-width: 82%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 0.9rem;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .user .bubble {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .ai .bubble {
          background: white;
          color: #1a1a2e;
          border: 1px solid #e0e0e0;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .time-label {
          font-size: 0.68rem;
          color: #aaa;
          margin-top: 4px;
          padding: 0 4px;
        }

        .footer {
          text-align: center;
          margin-top: 32px;
          font-size: 0.75rem;
          color: #aaa;
          padding-top: 16px;
          border-top: 1px solid #ddd;
        }

        @media print {
          body { background: white; padding: 0; }
          .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .user .bubble { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="header-icon">✨</div>
          <div>
            <div class="header-title">Live AI Assistant — Chat Export</div>
            <div class="header-sub">${messages.length} messages · Exported on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
        <div class="messages">
          ${messages.map(m => `
            <div class="msg-wrap ${m.role === 'user' ? 'user' : 'ai'}">
              <div class="role-label">${m.role === 'user' ? '👤 You' : '🤖 AI Assistant'}</div>
              <div class="bubble">${m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              ${m.timestamp ? `<div class="time-label">${formatTime(m.timestamp)}</div>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="footer">Generated by Live AI Assistant · live-ai-frontend.onrender.com</div>
      </div>
    </body>
    </html>
  `
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => { printWindow.print(); printWindow.close() }, 500)
  setShowExportMenu(false)
}

const copyShareLink = () => {
  if (!messages.length) return
  const summary = messages.slice(0, 3).map(m =>
    `${m.role === 'user' ? 'Q' : 'A'}: ${m.content.slice(0, 80)}`
  ).join(' | ')
  const shareText = `Chat on Live AI Assistant:\n${summary}...\n\nhttps://live-ai-frontend.onrender.com`
  navigator.clipboard.writeText(shareText)
  alert('Share text copied to clipboard!')
  setShowExportMenu(false)
}
  const handleVoiceInput = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    alert('Voice input is not supported in this browser. Please use Chrome or Edge.')
    return
  }
  if (isListening) {
    recognitionRef.current?.stop()
    setIsListening(false)
    return
  }
  const recognition = new SpeechRecognition()
  recognitionRef.current = recognition
  recognition.continuous = false
  recognition.interimResults = false
  recognition.lang = detectedLang === 'en' ? 'en-US'
    : detectedLang === 'hi' ? 'hi-IN'
    : detectedLang === 'ar' ? 'ar-SA'
    : detectedLang === 'zh' ? 'zh-CN'
    : detectedLang === 'ja' ? 'ja-JP'
    : detectedLang === 'ko' ? 'ko-KR'
    : detectedLang === 'ru' ? 'ru-RU'
    : detectedLang === 'fr' ? 'fr-FR'
    : detectedLang === 'es' ? 'es-ES'
    : detectedLang === 'de' ? 'de-DE'
    : detectedLang === 'pt' ? 'pt-PT'
    : 'en-US'
  recognition.onstart = () => setIsListening(true)
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    setIsListening(false)
    sendMessage(transcript)
  }
  recognition.onerror = (event) => {
    setIsListening(false)
    if (event.error === 'not-allowed')
      alert('Microphone access denied. Please allow mic permissions and try again.')
  }
  recognition.onend = () => setIsListening(false)
  recognition.start()
}
  const handleRegenerate = () => {
    if (lastUserMessageRef.current) {
      setMessages(prev => prev.slice(0, -1))
      sendMessage(lastUserMessageRef.current)
    }
  }

  const handleSubmit = (e) => { e.preventDefault(); sendMessage() }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (!token && !isGuest) return (
    <AuthPage
      onAuth={handleAuth}
      darkMode={darkMode}
      onGuestMode={() => { setIsGuest(true); setGuestMessageCount(0); setShowNudge(true) }}
    />
  )

  const showLangHint = detectedLang !== 'en' && input.length > 2

  return (
    <div className="app">
      <ParticleCanvas darkMode={darkMode} />

      <Sidebar
        sessions={sessions}
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        user={user}
        onLogout={handleLogout}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        isGuest={isGuest}
        onSignIn={handleSignIn}
      />

      <div className="main">
        <header className="header">
          <div className="header-inner">
            <div className="header-left">
              <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <div className="header-logo">
                <div className="logo-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                  </svg>
                </div>
                <div>
                  <div className="header-title">Aura</div>
                  <div className="header-sub">
                    {isGuest ? '👤 Guest Mode — chats not saved' : 'Powered by web search · speaks your language'}
                  </div>
                </div>
              </div>
            </div>
            <div className="header-right">
              {messages.length > 0 && (
                <div className="export-menu-wrap">
                  <button
                    className="export-btn"
                    onClick={() => setShowExportMenu(o => !o)}
                    title="Export / Share"
                  >
                    ⬆ Share
                  </button>
                  {showExportMenu && (
                    <>
                      <div className="export-overlay" onClick={() => setShowExportMenu(false)} />
                      <div className="export-dropdown">
                        <button onClick={exportAsTxt}>📄 Download TXT</button>
                        <button onClick={exportAsPdf}>🖨️ Export as PDF</button>
                        <button onClick={copyShareLink}>🔗 Copy Share Link</button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {showInstall && (
                <button className="install-btn" onClick={handleInstall}>
                  📲 Install
                </button>
              )}

              {isGuest && (
                <button className="signin-header-btn" onClick={handleSignIn}>
                  Sign In
                </button>
              )} 

              {messages.length > 0 && (
                <button className="theme-toggle" onClick={() => setShowSearch(s => !s)} title="Search messages">
                  🔍
                </button>
              )}

              <button className="theme-toggle" onClick={() => setDarkMode(d => !d)}>
                {darkMode ? '☀️' : '🌙'}
              </button>
              <button className="theme-toggle" onClick={() => setShowSettings(s => !s)} title="Settings">
                ⚙️
              </button>
              <div className="status-dot"><span className="dot-pulse" />Online</div>
            </div>
          </div>
          {showSettings && (
            <div className="settings-panel">
              <div className="settings-header">
                <span>⚙️ AI Personality</span>
                <button onClick={() => setShowSettings(false)}>✕</button>
              </div>
              <textarea
                className="settings-textarea"
                placeholder="Customize how Aura behaves... e.g. 'You are a coding expert. Always give code examples. Be very concise.'"
                value={customPrompt}
                onChange={e => { setCustomPrompt(e.target.value); localStorage.setItem('customPrompt', e.target.value) }}
                rows={4}
              />
              <div className="settings-footer">
                <button className="settings-clear" onClick={() => { setCustomPrompt(''); localStorage.removeItem('customPrompt') }}>
                  Reset to default
                </button>
                <button className="settings-save" onClick={() => setShowSettings(false)}>
                  Save & Close
                </button>
              </div>
            </div>
          )}
          {showSearch && (
            <div className="search-bar">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button onClick={() => { setShowSearch(false); setSearchQuery('') }}>✕</button>
            </div>
          )}
        </header>

        <main className="messages">
          {isGuest && guestMessageCount >= 3 && showNudge && (
            <div className="guest-nudge">
              💾 <strong>Save your chat history</strong> — Sign in to keep your conversations
              <button onClick={handleSignIn}>Sign In</button>
              <button className="guest-nudge-dismiss" onClick={() => setShowNudge(false)}>✕</button>
            </div>
          )}

          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">{getGreeting().emoji}</div>
              <h2>{getGreeting().text}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!</h2>
              <p>
                {isGuest
                  ? '👤 Guest mode — chats not saved. Sign in to keep your history!'
                  : "I'm Aura. I search the web, read files, and reply in your language."}
              </p>
              <div className="empty-date">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => sendMessage(s.text)}>
                    {s.icon} {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages
            .filter(msg => !searchQuery || msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((msg, i) => (
              <Message
                key={i}
                message={msg}
                isLast={i === messages.length - 1}
                onRegenerate={msg.role === 'assistant' ? handleRegenerate : null}
              />
            ))}
          {searchQuery && messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem', padding: '2rem' }}>
              No messages found for "{searchQuery}"
            </div>
          )}

          {loadingHistory && (
            <div className="skeleton-wrap">
              {[1,2,3].map(i => (
                <div key={i} className={`skeleton-row ${i % 2 === 0 ? 'skeleton-row--right' : ''}`}>
                  <div className="skeleton-bubble" style={{ width: `${i === 2 ? 55 : i === 1 ? 75 : 65}%` }} />
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="msg-row msg-row--ai">
              <div className="avatar avatar--ai">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                </svg>
              </div>
              <div className="msg-bubble msg-bubble--ai msg-bubble--loading">
                {serverWaking
                  ? <span className="searching-text">⏳ Waking up server...</span>
                  : searching
                  ? <span className="searching-text">🔍 Searching the web...</span>
                  : attachedFile
                  ? <span className="searching-text">📄 Reading your file...</span>
                  : <span className="searching-text">✨ Thinking...</span>
                }
              </div>
            </div>
          )}
          {followUps.length > 0 && !loading && (
            <div className="followup-chips">
              {followUps.map((s, i) => (
                <button key={i} className="followup-chip" onClick={() => { setFollowUps([]); sendMessage(s.replace(/^[^\s]+\s/, '')) }}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        <footer className="input-area">
          {attachedFile && (
            <div className="file-chip">
              {attachedFile.type === 'image' && attachedFile.preview && (
                <img src={attachedFile.preview} alt="preview" style={{ height: '32px', borderRadius: '4px' }} />
              )}
              <span>{attachedFile.type === 'image' ? '🖼️' : '📎'} {attachedFile.name}</span>
              <button type="button" onClick={() => setAttachedFile(null)}>✕</button>
            </div>
          )}
          {showLangHint && (
            <div className="lang-hint">
              {LANGUAGE_FLAGS[detectedLang]} Detected {LANGUAGE_NAMES[detectedLang]} — I'll reply in {LANGUAGE_NAMES[detectedLang]}
            </div>
          )}
          <form className="input-row" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text" value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={input.startsWith('/image') ? '🎨 Describe the image to generate...' : PLACEHOLDERS[detectedLang] || PLACEHOLDERS.en}
              disabled={loading}
              className="input-field"
              autoFocus
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.py,.js,.jsx,.ts,.tsx,.json,.csv,.md,.png,.jpg,.jpeg,.webp,.docx,.xlsx"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Attach file"
              className={`attach-btn ${attachedFile ? 'attach-btn--active' : ''}`}
            >
              📎
            </button>
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={loading}
              title={isListening ? 'Stop listening' : 'Voice input'}
              className={`mic-btn ${isListening ? 'mic-btn--active' : ''}`}
           >
             {isListening ? '⏹' : '🎤'}
            </button>
            <button type="submit" disabled={loading || !input.trim()} className="send-btn">
              {loading ? '⟳' : '➤'}
            </button>
          </form>
          <div className="input-footer">
            Enter to send · Shift+Enter for new line · <span style={{color: 'var(--accent)'}}>type /image to generate images</span>
            {input.length > 50 && (
              <span className={`char-count ${input.length > 900 ? 'char-count--warn' : ''}`}>
                {input.length}/1000
              </span>
            )}
          </div>
        </footer>
        {showScrollBtn && (
          <button className="scroll-bottom-btn" onClick={scrollToBottom}>
            ↓
          </button>
        )}
      </div>
    </div>
  )
}