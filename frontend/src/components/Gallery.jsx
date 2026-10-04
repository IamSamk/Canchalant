import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Filter,
  Loader,
  ImageOff,
  ZoomIn,
  Clock,
  ExternalLink,
  Tag,
  CheckCircle,
  Database,
  ArrowUpRight,
  Eye
} from 'lucide-react'
import { getGallery, searchGallery, deleteMoment, resolveImageUrl } from '../api'

const CLASSIFICATION_OPTIONS = [
  { value: '', label: 'All Vault' },
  { value: 'SPECIFIC_CANDID', label: '✨ Deep Connection' },
  { value: 'GENERAL_CANDID', label: '🌿 Ambient Candid' },
  { value: 'POSED', label: '📸 Posed' },
]

function getBadgeStyle(cls) {
  switch (cls) {
    case 'SPECIFIC_CANDID':
      return {
        badgeClass: 'badge-specific-candid',
        label: '✨ Deep Candid',
        dotColor: '#34d399',
      }
    case 'GENERAL_CANDID':
      return {
        badgeClass: 'badge-general-candid',
        label: '🌿 Ambient Candid',
        dotColor: '#38bdf8',
      }
    case 'POSED':
      return {
        badgeClass: 'badge-posed',
        label: '📸 Posed',
        dotColor: '#f59e0b',
      }
    default:
      return {
        badgeClass: 'badge-junk',
        label: 'Ambient',
        dotColor: '#94a3b8',
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
    if (!confirm('Permanently delete this memory from Atlas & Cloudinary?')) return
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

  // Extract top mood tags for quick discovery
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
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* ── Search & Filter Command Center ─────────────────── */}
      <div className="mb-8 space-y-4">
        {/* Search Bar Container */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none text-violet-400"
              style={{ left: '1.25rem' }}
            >
              <Search size={18} />
            </div>

            <input
              id="search-input"
              type="text"
              placeholder='Search memories using natural language... (e.g. "sitting together laughing", "reading coffee")'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ paddingLeft: '3.5rem', paddingRight: '3rem' }}
              className="w-full py-4 rounded-2xl text-sm bg-slate-900/90 border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500/70 focus:ring-4 focus:ring-violet-500/15 transition-all shadow-inner"
            />

            {searchQuery && (
              <button
                onClick={clearSearch}
                style={{ right: '1.25rem' }}
                className="absolute top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            id="search-button"
            onClick={handleSearch}
            disabled={isSearching}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500 hover:from-violet-500 hover:to-sky-400 shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isSearching ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
            <span>Vector Search</span>
          </button>
        </div>

        {/* Filter Pills Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
          {/* Classification Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CLASSIFICATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  setClassFilter(opt.value)
                  setPage(1)
                  setSearchResults(null)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  classFilter === opt.value
                    ? 'bg-violet-600/25 border border-violet-500/50 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.25)]'
                    : 'bg-slate-900/70 border border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Trending Mood Tag Chips */}
          {popularTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold mr-1 flex items-center gap-1">
                <Tag size={11} /> Moods:
              </span>
              {popularTags.map(tag => (
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
                  className={`mood-tag-pill ${activeTag === tag ? 'bg-violet-500/40 border-violet-400 text-white font-bold' : ''}`}
                >
                  #{tag}
                </button>
              ))}
              {activeTag && (
                <button
                  onClick={() => setActiveTag('')}
                  className="text-[11px] text-slate-400 underline hover:text-white ml-1"
                >
                  Clear tag
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search Active Notification */}
        {searchResults && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-violet-950/40 border border-violet-500/30 text-xs text-violet-200 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-violet-400" />
              <span>
                Atlas Vector Search returned <strong>{searchResults.length}</strong> semantic match{searchResults.length !== 1 ? 'es' : ''} for: <em className="text-white font-semibold">"{searchQuery}"</em>
              </span>
            </div>
            <button
              onClick={clearSearch}
              className="text-xs text-violet-400 underline hover:text-white font-medium"
            >
              Reset to all
            </button>
          </div>
        )}
      </div>

      {/* ── Memories Gallery Grid ──────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-[0_0_24px_rgba(139,92,246,0.3)]">
            <Loader size={24} className="animate-spin" />
          </div>
          <p className="text-sm font-medium text-slate-400 tracking-wide">
            Retrieving moments from MongoDB Atlas & Cloudinary...
          </p>
        </div>
      ) : displayMoments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 px-4 text-center canchalant-card border-dashed">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-4">
            <ImageOff size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-200 mb-1">
            No Captured Moments Found
          </h3>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            {searchQuery || classFilter || activeTag
              ? 'No moments matched your current filter criteria. Try clearing search filters.'
              : 'Switch to the Studio camera tab and capture an authentic candid moment to start filling your memory vault.'}
          </p>
          {(searchQuery || classFilter || activeTag) && (
            <button
              onClick={() => {
                clearSearch()
                setClassFilter('')
                setActiveTag('')
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-all"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {displayMoments.map((m, idx) => {
            const imgUrl = resolveImageUrl(m.cloudinary_url || m.filepath)
            const badge = getBadgeStyle(m.classification)

            return (
              <div
                key={m.id || idx}
                onClick={() => setLightboxItem(m)}
                className="group canchalant-card flex flex-col overflow-hidden cursor-pointer"
              >
                {/* Image Section */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950">
                  <img
                    src={imgUrl}
                    alt={m.caption || 'Captured moment'}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Gradient Vignette Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 pointer-events-none" />

                  {/* Classification Pill Badge (Top Left) */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className={`chip-base ${badge.badgeClass}`}>
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: badge.dotColor }}
                      />
                      {badge.label}
                    </span>
                  </div>

                  {/* Confidence or Similarity Score (Top Right) */}
                  <div className="absolute top-3 right-3 z-10">
                    <span className="chip-base bg-black/60 backdrop-blur-md border border-white/15 text-slate-200 font-mono text-[11px]">
                      {m.score !== undefined
                        ? `${(m.score * 100).toFixed(0)}% Match`
                        : `${(m.confidence * 100).toFixed(0)}% Conf`}
                    </span>
                  </div>

                  {/* Hover Quick Action Overlay */}
                  <div className="absolute inset-0 bg-violet-950/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                    <span className="p-2.5 rounded-xl bg-black/60 border border-white/20 text-white shadow-lg hover:scale-110 transition-transform">
                      <ZoomIn size={18} />
                    </span>
                  </div>

                  {/* Cloudinary CDN Indicator (Bottom Left) */}
                  {m.cloudinary_url && (
                    <div className="absolute bottom-2.5 left-3 z-10 opacity-75 group-hover:opacity-100 transition-opacity">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-300/90 bg-sky-950/60 backdrop-blur-sm px-2 py-0.5 rounded-md border border-sky-400/20">
                        Cloudinary CDN
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Content Section */}
                <div className="flex-1 p-4 flex flex-col justify-between gap-3">
                  <div>
                    {/* Caption */}
                    <p className="text-sm font-medium text-slate-100 line-clamp-2 leading-relaxed mb-2.5 group-hover:text-violet-200 transition-colors">
                      {m.caption || 'Authentic unposed candid moment.'}
                    </p>

                    {/* Mood Tags */}
                    {m.tags && m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {m.tags.slice(0, 3).map((tag, tIdx) => (
                          <span key={tIdx} className="mood-tag-pill">
                            #{tag}
                          </span>
                        ))}
                        {m.tags.length > 3 && (
                          <span className="text-[10px] text-slate-400 self-center">
                            +{m.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Info & Actions */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                      <Clock size={12} className="text-slate-500" />
                      <span>{formatMomentTime(m.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {m.cloudinary_url && (
                        <a
                          href={m.cloudinary_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          title="Open original in Cloudinary"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-white/5 transition-colors"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}

                      <button
                        onClick={e => handleDelete(m.id, e)}
                        title="Delete this moment"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
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

      {/* ── Pagination Controls ────────────────────────────── */}
      {!searchResults && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-12">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium canchalant-card hover:border-violet-500/40 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>

          <span className="px-3 py-1 rounded-xl text-xs font-mono text-slate-400 bg-white/5 border border-white/5">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium canchalant-card hover:border-violet-500/40 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Luxury Cinema Lightbox Modal ───────────────────── */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-fadeIn"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative w-full max-w-6xl max-h-[92vh] glass-panel-elevated rounded-3xl overflow-hidden flex flex-col lg:flex-row shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border border-white/15"
            onClick={e => e.stopPropagation()}
          >
            {/* Left Image Stage */}
            <div className="flex-1 bg-black/70 flex items-center justify-center p-4 min-h-[350px] lg:min-h-[580px] overflow-hidden">
              <img
                src={resolveImageUrl(lightboxItem.cloudinary_url || lightboxItem.filepath)}
                alt={lightboxItem.caption}
                className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
              />
            </div>

            {/* Right Metadata Inspector Sidebar */}
            <div className="w-full lg:w-96 p-6 md:p-8 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-white/10 bg-slate-950/80 backdrop-blur-2xl overflow-y-auto">
              <div>
                {/* Header Row */}
                <div className="flex items-center justify-between gap-3 mb-6">
                  {(() => {
                    const badge = getBadgeStyle(lightboxItem.classification)
                    return (
                      <span className={`chip-base ${badge.badgeClass}`}>
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: badge.dotColor }}
                        />
                        {badge.label}
                      </span>
                    )
                  })()}

                  <button
                    onClick={() => setLightboxItem(null)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Heartfelt Caption */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                    AI Vision Narrative
                  </h4>
                  <p className="text-base text-slate-100 font-medium leading-relaxed italic border-l-2 border-violet-500 pl-3">
                    "{lightboxItem.caption}"
                  </p>
                </div>

                {/* Mood Tags */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                    Mood & Energy Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(lightboxItem.tags || []).map((tag, idx) => (
                      <span key={idx} className="mood-tag-pill">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Technical Telemetry */}
                <div className="space-y-3 p-4 rounded-2xl bg-white/5 border border-white/5 text-xs text-slate-300">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">AI Confidence:</span>
                    <span className="font-mono text-violet-300 font-bold">
                      {(lightboxItem.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Confidence Visual Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-violet-500 to-indigo-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.round(lightboxItem.confidence * 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">Captured:</span>
                    <span className="font-mono text-slate-200">
                      {new Date(lightboxItem.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">Vector Index:</span>
                    <span className="font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={12} /> Atlas 512-dim
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-6 mt-6 border-t border-white/10">
                {lightboxItem.cloudinary_url && (
                  <a
                    href={lightboxItem.cloudinary_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 bg-sky-500/15 border border-sky-400/30 text-sky-200 hover:bg-sky-500/25 transition-all"
                  >
                    <span>View Full-Res on Cloudinary</span>
                    <ArrowUpRight size={14} />
                  </a>
                )}

                <button
                  onClick={() => handleDelete(lightboxItem.id)}
                  className="w-full py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-500/20 transition-all"
                >
                  <Trash2 size={14} />
                  <span>Delete Memory Forever</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
