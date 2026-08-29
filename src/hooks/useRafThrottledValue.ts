import { useEffect, useRef, useState } from "react";

/**
 * Returns `value`, but at a rate of at most once per animation frame.
 * Used to keep Markdown re-rendering at 60fps while streaming deltas may
 * arrive much faster than that.
 */
export function useRafThrottledValue<T>(value: T): T {
  const [displayed, setDisplayed] = useState(value);
  const latestRef = useRef(value);
  latestRef.current = value;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setDisplayed(latestRef.current);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return displayed;
}