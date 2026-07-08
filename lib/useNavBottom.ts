import { useEffect, useState } from 'react'

// Measures where the nav bar actually ends, so modal overlays can avoid
// covering it. The dev-environment banner mounts slightly after first paint
// and shifts the nav down, so this keeps watching rather than measuring once.
export function useNavBottom(): number {
  const [navBottom, setNavBottom] = useState(56)

  useEffect(() => {
    function measure() {
      const nav = document.querySelector('nav')
      if (nav) setNavBottom(nav.getBoundingClientRect().bottom)
    }
    measure()
    const observer = new MutationObserver(measure)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return navBottom
}
