import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message to UI
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      // Prepare history for backend
      const history = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await axios.post('http://localhost:8000/chat', {
        message: userMessage,
        history: history
      })

      setSearching(response.data.is_searching)

      // Add assistant message to UI
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.reply
      }])

      setSearching(false)
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check if the backend server is running on localhost:8000.'
      }])
      setSearching(false)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e)
    }
  }

  return (
    <div className="app-container">
      <div className="chat-header">
        <h1>Live AI Assistant</h1>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <h2>Welcome to Live AI Assistant</h2>
            <p>Ask me anything and I'll search the web for the latest information if needed.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`message-wrapper ${message.role}`}
          >
            <div className={`message ${message.role}`}>
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-wrapper assistant">
            <div className="message assistant loading-message">
              {searching ? (
                <span className="searching-indicator">
                  🔍 Searching the web...
                </span>
              ) : (
                <span className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={sendMessage}>
        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={loading}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="send-button"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default App
