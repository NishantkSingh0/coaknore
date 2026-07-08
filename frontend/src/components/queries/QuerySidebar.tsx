import { useState, useEffect, useRef, useCallback } from 'react'
import {
  XMarkIcon, PaperAirplaneIcon, PaperClipIcon,
  PlusIcon, CheckCircleIcon, ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { queryApi, orgApi, projectApi } from '../../services/api'
import type { Query, Employee, Project } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  open: boolean
  onClose: () => void
}

type View = 'list' | 'chat' | 'new'

// Keep this in sync with the `duration-300` transition classes below.
const TRANSITION_MS = 300

export default function QuerySidebar({ open, onClose }: Props) {
  const { user } = useAuth()
  const [view, setView] = useState<View>('list')
  const [queries, setQueries] = useState<Query[]>([])
  const [activeQuery, setActiveQuery] = useState<Query | null>(null)
  const [message, setMessage] = useState('')
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const activeQueryRef = useRef<Query | null>(null)
  const listPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // New query form state
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientResults, setRecipientResults] = useState<Employee[]>([])
  const [recipientSearching, setRecipientSearching] = useState(false)
  const [recipientSearched, setRecipientSearched] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<Employee | null>(null)
  const [projectSearch, setProjectSearch] = useState('')
  const [projectResults, setProjectResults] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [subject, setSubject] = useState('')
  const [initialMessage, setInitialMessage] = useState('')
  const [creating, setCreating] = useState(false)

  // ── Mount / animate state for the slide-in / slide-out transition ───────
  // `shouldRender` keeps the panel mounted long enough to play the exit
  // animation; `isVisible` is flipped a frame after mount so the transform
  // transition actually animates instead of snapping straight to place.
  const [shouldRender, setShouldRender] = useState(open)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      return
    }
    setIsVisible(false)
    const timer = setTimeout(() => setShouldRender(false), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [open])

  // Once the panel is mounted off-screen, wait for TWO animation frames
  // before revealing it. A single rAF often fires before the browser has
  // actually painted the off-screen position, so the two style changes get
  // coalesced into one frame and the slide-in never visibly happens. Two
  // frames guarantees the "hidden" state is painted first.
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

  // Keep a ref in sync so polling callbacks always see latest activeQuery
  useEffect(() => {
    activeQueryRef.current = activeQuery
  }, [activeQuery])

  // ── Load + poll query list ────────────────────────────────────────────────
  const loadQueries = useCallback(async (silent = false) => {
    try {
      const res = await queryApi.list({ page_size: 50 })
      setQueries(res.data || [])
    } catch {
      if (!silent) toast.error('Failed to load queries')
    }
  }, [])

  // Start list polling when sidebar is open on list/new views
  useEffect(() => {
    if (!open) {
      if (listPollRef.current) clearInterval(listPollRef.current)
      return
    }
    loadQueries()
    listPollRef.current = setInterval(() => loadQueries(true), 8000)
    return () => {
      if (listPollRef.current) clearInterval(listPollRef.current)
    }
  }, [open, loadQueries])

  // ── Poll active chat for new messages ────────────────────────────────────
  const pollActiveChat = useCallback(async () => {
    const q = activeQueryRef.current
    if (!q) return
    try {
      const updated = await queryApi.get(q.id)
      // Only update if message count changed to avoid cursor disruption
      if ((updated.messages?.length ?? 0) !== (activeQueryRef.current?.messages?.length ?? 0)
        || updated.status !== activeQueryRef.current?.status) {
        setActiveQuery(updated)
      }
    } catch {
      // silent — don't disrupt the chat on poll failure
    }
  }, [])

  useEffect(() => {
    if (view === 'chat' && activeQuery) {
      if (chatPollRef.current) clearInterval(chatPollRef.current)
      chatPollRef.current = setInterval(pollActiveChat, 5000)
    } else {
      if (chatPollRef.current) clearInterval(chatPollRef.current)
    }
    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current)
    }
  }, [view, activeQuery?.id, pollActiveChat])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (view === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeQuery?.messages?.length, view])

  // ── Open a chat ──────────────────────────────────────────────────────────
  const openChat = async (q: Query) => {
    try {
      const full = await queryApi.get(q.id)
      setActiveQuery(full)
      setView('chat')
    } catch {
      toast.error('Failed to load query')
    }
  }

  const goToList = () => {
    setView('list')
    setActiveQuery(null)
    loadQueries(true)
  }

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!activeQuery || (!message.trim() && !attachFile)) return
    setSending(true)
    const text = message.trim()
    setMessage('') // optimistic clear
    try {
      if (text) {
        await queryApi.sendMessage(activeQuery.id, text)
      }
      if (attachFile) {
        await queryApi.uploadFile(activeQuery.id, attachFile)
        setAttachFile(null)
      }
      // Immediately refresh chat after sending
      const updated = await queryApi.get(activeQuery.id)
      setActiveQuery(updated)
    } catch (err: any) {
      setMessage(text) // restore on failure
      toast.error(err.response?.data?.error || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Mark resolved ────────────────────────────────────────────────────────
  const markResolved = async () => {
    if (!activeQuery) return
    try {
      await queryApi.markResolved(activeQuery.id)
      toast.success('Marked as resolved')
      const updated = await queryApi.get(activeQuery.id)
      setActiveQuery(updated)
      loadQueries(true)
    } catch {
      toast.error('Failed to mark resolved')
    }
  }

  // ── Recipient search with debounce ───────────────────────────────────────
  useEffect(() => {
    if (recipientSearch.length < 2) {
      setRecipientResults([])
      setRecipientSearched(false)
      setRecipientSearching(false)
      return
    }
    setRecipientSearching(true)
    const timer = setTimeout(async () => {
      try {
        const results = await orgApi.searchEmployees(recipientSearch)
        setRecipientResults(results || [])
        setRecipientSearched(true)
      } catch {
        setRecipientResults([])
        setRecipientSearched(true)
      } finally {
        setRecipientSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [recipientSearch])

  // ── Project search with debounce ─────────────────────────────────────────
  useEffect(() => {
    if (projectSearch.length < 2) {
      setProjectResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await projectApi.list({ search: projectSearch, page_size: 8 })
        setProjectResults(res.data || [])
      } catch {
        setProjectResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [projectSearch])

  // ── Create query ─────────────────────────────────────────────────────────
  const createQuery = async () => {
    if (!selectedRecipient || !selectedProject || !subject.trim()) {
      toast.error('Recipient, project, and subject are required')
      return
    }
    setCreating(true)
    try {
      const created = await queryApi.create({
        project_id: selectedProject.id,
        recipient_id: selectedRecipient.id,
        subject: subject.trim(),
        message: initialMessage.trim(),
      })
      toast.success('Query sent')
      // Reset form
      setSelectedRecipient(null)
      setSelectedProject(null)
      setSubject('')
      setInitialMessage('')
      setRecipientSearch('')
      setProjectSearch('')
      setRecipientResults([])
      setProjectResults([])
      setRecipientSearched(false)
      // Jump directly into the new chat
      const full = await queryApi.get(created.id)
      setActiveQuery(full)
      setView('chat')
      loadQueries(true)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create query')
    } finally {
      setCreating(false)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const statusBadge = (status: string) => {
    if (status === 'closed') return 'bg-gray-100 text-gray-500'
    if (status === 'open') return 'bg-green-100 text-green-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  const statusLabel = (status: string) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const isMyResolved = (q: Query) => {
    if (!user) return false
    return q.sender_id === user.id ? q.sender_resolved : q.recipient_resolved
  }

  if (!shouldRender) return null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={clsx(
        // Floating card: gaps on top / right / bottom instead of a full-bleed panel
        'fixed top-4 bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)]',
        'bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-2xl',
        'z-40 flex flex-col overflow-hidden',
        // Slide in from / out to the right
        'transition-transform duration-300 ease-out motion-reduce:transition-none',
        isVisible ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      )}
    >

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        {view === 'chat' && activeQuery ? (
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={goToList}
              className="p-1 text-gray-400 hover:text-gray-700 rounded flex-shrink-0"
              aria-label="Back to list"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{activeQuery.subject}</p>
              <p className="text-xs text-gray-500 truncate">
                {activeQuery.sender_id === user?.id
                  ? activeQuery.recipient_name
                  : activeQuery.sender_name}
                {activeQuery.project_name && (
                  <span className="text-brand-600"> · {activeQuery.project_name}</span>
                )}
              </p>
            </div>
          </div>
        ) : view === 'new' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('list')}
              className="p-1 text-gray-400 hover:text-gray-700 rounded"
              aria-label="Back"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold">New Query</span>
          </div>
        ) : (
          <span className="text-sm font-semibold text-gray-900">Queries</span>
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          {view === 'list' && (
            <button
              onClick={() => setView('new')}
              className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg"
              title="New Query"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          )}
          {view === 'chat' && activeQuery?.status !== 'closed' && (
            <button
              onClick={markResolved}
              disabled={isMyResolved(activeQuery!)}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                isMyResolved(activeQuery!)
                  ? 'text-green-500 cursor-default'
                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
              )}
              title={isMyResolved(activeQuery!) ? 'You marked this resolved' : 'Mark as resolved'}
            >
              <CheckCircleIcon className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>


      {/* ─── LIST VIEW ─────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="flex-1 overflow-y-auto">
          {queries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
              <p className="text-gray-400 text-sm">No queries yet.</p>
              <button onClick={() => setView('new')} className="btn-primary btn-sm">
                Start a Query
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {queries.map((q) => {
                const hasUnread = (q.unread_count ?? 0) > 0 && q.status !== 'closed'
                return (
                  <button
                    key={q.id}
                    onClick={() => openChat(q)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {hasUnread && (
                            <span className="w-2 h-2 rounded-full bg-brand-600 flex-shrink-0" />
                          )}
                          <p className={clsx(
                            'text-sm truncate',
                            hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'
                          )}>
                            {q.subject}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {q.sender_id === user?.id ? `To: ${q.recipient_name}` : `From: ${q.sender_name}`}
                        </p>
                        {q.project_name && (
                          <p className="text-xs text-brand-600 mt-0.5 truncate font-medium">
                            {q.project_name}
                          </p>
                        )}
                        {q.last_message?.message && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {q.last_message.sender_id === user?.id ? 'You: ' : `${q.last_message.sender_name}: `}
                            {q.last_message.message}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', statusBadge(q.status))}>
                          {statusLabel(q.status)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(q.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── CHAT VIEW ─────────────────────────────────────────────────── */}
      {view === 'chat' && activeQuery && (
        <>
          {/* Status bar */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', statusBadge(activeQuery.status))}>
              {statusLabel(activeQuery.status)}
            </span>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {activeQuery.sender_resolved && <span>✓ {activeQuery.sender_name?.split(' ')[0]} resolved</span>}
              {activeQuery.recipient_resolved && <span>✓ {activeQuery.recipient_name?.split(' ')[0]} resolved</span>}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {(!activeQuery.messages || activeQuery.messages.length === 0) && (
              <p className="text-center text-xs text-gray-400 mt-8">No messages yet. Start the conversation.</p>
            )}
            {activeQuery.messages?.map((msg) => {
              const isMe = msg.sender_id === user?.id
              return (
                <div key={msg.id} className={clsx('flex', isMe ? 'justify-end' : 'justify-start')}>
                  <div className={clsx('max-w-[80%] flex flex-col gap-1', isMe ? 'items-end' : 'items-start')}>
                    {!isMe && (
                      <span className="text-xs text-gray-500 ml-1">{msg.sender_name}</span>
                    )}
                    {msg.message && (
                      <div className={clsx(
                        'px-3 py-2 rounded-2xl text-sm leading-relaxed',
                        isMe
                          ? 'bg-brand-600 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      )}>
                        {msg.message}
                      </div>
                    )}
                    {msg.files?.map((f) => (
                      <a
                        key={f.id}
                        href={f.s3_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={clsx(
                          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs border',
                          isMe
                            ? 'bg-brand-50 border-brand-200 text-brand-700'
                            : 'bg-white border-gray-200 text-gray-700'
                        )}
                      >
                        <PaperClipIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate max-w-[160px]">{f.original_name}</span>
                      </a>
                    ))}
                    <span className="text-xs text-gray-400 px-1">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          {activeQuery.status !== 'closed' ? (
            <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0">
              {attachFile && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-gray-100 rounded-lg text-xs">
                  <PaperClipIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-700 truncate flex-1">{attachFile.name}</span>
                  <button onClick={() => setAttachFile(null)} className="text-gray-400 hover:text-red-500">×</button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Enter to send)"
                  rows={1}
                  className="input flex-1 py-2 resize-none"
                  style={{ minHeight: '38px', maxHeight: '96px' }}
                  onInput={(e) => {
                    const t = e.currentTarget
                    t.style.height = 'auto'
                    t.style.height = Math.min(t.scrollHeight, 96) + 'px'
                  }}
                />
                <input
                  type="file"
                  ref={fileRef}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setAttachFile(e.target.files[0])}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0"
                  title="Attach file"
                >
                  <PaperClipIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={sending || (!message.trim() && !attachFile)}
                  className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex-shrink-0"
                  title="Send"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 border-t border-gray-200 text-center flex-shrink-0">
              <p className="text-xs text-gray-400">This query is closed.</p>
            </div>
          )}
        </>
      )}


      {/* ─── NEW QUERY VIEW ─────────────────────────────────────────────── */}
      {view === 'new' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Recipient search */}
          <div>
            <label className="label">To (search by name or email)</label>
            {selectedRecipient ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {selectedRecipient.first_name} {selectedRecipient.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {selectedRecipient.email}
                    {selectedRecipient.department_name && ` · ${selectedRecipient.department_name}`}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedRecipient(null); setRecipientSearched(false) }}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0 text-lg leading-none"
                  aria-label="Remove recipient"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="Type name or email..."
                  className="input w-full"
                  autoComplete="off"
                />
                {/* Dropdown */}
                {recipientSearch.length >= 2 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {recipientSearching ? (
                      <p className="px-3 py-2 text-xs text-gray-500">Searching...</p>
                    ) : recipientResults.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto">
                        {recipientResults.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setSelectedRecipient(emp)
                              setRecipientSearch('')
                              setRecipientResults([])
                              setRecipientSearched(false)
                            }}
                            className="w-full px-3 py-2.5 text-left hover:bg-gray-50 flex flex-col border-b border-gray-50 last:border-0"
                          >
                            <span className="text-sm font-medium text-gray-900">
                              {emp.first_name} {emp.last_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {emp.email}
                              {emp.department_name && ` · ${emp.department_name}`}
                              {emp.layer && ` · ${emp.layer.replace('_', ' ')}`}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : recipientSearched ? (
                      <p className="px-3 py-2 text-xs text-gray-500">
                        No users found. Only adjacent-layer members can receive queries.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Project search */}
          <div>
            <label className="label">Project</label>
            {selectedProject ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedProject.project_name}</p>
                  <p className="text-xs text-gray-500">PO: {selectedProject.po_number}</p>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0 text-lg leading-none"
                  aria-label="Remove project"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="input w-full"
                  autoComplete="off"
                />
                {projectResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {projectResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedProject(p); setProjectSearch(''); setProjectResults([]) }}
                        className="w-full px-3 py-2.5 text-left hover:bg-gray-50 flex flex-col border-b border-gray-50 last:border-0"
                      >
                        <span className="text-sm font-medium text-gray-900">{p.project_name}</span>
                        <span className="text-xs text-gray-500">PO: {p.po_number} · {p.client_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="label">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this query about?"
              className="input w-full"
            />
          </div>

          {/* Initial message */}
          <div>
            <label className="label">Message <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Write your first message..."
              rows={4}
              className="input resize-none w-full"
            />
          </div>

          <button
            onClick={createQuery}
            disabled={creating || !selectedRecipient || !selectedProject || !subject.trim()}
            className="btn-primary w-full disabled:opacity-50"
          >
            {creating ? 'Sending...' : 'Send Query'}
          </button>
        </div>
      )}

    </div>
  )
}