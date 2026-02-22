'use client'

import { useEffect, useState } from 'react'

export function OriginInput() {
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  return <input type="hidden" name="origin" value={origin} />
}
