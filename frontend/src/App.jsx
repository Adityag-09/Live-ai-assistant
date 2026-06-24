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
        <h1 className="auth-title">Live AI Assistant</h1>
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
        {message.detectedLang && (
          <div className="lang-badge">{LANGUAGE_FLAGS[message.detectedLang]} Replying in {LANGUAGE_NAMES[message.detectedLang]}</div>
        )}
        <div className="msg-content">
          {isUser ? message.content : <ReactMarkdown>{message.content}</ReactMarkdown>}
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
          <div className="sidebar-label">Recent Chats</div>
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
            sessions.map(s => (
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
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const lastUserMessageRef = useRef('')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (token) fetchSessions()
  }, [token])

  const fetchSessions = async () => {
    try {
      const res = await authAxios(token).get('/sessions')
      setSessions(res.data.sessions || [])
    } catch {}
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

  const handleSelectSession = async (sid) => {
    try {
      const res = await authAxios(token).get(`/history/${sid}`)
      if (res.data.messages) {
        setMessages(res.data.messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp })))
        setSessionId(sid)
      }
    } catch {}
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

    const lang = detectLanguage(userMessage)
    lastUserMessageRef.current = userMessage
    setInput('')
    setDetectedLang('en')

    const langInstruction = lang !== 'en'
      ? `The user is writing in ${LANGUAGE_NAMES[lang]}. You MUST reply in ${LANGUAGE_NAMES[lang]} only.`
      : ''
    const timestamp = new Date().toISOString()
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp }])
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
        }),
      })

      if (!response.ok) {
        if (response.status === 401) { handleLogout(); return }
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

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'status') {
              if (data.is_searching) setSearching(true)
              if (data.session_id) newSessionId = data.session_id
            }

            if (data.type === 'chunk') {
              streamingContent += data.content
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: streamingContent,
                }
                return updated
              })
            }

            if (data.type === 'done') {
              setSearching(false)
              if (data.session_id) newSessionId = data.session_id
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  streaming: false,
                }
                return updated
              })
            }

            if (data.type === 'error') {
              throw new Error(data.message)
            }
          } catch {}
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
      } else {
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
                  <div className="header-title">Live AI Assistant</div>
                  <div className="header-sub">
                    {isGuest ? '👤 Guest Mode — chats not saved' : 'Powered by web search · speaks your language'}
                  </div>
                </div>
              </div>
            </div>
            <div className="header-right">
              {isGuest && (
                <button className="signin-header-btn" onClick={handleSignIn}>
                  Sign In
                </button>
              )}
              <button className="theme-toggle" onClick={() => setDarkMode(d => !d)}>
                {darkMode ? '☀️' : '🌙'}
              </button>
              <div className="status-dot"><span className="dot-pulse" />Online</div>
            </div>
          </div>
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
              <div className="empty-icon">✨</div>
              <h2>Ask me anything</h2>
              <p>
                {isGuest
                  ? 'You\'re in guest mode. Sign in to save your chat history!'
                  : 'I search the web for real-time answers and reply in your language automatically.'}
              </p>
              <div className="suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => sendMessage(s.text)}>
                    {s.icon} {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <Message
              key={i}
              message={msg}
              isLast={i === messages.length - 1}
              onRegenerate={msg.role === 'assistant' ? handleRegenerate : null}
            />
          ))}

          {loading && (
            <div className="msg-row msg-row--ai">
              <div className="avatar avatar--ai">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                </svg>
              </div>
              <div className="msg-bubble msg-bubble--ai msg-bubble--loading">
                {serverWaking ? <span className="searching-text">⏳ Waking up server...</span>
                  : searching ? <span className="searching-text">🔍 Searching the web…</span>
                  : <TypingDots />}
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
              type="text" value={input}
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
    </div>
  )
}