"use client";

import { useCallback, useEffect, useState } from "react";

export function useVerificationCountdown() {
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = window.setTimeout(() => {
      setSecondsRemaining((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [secondsRemaining]);

  const restart = useCallback((seconds = 60) => {
    setSecondsRemaining(Math.max(0, Math.floor(seconds)));
  }, []);

  return {
    secondsRemaining,
    expired: secondsRemaining === 0,
    restart,
  };
}
