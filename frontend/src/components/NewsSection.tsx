import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listNews, formatNewsDate, type NewsItem } from '../lib/news'

const HOME_NEWS_LIMIT = 6

export default function NewsSection() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    listNews(HOME_NEWS_LIMIT)
      .then((data) => {
        if (!cancelled) setNews(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Actualités</h2>
        <Link
          to="/actualites"
          className="text-sm font-medium text-gray-700 hover:text-black"
        >
          Voir toutes les actualités →
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 py-8 text-center">Chargement…</p>
      ) : error ? (
        <p className="text-gray-500 py-8 text-center">
          Impossible de charger les actualités.
        </p>
      ) : news.length === 0 ? (
        <p className="text-gray-500 py-8 text-center">
          Aucune actualité pour le moment.
        </p>
      ) : (
        <div className="space-y-4">
          {news.map((item) => (
            <Link
              key={item.id}
              to="/actualites"
              className="block bg-white rounded-lg border border-gray-200 p-5 hover:border-black hover:shadow-md transition-all"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt=""
                  className="w-full max-h-48 object-cover rounded-md border border-gray-200 mb-3"
                />
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {item.title}
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                {formatNewsDate(item.created_at)}
              </p>
              <p className="text-gray-700 line-clamp-3 whitespace-pre-wrap">
                {item.content}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
