import { useState, useEffect, useCallback } from 'react'
import {
  Search, X, Trash2, ChevronLeft, ChevronRight,
  Calendar, Sparkles, Filter, Loader, ImageOff,
  ZoomIn, Clock
} from 'lucide-react'
import { getGallery, searchGallery, deleteMoment, resolveImageUrl } from '../api'

const CLASSIFICATION_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'SPECIFIC_CANDID', label: '✨ Deep Candid' },
  { value: 'GENERAL_CANDID', label: '🌿 General Candid' },
  { value: 'POSED', label: '📸 Posed' },
  { value: 'JUNK', label: '🗑️ Junk' },
]

function classificationBadge(cls) {
  const map = {
    SPECIFIC_CANDID: { class: 'badge-specific-candid', label: '✨ Specific Candid' },
    GENERAL_CANDID: { class: 'badge-general-candid', label: '🌿 General Candid' },
    POSED: { class: 'badge-posed', label: '📸 Posed' },
    JUNK: { class: 'badge-junk', label: '🗑️ Junk' },
  }
  const info = map[cls] || map.JUNK
  return (
    <span className={`mood-chip ${info.class}`} style={{ fontSize: '0.65rem' }}>
      {info.label}
    </span>
  )
}

function formatDate(isoStr) {
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return isoStr }
}

export default function Gallery() {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [classFilter, setClassFilter] = useState('')
  const [lightboxItem, setLightboxItem] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const fetchGallery = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getGallery(page, 20, {
        classification: classFilter || undefined,
      })
      setMoments(data.moments || [])
      setTotalPages(data.pages || 1)
    } catch (err) {
      console.error('Gallery fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [page, classFilter])

  useEffect(() => {
    if (!searchResults) fetchGallery()
  }, [fetchGallery, searchResults])

  // Semantic search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setIsSearching(true)
    try {
      const data = await searchGallery(searchQuery.trim())
      setSearchResults(data.results || [])
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery])

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
  }

  // Delete
  const handleDelete = async (id) => {
    if (!confirm('Delete this moment forever?')) return
    try {
      await deleteMoment(id)
      setMoments(prev => prev.filter(m => m.id !== id))
      if (searchResults) {
        setSearchResults(prev => prev.filter(m => m.id !== id))
      }
      if (lightboxItem?.id === id) setLightboxItem(null)
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const displayMoments = searchResults || moments

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* ── Search Bar ──────────────────────────────────── */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              id="search-input"
              type="text"
              placeholder='Search memories... (e.g. "sitting together laughing")'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full pl-12 pr-12 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                focusRingColor: 'rgba(139, 92, 246, 0.3)',
              }}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-80"
              >
                <X size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>

          <button
            id="search-button"
            onClick={handleSearch}
            disabled={isSearching}
            className="px-5 py-3 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            style={{ background: 'var(--gradient-primary)' }}
          >
            {isSearching ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Search
          </button>

          <button
            id="filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-3 rounded-xl text-sm transition-all glass-card flex items-center gap-2"
            style={{ color: showFilters ? 'var(--text-accent)' : 'var(--text-secondary)' }}
          >
            <Filter size={16} />
          </button>
        </div>

        {/* Filters row */}
        {showFilters && (
          <div className="flex gap-2 flex-wrap fade-in-up">
            {CLASSIFICATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  setClassFilter(opt.value)
                  setPage(1)
                  setSearchResults(null)
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: classFilter === opt.value ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-tertiary)',
                  border: `1px solid ${classFilter === opt.value ? 'rgba(139, 92, 246, 0.3)' : 'var(--border-subtle)'}`,
                  color: classFilter === opt.value ? 'var(--text-accent)' : 'var(--text-secondary)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {searchResults && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Sparkles size={14} style={{ color: 'var(--text-accent)' }} />
            <span>
              {searchResults.length} semantic match{searchResults.length !== 1 ? 'es' : ''} for{' '}
              <strong style={{ color: 'var(--text-accent)' }}>"{searchQuery}"</strong>
            </span>
            <button onClick={clearSearch} className="text-xs underline hover:opacity-80">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ── Gallery Grid ──────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size={32} className="animate-spin" style={{ color: 'var(--text-accent)' }} />
        </div>
      ) : displayMoments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <ImageOff size={48} style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
            No moments yet
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Start the camera to capture your first candid memory
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayMoments.map((m, i) => (
            <div
              key={m.id || i}
              className="glass-card overflow-hidden group fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {/* Image */}
              <div
                className="relative aspect-[4/3] overflow-hidden cursor-pointer"
                onClick={() => setLightboxItem(m)}
              >
                <img
                  src={resolveImageUrl(m.cloudinary_url || m.filepath)}
                  alt={m.caption}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                  <button
                    onClick={e => { e.stopPropagation(); setLightboxItem(m) }}
                    className="p-2 rounded-lg glass"
                  >
                    <ZoomIn size={16} className="text-white" />
                  </button>
                </div>

                {/* Score badge (for search results) */}
                {m.score !== undefined && (
                  <div className="absolute top-2 right-2 glass rounded-lg px-2 py-1">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-accent)' }}>
                      {(m.score * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  {classificationBadge(m.classification)}
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {(m.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {m.caption}
                </p>

                {/* Tags */}
                {m.tags && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {m.tags.map((tag, ti) => (
                      <span key={ti} className="mood-chip">{tag}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={12} />
                    {formatDate(m.created_at)}
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────── */}
      {!searchResults && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg glass-card disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg glass-card disabled:opacity-30 transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────── */}
      {lightboxItem && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] mx-4 flex flex-col lg:flex-row gap-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Image */}
            <div className="flex-1 flex items-center justify-center">
              <img
                src={resolveImageUrl(lightboxItem.cloudinary_url || lightboxItem.filepath)}
                alt={lightboxItem.caption}
                className="max-w-full max-h-[80vh] object-contain rounded-2xl"
                style={{ boxShadow: 'var(--shadow-lg)' }}
              />
            </div>

            {/* Metadata sidebar */}
            <div
              className="glass rounded-2xl p-6 lg:w-80 space-y-4"
              style={{ maxHeight: '80vh', overflowY: 'auto' }}
            >
              <button
                onClick={() => setLightboxItem(null)}
                className="absolute top-2 right-2 p-2 rounded-lg glass hover:opacity-80"
              >
                <X size={18} className="text-white" />
              </button>

              {classificationBadge(lightboxItem.classification)}

              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  Caption
                </h3>
                <p className="text-sm leading-relaxed">{lightboxItem.caption}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                  Mood Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(lightboxItem.tags || []).map((tag, i) => (
                    <span key={i} className="mood-chip">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Confidence</span>
                  <span className="font-mono">{(lightboxItem.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Captured</span>
                  <span>{formatDate(lightboxItem.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>File</span>
                  <span className="font-mono truncate max-w-[180px]">{lightboxItem.filename}</span>
                </div>
              </div>

              <button
                onClick={() => { handleDelete(lightboxItem.id); setLightboxItem(null) }}
                className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                }}
              >
                <Trash2 size={14} />
                Delete Moment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
