"use client";

import { useEffect } from "react";

let audioContext: AudioContext | null = null;

export function unlockNotificationAudio() {
  if (typeof window === "undefined" || !window.AudioContext) return;

  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume();
  } catch {
    audioContext = null;
  }
}

export function playWaiterReadyBell() {
  if (
    typeof document === "undefined" ||
    !document.documentElement.classList.contains("a11y-sound-alerts") ||
    !audioContext ||
    audioContext.state !== "running"
  ) return;

  const startAt = audioContext.currentTime;
  [880, 1174].forEach((frequency, index) => {
    const oscillator = audioContext!.createOscillator();
    const gain = audioContext!.createGain();
    const noteStart = startAt + index * 0.12;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.18 : 0.12, noteStart + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.75);
    oscillator.connect(gain);
    gain.connect(audioContext!.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.76);
  });
}

export function NotificationSoundUnlock() {
  useEffect(() => {
    const unlock = () => {
      unlockNotificationAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}