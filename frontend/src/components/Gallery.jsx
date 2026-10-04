import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader,
  ImageOff,
  ZoomIn,
  Clock,
  ExternalLink,
  Tag,
  ArrowUpRight,
} from 'lucide-react'
import { getGallery, searchGallery, deleteMoment, resolveImageUrl } from '../api'

const CLASSIFICATION_OPTIONS = [
  { value: '', label: 'ALL MEMORIES' },
  { value: 'SPECIFIC_CANDID', label: 'DEEP CANDID' },
  { value: 'GENERAL_CANDID', label: 'AMBIENT CANDID' },
  { value: 'POSED', label: 'POSED' },
]

function getBadgeProps(cls) {
  switch (cls) {
    case 'SPECIFIC_CANDID':
      return {
        className: 'bg-white text-black font-semibold',
        label: 'DEEP CANDID',
      }
    case 'GENERAL_CANDID':
      return {
        className: 'bg-white/10 text-white/90 border border-white/20',
        label: 'AMBIENT CANDID',
      }
    case 'POSED':
      return {
        className: 'bg-white/[0.04] text-white/50 border border-white/10',
        label: 'POSED',
      }
    default:
      return {
        className: 'bg-white/[0.02] text-white/40 border border-white/10',
        label: 'MOMENT',
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

    if (diffMins < 1) return 'JUST NOW'
    if (diffMins < 60) return `${diffMins}M AGO`

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).toUpperCase()
  } catch {
    return isoStr
  }
}

