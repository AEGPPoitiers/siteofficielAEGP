import { createContext, useContext, useState, type ReactNode } from 'react'

type CountContextValue = {
  count: number
  increment: () => void
}

const CountContext = createContext<CountContextValue | null>(null)

function CountProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState<number>(0)

  function increment() {
    setCount((c) => c + 1)
  }

  const value = { count, increment }

  return <CountContext.Provider value={value}>{children}</CountContext.Provider>
}

function useCount() {
  const ctx = useContext(CountContext)
  if (!ctx) throw new Error('useCount doit être utilisé dans <CountProvider>')
  return ctx
}

function Compteur() {
  const { count, increment } = useCount()
  return (
    <div>
      <p>Compteur: {count}</p>
      <button onClick={increment}>+1</button>
    </div>
  )
}

export default function TestCount() {
  return (
    <CountProvider>
      <Compteur />
    </CountProvider>
  )
}
