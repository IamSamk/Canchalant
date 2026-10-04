import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader,
  ImageOff,
  ZoomIn,
  Clock,
  ExternalLink,
  Tag,
  ArrowUpRight,
  Lock,
} from 'lucide-react'
import { getGallery, searchGallery, deleteMoment, resolveImageUrl } from '../api'

const CLASSIFICATION_OPTIONS = [
  { value: '', label: 'All memories' },
  { value: 'SPECIFIC_CANDID', label: 'Deep candid' },
  { value: 'GENERAL_CANDID', label: 'Ambient candid' },
  { value: 'POSED', label: 'Posed' },
]

function getBadgeProps(cls) {
  switch (cls) {
    case 'SPECIFIC_CANDID':
      return {
        className: 'bg-white text-black font-semibold',
        label: 'Deep candid',
      }
    case 'GENERAL_CANDID':
      return {
        className: 'bg-white/10 text-white/90 border border-white/20',
        label: 'Ambient candid',
      }
    case 'POSED':
      return {
        className: 'bg-white/[0.04] text-white/50 border border-white/10',
        label: 'Posed',
      }
    default:
      return {
        className: 'bg-white/[0.02] text-white/40 border border-white/10',
        label: 'Moment',
      }
  }
}

function formatMomentTime(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

export default function Gallery({ user, onCountChange, onOpenAuth }) {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [classFilter, setClassFilter] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [lightboxItem, setLightboxItem] = useState(null)

  const fetchGallery = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getGallery(page, 30, {
        classification: classFilter || undefined,
        tag: activeTag || undefined,
      })
      const list = data.moments || []
      setMoments(list)
      setTotalPages(data.pages || 1)
      if (onCountChange && typeof data.total === 'number') {
        onCountChange(data.total)
      }
    } catch (err) {
      if (err.message === 'UNAUTHORIZED' && onOpenAuth) {
        onOpenAuth()
      }
      console.error('Gallery fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user, page, classFilter, activeTag, onCountChange, onOpenAuth])

  useEffect(() => {
    if (!searchResults && user) {
      fetchGallery()
    }
  }, [fetchGallery, searchResults, user])

  // Semantic Vector Search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setIsSearching(true)
    try {
      const data = await searchGallery(searchQuery.trim(), 30)
      setSearchResults(data.results || [])
    } catch (err) {
      console.error('Semantic search error:', err)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery])

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
  }

  // Delete
  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation()
    if (!confirm('Permanently delete this memory?')) return
    try {
      await deleteMoment(id)
      setMoments(prev => prev.filter(m => m.id !== id))
      if (searchResults) {
        setSearchResults(prev => prev.filter(m => m.id !== id))
      }
      if (lightboxItem?.id === id) setLightboxItem(null)
      if (onCountChange) onCountChange(c => Math.max(0, c - 1))
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  // Extract popular tags
  const popularTags = useMemo(() => {
    const counts = {}
    const source = searchResults || moments
    source.forEach(m => {
      ;(m.tags || []).forEach(t => {
        const lower = t.toLowerCase().trim()
        counts[lower] = (counts[lower] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag)
  }, [moments, searchResults])

  const displayMoments = searchResults || moments

  if (!user) {
    return (
      <div className="w-full min-h-[calc(100vh-4rem)] bg-black text-white flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center border border-white/10 rounded-2xl p-10 bg-[#0a0a0a]">
          <div className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center mx-auto mb-5 text-white/70">
            <Lock size={22} />
          </div>
          <h2 className="text-xl font-medium text-white tracking-tight mb-2">
            Private Vault Encrypted
          </h2>
          <p className="text-sm text-white/55 leading-relaxed mb-8">
            Every moment in this vault is privately partitioned on MongoDB Atlas and isolated to its owner. Sign in or register to browse your personal memory vault.
          </p>
          <button
            onClick={onOpenAuth}
            className="w-full h-11 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-all"
          >
            Sign in or create vault
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-black text-white px-6 lg:px-12 py-10">
      {/* ── Search & Filter Controls ───────────────────────── */}
      <div className="max-w-[1500px] mx-auto mb-10 flex flex-col gap-5">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              id="search-input"
              type="text"
              placeholder="Search memories by semantic query (e.g. 'laughing at table', 'deep focus reading')..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full h-12 px-4 pr-10 rounded-xl bg-[#0c0c0c] border border-white/15 text-sm text-white placeholder-white/30 focus:border-white focus:outline-none transition-colors"
            />

            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute top-1/2 -translate-y-1/2 right-3.5 p-1 rounded-md text-white/40 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            id="search-button"
            onClick={handleSearch}
            disabled={isSearching}
            className="h-12 px-6 rounded-xl text-sm font-medium bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            {isSearching ? <Loader size={14} className="animate-spin" /> : null}
            <span>Search</span>
          </button>
        </div>

        {/* Filter Toolbar with Generous Spacing */}
        <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
          {/* Classification Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {CLASSIFICATION_OPTIONS.map(opt => {
              const isSelected = classFilter === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setClassFilter(opt.value)
                    setPage(1)
                    setSearchResults(null)
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/[0.03] text-white/60 border border-white/10 hover:text-white hover:border-white/25'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Popular Mood Tags */}
          {popularTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/40 mr-1 flex items-center gap-1.5">
                <Tag size={12} /> Tags:
              </span>
              {popularTags.map(tag => {
                const isSelected = activeTag === tag
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      if (activeTag === tag) {
                        setActiveTag('')
                      } else {
                        setActiveTag(tag)
                        setPage(1)
                        setSearchResults(null)
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                      isSelected
                        ? 'bg-white text-black font-semibold'
                        : 'bg-white/[0.02] text-white/55 border border-white/10 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    #{tag}
                  </button>
                )
              })}
              {activeTag && (
                <button
                  onClick={() => setActiveTag('')}
                  className="text-xs text-white/40 underline hover:text-white ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Active Search Results Notice */}
        {searchResults && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/15 text-xs text-white/80">
            <span>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for: <strong className="text-white">"{searchQuery}"</strong>
            </span>
            <button
              onClick={clearSearch}
              className="text-xs text-white/50 hover:text-white underline"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* ── Grid Container with Generous Spacing ───────────── */}
      <div className="max-w-[1500px] mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-36 gap-3">
            <Loader size={20} className="animate-spin text-white/40" />
            <p className="text-xs text-white/40 uppercase tracking-wider">
              Loading vault...
            </p>
          </div>
        ) : displayMoments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-6 text-center border border-dashed border-white/10 rounded-2xl">
            <div className="w-12 h-12 rounded-full border border-white/15 flex items-center justify-center text-white/30 mb-3">
              <ImageOff size={20} />
            </div>
            <h3 className="text-base font-medium text-white mb-1.5">
              No moments found
            </h3>
            <p className="text-xs text-white/50 max-w-sm mb-6 leading-relaxed">
              {searchQuery || classFilter || activeTag
                ? 'No moments match your current filter parameters.'
                : 'Switch to Studio camera mode to capture candid memories.'}
            </p>
            {(searchQuery || classFilter || activeTag) && (
              <button
                onClick={() => {
                  clearSearch()
                  setClassFilter('')
                  setActiveTag('')
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-white text-black hover:bg-white/90 transition-all"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8">
            {displayMoments.map((m, idx) => {
              const imgUrl = resolveImageUrl(m.cloudinary_url || m.filepath)
              const badge = getBadgeProps(m.classification)

              return (
                <div
                  key={m.id || idx}
                  onClick={() => setLightboxItem(m)}
                  className="group bg-[#0a0a0a] border border-white/10 hover:border-white/30 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col"
                >
                  {/* Photo Frame */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
                    <img
                      src={imgUrl}
                      alt={m.caption || 'Captured moment'}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Top Status Badges */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className={`px-2.5 py-1 rounded text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 z-10">
                      <span className="px-2 py-0.5 rounded text-xs bg-black/80 backdrop-blur-md border border-white/20 text-white">
                        {m.score !== undefined
                          ? `${(m.score * 100).toFixed(0)}% match`
                          : `${(m.confidence * 100).toFixed(0)}% conf`}
                      </span>
                    </div>

                    {/* Hover Zoom Icon */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                        <ZoomIn size={18} />
                      </span>
                    </div>
                  </div>

                  {/* Metadata Content with Generous Padding */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white/90 line-clamp-2 leading-relaxed mb-3">
                        {m.caption || 'Spontaneous unposed candid moment.'}
                      </p>

                      {/* Tags */}
                      {m.tags && m.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {m.tags.slice(0, 3).map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2 py-0.5 rounded text-xs text-white/50 bg-white/[0.04] border border-white/[0.08]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/45">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-white/35" />
                        <span>{formatMomentTime(m.created_at)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {m.cloudinary_url && (
                          <a
                            href={m.cloudinary_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            title="Open original Cloudinary media"
                            className="p-1 rounded text-white/40 hover:text-white transition-colors"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}

                        <button
                          onClick={e => handleDelete(m.id, e)}
                          title="Delete moment"
                          className="p-1 rounded text-white/40 hover:text-white transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────── */}
        {!searchResults && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-14">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-white/10 hover:border-white/30 text-white disabled:opacity-25 transition-all"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <span className="px-3.5 py-1.5 rounded-lg text-xs text-white/50 bg-white/[0.03] border border-white/[0.08]">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-white/10 hover:border-white/30 text-white disabled:opacity-25 transition-all"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Cinema Inspector Lightbox ──────────────────────── */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 md:p-10 animate-fadeIn"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] bg-[#0c0c0c] border border-white/15 rounded-2xl overflow-hidden flex flex-col lg:flex-row shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Left Image Viewport */}
            <div className="flex-1 bg-black flex items-center justify-center p-6 min-h-[360px] lg:min-h-[540px]">
              <img
                src={resolveImageUrl(lightboxItem.cloudinary_url || lightboxItem.filepath)}
                alt={lightboxItem.caption}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>

            {/* Right Inspector Sidebar with Generous Spacing */}
            <div className="w-full lg:w-[400px] p-8 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0c0c0c] overflow-y-auto">
              <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                  {(() => {
                    const badge = getBadgeProps(lightboxItem.classification)
                    return (
                      <span className={`px-2.5 py-1 rounded text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    )
                  })()}

                  <button
                    onClick={() => setLightboxItem(null)}
                    className="p-1 rounded-md text-white/50 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* AI Caption */}
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wider text-white/40 mb-2">
                    Vision narrative
                  </h4>
                  <p className="text-base text-white/95 font-medium leading-relaxed italic border-l-2 border-white/40 pl-3.5">
                    "{lightboxItem.caption}"
                  </p>
                </div>

                {/* Tags */}
                {lightboxItem.tags && lightboxItem.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium uppercase tracking-wider text-white/40 mb-2">
                      Tags & mood
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {lightboxItem.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded text-xs text-white/70 bg-white/[0.04] border border-white/10"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Telemetry Metrics */}
                <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
                  <div className="flex justify-between items-center text-white/60">
                    <span>AI Confidence</span>
                    <span className="text-white font-medium">
                      {(lightboxItem.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-white h-full transition-all duration-300"
                      style={{ width: `${Math.round(lightboxItem.confidence * 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1 text-white/60">
                    <span>Captured</span>
                    <span className="text-white">
                      {new Date(lightboxItem.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-white/60">
                    <span>Vector index</span>
                    <span className="text-white">Atlas 384-dim dense</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-6 mt-6 border-t border-white/10">
                {lightboxItem.cloudinary_url && (
                  <a
                    href={lightboxItem.cloudinary_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full h-11 rounded-lg text-xs font-medium flex items-center justify-center gap-2 bg-white text-black hover:bg-white/90 transition-all"
                  >
                    <span>View on Cloudinary</span>
                    <ArrowUpRight size={13} />
                  </a>
                )}

                <button
                  onClick={() => handleDelete(lightboxItem.id)}
                  className="w-full h-11 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border border-white/20 text-white/70 hover:text-white hover:border-white/50 transition-all"
                >
                  <Trash2 size={13} />
                  <span>Delete memory</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