export default function Gallery({ onCountChange }) {
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
      console.error('Gallery fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [page, classFilter, activeTag, onCountChange])

  useEffect(() => {
    if (!searchResults) {
      fetchGallery()
    }
  }, [fetchGallery, searchResults])

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

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-black text-white px-6 lg:px-12 py-8">
      {/* ── Search & Filter Controls ───────────────────────── */}
      <div className="max-w-[1800px] mx-auto mb-10 space-y-4">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <div className="absolute top-1/2 -translate-y-1/2 left-4 pointer-events-none text-white/40">
              <Search size={16} />
            </div>

            <input
              id="search-input"
              type="text"
              placeholder="Search moments by semantic query (e.g. 'laughing at table', 'deep focus reading')..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full pl-11 pr-10 py-3.5 rounded-lg bg-black border border-white/15 text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white transition-all font-sans"
            />

            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute top-1/2 -translate-y-1/2 right-3.5 p-1 rounded text-white/40 hover:text-white transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            id="search-button"
            onClick={handleSearch}
            disabled={isSearching}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-[13px] font-medium bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-all font-sans shrink-0"
          >
            {isSearching ? <Loader size={14} className="animate-spin" /> : null}
            <span>SEARCH</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
          {/* Classification Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
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
                  className={`px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wider transition-all ${
                    isSelected
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/[0.03] text-white/50 border border-white/10 hover:text-white hover:border-white/25'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Popular Mood Tags */}
          {popularTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30 mr-1 flex items-center gap-1">
                <Tag size={10} /> TAGS:
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
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                      isSelected
                        ? 'bg-white text-black font-semibold'
                        : 'bg-white/[0.02] text-white/50 border border-white/10 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    #{tag}
                  </button>
                )
              })}
              {activeTag && (
                <button
                  onClick={() => setActiveTag('')}
                  className="text-[10px] font-mono text-white/40 underline hover:text-white ml-1 uppercase"
                >
                  RESET
                </button>
              )}
            </div>
          )}
        </div>

        {/* Active Search Results Notice */}
        {searchResults && (
          <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-white/[0.04] border border-white/15 text-[12px] font-mono text-white/80">
            <span>
              {searchResults.length} RESULT{searchResults.length !== 1 ? 'S' : ''} FOR: <strong className="text-white">"{searchQuery}"</strong>
            </span>
            <button
              onClick={clearSearch}
              className="text-[11px] font-mono text-white/40 hover:text-white underline uppercase"
            >
              CLEAR
            </button>
          </div>
        )}
      </div>

      {/* ── Grid Container ─────────────────────────────────── */}
      <div className="max-w-[1800px] mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-36 gap-3">
            <Loader size={20} className="animate-spin text-white/40" />
            <p className="text-[12px] font-mono text-white/40 uppercase tracking-widest">
              LOADING VAULT...
            </p>
          </div>
        ) : displayMoments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-36 px-4 text-center border border-dashed border-white/10 rounded-2xl">
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/30 mb-3">
              <ImageOff size={20} />
            </div>
            <h3 className="text-[14px] font-medium text-white mb-1">
              NO MOMENTS FOUND
            </h3>
            <p className="text-[12px] text-white/40 max-w-sm mb-5 leading-relaxed font-sans">
              {searchQuery || classFilter || activeTag
                ? 'No moments match your current filter parameters.'
                : 'Switch to Studio camera mode to capture and curate candid memories.'}
            </p>
            {(searchQuery || classFilter || activeTag) && (
              <button
                onClick={() => {
                  clearSearch()
                  setClassFilter('')
                  setActiveTag('')
                }}
                className="px-3.5 py-1.5 rounded text-[11px] font-mono bg-white text-black font-semibold hover:bg-white/90 transition-all uppercase"
              >
                RESET FILTERS
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {displayMoments.map((m, idx) => {
              const imgUrl = resolveImageUrl(m.cloudinary_url || m.filepath)
              const badge = getBadgeProps(m.classification)

              return (
                <div
                  key={m.id || idx}
                  onClick={() => setLightboxItem(m)}
                  className="group bg-black border border-white/[0.08] hover:border-white/30 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col"
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
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono tracking-wider ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5 z-10">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-black/80 backdrop-blur-md border border-white/20 text-white">
                        {m.score !== undefined
                          ? `${(m.score * 100).toFixed(0)}% MATCH`
                          : `${(m.confidence * 100).toFixed(0)}% CONF`}
                      </span>
                    </div>

                    {/* Quick Zoom Indicator on Hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                        <ZoomIn size={16} />
                      </span>
                    </div>
                  </div>

                  {/* Metadata Content */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-white/90 line-clamp-2 leading-snug mb-2 font-sans">
                        {m.caption || 'Spontaneous unposed candid moment.'}
                      </p>

                      {/* Tags */}
                      {m.tags && m.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {m.tags.slice(0, 3).map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white/40 bg-white/[0.03] border border-white/[0.06]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-white/40">
                      <div className="flex items-center gap-1">
                        <Clock size={11} className="text-white/30" />
                        <span>{formatMomentTime(m.created_at)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {m.cloudinary_url && (
                          <a
                            href={m.cloudinary_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            title="Open original Cloudinary media"
                            className="p-1 rounded text-white/40 hover:text-white transition-colors"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}

                        <button
                          onClick={e => handleDelete(m.id, e)}
                          title="Delete moment"
                          className="p-1 rounded text-white/40 hover:text-white transition-colors"
                        >
                          <Trash2 size={12} />
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
          <div className="flex items-center justify-center gap-3 mt-12">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[11px] font-mono border border-white/10 hover:border-white/30 text-white disabled:opacity-20 transition-all uppercase"
            >
              <ChevronLeft size={14} />
              <span>PREV</span>
            </button>

            <span className="px-3 py-1 rounded text-[11px] font-mono text-white/40 bg-white/[0.03] border border-white/[0.06]">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[11px] font-mono border border-white/10 hover:border-white/30 text-white disabled:opacity-20 transition-all uppercase"
            >
              <span>NEXT</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Minimal Cinema Inspector Lightbox ──────────────── */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 animate-fadeIn"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] bg-black border border-white/15 rounded-2xl overflow-hidden flex flex-col lg:flex-row shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Left Image Viewport */}
            <div className="flex-1 bg-black flex items-center justify-center p-4 min-h-[360px] lg:min-h-[540px]">
              <img
                src={resolveImageUrl(lightboxItem.cloudinary_url || lightboxItem.filepath)}
                alt={lightboxItem.caption}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>

            {/* Right Inspector Sidebar */}
            <div className="w-full lg:w-96 p-6 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-white/10 bg-black overflow-y-auto">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-6">
                  {(() => {
                    const badge = getBadgeProps(lightboxItem.classification)
                    return (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider ${badge.className}`}>
                        {badge.label}
                      </span>
                    )
                  })()}

                  <button
                    onClick={() => setLightboxItem(null)}
                    className="p-1 rounded text-white/50 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* AI Caption */}
                <div className="mb-6">
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
                    AI VISION NARRATIVE
                  </h4>
                  <p className="text-[14px] text-white/95 font-medium leading-relaxed italic border-l border-white/40 pl-3 font-sans">
                    "{lightboxItem.caption}"
                  </p>
                </div>

                {/* Tags */}
                {lightboxItem.tags && lightboxItem.tags.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
                      TAGS & ENERGY
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {lightboxItem.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[11px] font-mono text-white/70 bg-white/[0.04] border border-white/10"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Telemetry Metrics */}
                <div className="space-y-3 p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[11px] font-mono">
                  <div className="flex justify-between items-center text-white/60">
                    <span>AI CONFIDENCE</span>
                    <span className="text-white font-bold">
                      {(lightboxItem.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Confidence Progress Bar */}
                  <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-white h-full transition-all duration-300"
                      style={{ width: `${Math.round(lightboxItem.confidence * 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1 text-white/60">
                    <span>CAPTURED</span>
                    <span className="text-white">
                      {new Date(lightboxItem.created_at).toLocaleString().toUpperCase()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-white/60">
                    <span>INDEX TYPE</span>
                    <span className="text-white">ATLAS 384-DIM DENSE</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-6 mt-6 border-t border-white/10">
                {lightboxItem.cloudinary_url && (
                  <a
                    href={lightboxItem.cloudinary_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 rounded-md text-[12px] font-medium flex items-center justify-center gap-1.5 bg-white text-black hover:bg-white/90 transition-all font-sans"
                  >
                    <span>VIEW ON CLOUDINARY</span>
                    <ArrowUpRight size={13} />
                  </a>
                )}

                <button
                  onClick={() => handleDelete(lightboxItem.id)}
                  className="w-full py-2.5 rounded-md text-[12px] font-mono flex items-center justify-center gap-1.5 border border-white/20 text-white/70 hover:text-white hover:border-white/50 transition-all uppercase"
                >
                  <Trash2 size={13} />
                  <span>DELETE MEMORY</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
