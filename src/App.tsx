import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleDollarSign, Coins, RefreshCcw } from 'lucide-react'
import './index.css'
 
type Currency = 'usd' | 'clp'
 
type MarketCoin = {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  price_change_percentage_24h: number
  sparkline_in_7d?: { price: number[] }
  market_cap?: number
}
 
function formatCurrency(value: number, currency: Currency) {
  const locale = currency === 'usd' ? 'en-US' : 'es-CL'
  const opts: Intl.NumberFormatOptions =
    currency === 'usd'
      ? { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }
      : { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }
  return new Intl.NumberFormat(locale, opts).format(value)
}
 
function useMarkets(currency: Currency) {
  const [data, setData] = useState<MarketCoin[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const BASE_MS = 180000
  const MAX_MS = 900000
  const [refreshMs, setRefreshMs] = useState<number>(BASE_MS)
  const [nextAt, setNextAt] = useState<number | null>(null)
 
  useEffect(() => {
    let mounted = true
    let controller = new AbortController()
 
    const scheduleNext = (ms: number) => {
      if (!mounted) return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setNextAt(Date.now() + ms)
      timeoutRef.current = window.setTimeout(() => {
        controller.abort()
        controller = new AbortController()
        load()
      }, ms)
    }
 
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          vs_currency: currency,
          order: 'market_cap_desc',
          per_page: '10',
          page: '1',
          sparkline: 'true',
        })
        const url = `https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: MarketCoin[] = await res.json()
        let filtered = json.filter(
          (c) => c.id !== 'tether' && c.symbol.toLowerCase() !== 'usdt'
        )
        const hasSol = filtered.some((c) => c.id === 'solana')
        if (!hasSol) {
          const solParams = new URLSearchParams({
            vs_currency: currency,
            ids: 'solana',
            sparkline: 'true',
          })
          const solUrl = `https://api.coingecko.com/api/v3/coins/markets?${solParams.toString()}`
          const solRes = await fetch(solUrl, { signal: controller.signal })
          if (solRes.ok) {
            const solJson: MarketCoin[] = await solRes.json()
            if (solJson[0]) filtered = [...filtered, solJson[0]]
          }
        }
        filtered.sort(
          (a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0)
        )
        const top5 = filtered.slice(0, 5)
        if (mounted) {
          setData(top5)
          setRefreshMs(BASE_MS)
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          setError('Error al obtener datos')
          const is429 = typeof e?.message === 'string' && e.message.includes('HTTP 429')
          const next = is429 ? Math.min(refreshMs * 2, MAX_MS) : Math.min(Math.round(refreshMs * 1.5), MAX_MS)
          setRefreshMs(next)
        }
      } finally {
        if (mounted) setLoading(false)
        scheduleNext(refreshMs)
      }
    }
    load()
    return () => {
      mounted = false
      controller.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [currency])
 
  const refreshNow = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setNextAt(null)
    setRefreshMs(BASE_MS)
    loadImmediate()
  }
 
  const loadImmediate = () => {
    const controller = new AbortController()
    const run = async () => {
      try {
        const params = new URLSearchParams({
          vs_currency: currency,
          order: 'market_cap_desc',
          per_page: '5',
          page: '1',
          sparkline: 'true',
        })
        const url = `https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: MarketCoin[] = await res.json()
        setData(json)
        setError(null)
        setRefreshMs(BASE_MS)
        setNextAt(Date.now() + BASE_MS)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = window.setTimeout(() => {
          refreshNow()
        }, BASE_MS)
      } catch (e: any) {
        if (e.name !== 'AbortError') setError('Error al obtener datos')
      }
    }
    run()
  }
 
  return { data, loading, error, refreshMs, nextAt, refreshNow }
}
 
function Sparkline({ values }: { values?: number[] }) {
  const path = useMemo(() => {
    if (!values || values.length === 0) return ''
    const w = 120
    const h = 32
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    return pts.join(' ')
  }, [values])
  return (
    <svg width="120" height="32" viewBox="0 0 120 32" className="overflow-visible">
      <path d={path} className="stroke-emerald-400" fill="none" strokeWidth="2" />
    </svg>
  )
}
 
function Toggle({ currency, onChange }: { currency: Currency; onChange: (c: Currency) => void }) {
  const isUSD = currency === 'usd'
  return (
    <button
      onClick={() => onChange(isUSD ? 'clp' : 'usd')}
      className="flex items-center gap-2 rounded-full px-3 py-2 bg-glass-100 border border-white/10 hover:bg-glass-200 transition-colors"
    >
      <CircleDollarSign className={`h-4 w-4 ${isUSD ? 'text-emerald-400' : 'text-neutral-400'}`} />
      <span className="text-sm font-medium">{isUSD ? 'USD' : 'CLP'}</span>
    </button>
  )
}
 
function Card({ coin, currency }: { coin: MarketCoin; currency: Currency }) {
  const change = coin.price_change_percentage_24h
  const positive = change >= 0
  return (
    <div className="rounded-2xl p-4 bg-glass-100 border border-white/10 shadow-glass backdrop-blur-md">
      <div className="flex items-center gap-3">
        <img src={coin.image} alt={coin.name} className="h-8 w-8 rounded-full" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{coin.name}</div>
          <div className="text-xs text-neutral-400 uppercase">{coin.symbol}</div>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold">{formatCurrency(coin.current_price, currency)}</div>
          <div className={`text-xs ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {positive ? '+' : ''}
            {change.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Sparkline values={coin.sparkline_in_7d?.price} />
      </div>
    </div>
  )
}
 
function SkeletonCard() {
  return (
    <div className="rounded-2xl p-4 bg-glass-100 border border-white/10 shadow-glass backdrop-blur-md animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-white/10" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-white/10 rounded mb-2" />
          <div className="h-3 w-16 bg-white/10 rounded" />
        </div>
        <div className="text-right">
          <div className="h-4 w-28 bg-white/10 rounded mb-2" />
          <div className="h-3 w-16 bg-white/10 rounded" />
        </div>
      </div>
      <div className="mt-3 h-8 bg-white/10 rounded" />
    </div>
  )
}
 
function Jumbotron({ currency, remaining }: { currency: Currency; remaining: string }) {
  const sub = currency === 'usd' ? 'Precios en USD' : 'Precios en CLP'
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-glass-200 via-glass-100 to-transparent backdrop-blur-md shadow-glass px-6 py-8 md:px-10 md:py-12 mb-6">
      <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-violet-500/10 blur-2xl" />
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Seguimiento de criptomonedas en tiempo real</h2>
          <p className="mt-2 text-sm md:text-base text-neutral-300">
            Observa el top de monedas con variación 24h, gráfico mini y cambio rápido entre USD y CLP. Actualización adaptativa cada pocos minutos para respetar los límites de la API.
          </p>
          <p className="mt-2 text-xs text-neutral-400">{sub} • Próxima actualización en {remaining}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl px-4 py-3 bg-white/5 border border-white/10">
            <div className="text-xs text-neutral-400">Siguiente refresh</div>
            <div className="text-lg font-semibold">{remaining}</div>
          </div>
          <div className="hidden md:block h-16 w-px bg-white/10" />
          <div className="rounded-2xl px-4 py-3 bg-white/5 border border-white/10">
            <div className="text-xs text-neutral-400">Mercado</div>
            <div className="text-lg font-semibold uppercase">{currency}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
 
export default function App() {
  const [currency, setCurrency] = useState<Currency>('usd')
  const { data, loading, error, nextAt, refreshNow } = useMarkets(currency)
  const [remaining, setRemaining] = useState<string>('—')
 
  useEffect(() => {
    const t = window.setInterval(() => {
      if (!nextAt) {
        setRemaining('—')
        return
      }
      const ms = Math.max(0, nextAt - Date.now())
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      const mm = String(m).padStart(1, '0')
      const ss = String(s).padStart(2, '0')
      setRemaining(`${mm}:${ss}`)
    }, 1000)
    return () => clearInterval(t)
  }, [nextAt])
 
  return (
    <div className="min-h-dvh px-4 py-6 md:px-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-6 w-6 text-emerald-400" />
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">CryptoTracker</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full px-3 py-1 text-xs bg-glass-100 border border-white/10">
            Actualiza en {remaining}
          </div>
          <button
            aria-label="Actualizar ahora"
            onClick={refreshNow}
            className="flex items-center gap-1 rounded-full px-3 py-2 bg-glass-100 border border-white/10 hover:bg-glass-200 transition-colors"
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="text-sm">Actualizar</span>
          </button>
          <Toggle currency={currency} onChange={setCurrency} />
        </div>
      </header>
 
      <Jumbotron currency={currency} remaining={remaining} />
 
      {error && <div className="text-rose-400 mb-4 text-sm">{error}</div>}
 
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        {!loading &&
          data?.map((coin) => <Card key={coin.id} coin={coin} currency={currency} />)}
      </div>
    </div>
  )
}
