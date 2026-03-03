import { useEffect, useState } from 'react';

export function useSparkleVisibility(showSparkle: boolean, duration = 5000): boolean {
  const [isVisible, setIsVisible] = useState(showSparkle);

  useEffect(() => {
    if (!showSparkle) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    const timer = window.setTimeout(() => setIsVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [showSparkle, duration]);

  return isVisible;
}
