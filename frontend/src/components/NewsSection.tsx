import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listNews, formatNewsDate, type NewsItem } from '../lib/news'

const HOME_NEWS_LIMIT = 3

export default function NewsSection() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listNews(HOME_NEWS_LIMIT)
      .then((data) => {
        if (!cancelled) setNews(data)
      })
      .catch(() => {
        // Section secondaire : on n'affiche pas d'erreur bloquante sur l'accueil.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading || news.length === 0) return null

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
      <div className="space-y-4">
        {news.map((item) => (
          <Link
            key={item.id}
            to="/actualites"
            className="block bg-white rounded-lg border border-gray-200 p-5 hover:border-black hover:shadow-md transition-all"
          >
            <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
            <p className="text-xs text-gray-500 mb-2">
              {formatNewsDate(item.created_at)}
            </p>
            <p className="text-gray-700 line-clamp-3 whitespace-pre-wrap">
              {item.content}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
