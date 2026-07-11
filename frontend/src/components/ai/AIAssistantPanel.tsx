import { useState, useEffect, useRef, useCallback } from 'react'
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon, StopIcon, ArrowPathIcon} from '@heroicons/react/24/outline'
import { aiApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface Props {
  open: boolean
  onClose: () => void
}

interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  is_loading?: boolean
  error?: string
}

const TRANSITION_MS = 300
const DEFAULT_HEIGHT_RATIO = 0.5 // 40% of screen height
const MIN_HEIGHT_RATIO = 0.25
const MAX_HEIGHT_RATIO = 0.95

export default function AIAssistantPanel({ open, onClose }: Props) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stopRequested, setStopRequested] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Mount / animate state
  const [shouldRender, setShouldRender] = useState(open)
  const [isVisible, setIsVisible] = useState(false)

  // Resizable height state (in px), anchored to bottom of screen
  const [panelHeight, setPanelHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight * DEFAULT_HEIGHT_RATIO : 400
  )
  const isDraggingRef = useRef(false)
  const dragStartYRef = useRef(0)
  const dragStartHeightRef = useRef(0)

  const clampHeight = useCallback((h: number) => {
    const min = window.innerHeight * MIN_HEIGHT_RATIO
    const max = window.innerHeight * MAX_HEIGHT_RATIO
    return Math.min(Math.max(h, min), max)
  }, [])

  // Keep height sane on window resize
  useEffect(() => {
    const onResize = () => setPanelHeight((h) => clampHeight(h))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clampHeight])

  const handleDragMove = useCallback((clientY: number) => {
    // Dragging the top edge up should increase height (linear 1:1 with mouse movement)
    const delta = dragStartYRef.current - clientY
    const next = clampHeight(dragStartHeightRef.current + delta)
    setPanelHeight(next)
  }, [clampHeight])

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false
    window.removeEventListener('mousemove', onMouseMoveRef.current)
    window.removeEventListener('mouseup', onMouseUpRef.current)
    window.removeEventListener('touchmove', onTouchMoveRef.current)
    window.removeEventListener('touchend', onMouseUpRef.current)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  // Stable refs so we can add/remove the exact same listener functions
  const onMouseMoveRef = useRef((e: MouseEvent) => handleDragMove(e.clientY))
  const onTouchMoveRef = useRef((e: TouchEvent) => {
    if (e.touches[0]) handleDragMove(e.touches[0].clientY)
  })
  const onMouseUpRef = useRef(() => handleDragEnd())

  useEffect(() => {
    onMouseMoveRef.current = (e: MouseEvent) => handleDragMove(e.clientY)
    onTouchMoveRef.current = (e: TouchEvent) => {
      if (e.touches[0]) handleDragMove(e.touches[0].clientY)
    }
    onMouseUpRef.current = () => handleDragEnd()
  }, [handleDragMove, handleDragEnd])

  const startDrag = (clientY: number) => {
    isDraggingRef.current = true
    dragStartYRef.current = clientY
    dragStartHeightRef.current = panelHeight
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMoveRef.current)
    window.addEventListener('mouseup', onMouseUpRef.current)
    window.addEventListener('touchmove', onTouchMoveRef.current, { passive: false })
    window.addEventListener('touchend', onMouseUpRef.current)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startDrag(e.clientY)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) startDrag(e.touches[0].clientY)
  }

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      return
    }
    setIsVisible(false)
    const timer = setTimeout(() => setShouldRender(false), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!shouldRender || !open) return
    let frame2 = 0
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => setIsVisible(true))
    })
    return () => {
      cancelAnimationFrame(frame1)
      if (frame2) cancelAnimationFrame(frame2)
    }
  }, [shouldRender, open])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Add welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! How Can i Help With?',
          timestamp: new Date().toISOString(),
        }
      ])
    }
  }, [open, messages.length])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setStopRequested(false)

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController()

    try {
      const response = await aiApi.chat(text, abortControllerRef.current.signal)

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User stopped the generation
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Generation stopped by user.',
          timestamp: new Date().toISOString(),
        }])
      } else {
        const errorMessage = err.response?.data?.error || 'Failed to get response from AI assistant'
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'I encountered an error processing your request. Please try again.',
          timestamp: new Date().toISOString(),
          error: errorMessage,
        }])
        toast.error(errorMessage)
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setStopRequested(true)
    }
  }

  const retryLastMessage = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMessage) {
      // Remove the last assistant message (error response)
      setMessages(prev => prev.slice(0, -1))
      setInput(lastUserMessage.content)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!shouldRender) return null

  return (
    <>
      <div
        onClick={onClose}
        className={clsx(
          "fixed inset-0 z-40 transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
      />

      <div
        style={{ height: `${panelHeight}px` }}
        className={clsx(
          'fixed bottom-8 right-4 w-96 max-w-[calc(100vw-2rem)]',
          'bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-200/80 dark:ring-gray-700/80 shadow-2xl text-gray-900 dark:text-gray-100',
          'z-50 flex flex-col overflow-hidden',
          'transition-[transform] duration-300 ease-out motion-reduce:transition-none',
          isVisible ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        )}
      >
        {/* Drag handle / expander */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="group flex items-center justify-center h-3 cursor-ns-resize flex-shrink-0 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 hover:bg-purple-100 dark:hover:bg-gray-700"
          title="Drag to resize"
        >
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-purple-400" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50 dark:bg-gray-900">
          {messages.map((msg) => (
            <div key={msg.id} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={clsx('max-w-[85%] flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
                <div className={clsx(
                  'flex items-center gap-2 text-xs text-gray-500 px-1',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}>
                  <span className="font-medium">
                    {msg.role === 'user' ? user?.first_name || 'You' : 'AI Assistant'}
                  </span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}</span>
                </div>

                <div className={clsx(
                  'px-4 py-3 rounded-2xl text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-md whitespace-pre-wrap'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-bl-md border border-gray-200 dark:border-gray-700 shadow-sm'
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="markdown-body prose prose-sm max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-table:my-2 prose-th:border prose-th:border-gray-300 prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-gray-300 prose-td:px-2 prose-td:py-1 prose-a:text-purple-600">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>

                {msg.error && (
                  <button
                    onClick={retryLastMessage}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 mt-1"
                  >
                    <ArrowPathIcon className="w-3 h-3" />
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
              <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about projects, tasks, employees..."
              rows={1}
              disabled={loading}
              className="input flex-1 py-2 resize-none"
              style={{ minHeight: '38px', maxHeight: '120px' }}
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            {loading ? (
              <button
                onClick={stopGeneration}
                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex-shrink-0"
                title="Stop generation"
              >
                <StopIcon className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                title="Send"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}