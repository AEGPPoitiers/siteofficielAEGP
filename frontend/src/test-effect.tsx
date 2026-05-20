import { useState, useEffect } from 'react'

export default function TestEffect() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    console.log('demarré')

    const id = setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)

    return () => {
      console.log('cleanup')
      clearInterval(id)
    }
  }, [])
  return <p>Secondes ecoulées : {seconds}</p>
}
