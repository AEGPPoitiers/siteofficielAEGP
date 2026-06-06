import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import {
  ConfirmDialog,
  type ConfirmOptions,
} from '../components/ui/ConfirmDialog'

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Fournit un `confirm()` impératif qui résout un booléen via un modal maison. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions
    resolve: (ok: boolean) => void
  } | null>(null)

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => setState({ options, resolve })),
    [],
  )

  function close(ok: boolean) {
    state?.resolve(ok)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialog
          {...state.options}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm doit être utilisé dans un <ConfirmProvider>')
  }
  return ctx
}
