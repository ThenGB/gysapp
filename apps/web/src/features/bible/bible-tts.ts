import type { BiblePackCode } from '@gysapp/core';

export interface BibleTtsState {
  available: boolean;
  speaking: boolean;
  paused: boolean;
  rate: number;
}

const LANGUAGE_BY_VERSION: Record<BiblePackCode, string> = {
  b_tb: 'id-ID',
  b_kjv: 'en-US',
  b_cuv: 'zh-CN',
};

class BibleTtsController {
  private listeners = new Set<() => void>();
  private state: BibleTtsState = {
    available: typeof window !== 'undefined' && 'speechSynthesis' in window,
    speaking: false,
    paused: false,
    rate: 1,
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): BibleTtsState => this.state;

  private emit(partial: Partial<BibleTtsState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener();
  }

  setRate(rate: number): void {
    this.emit({ rate: Math.min(1.5, Math.max(0.7, rate)) });
  }

  speak(text: string, version: BiblePackCode): void {
    if (!this.state.available || !text.trim()) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANGUAGE_BY_VERSION[version];
    utterance.rate = this.state.rate;
    const voices = speechSynthesis.getVoices();
    const language = LANGUAGE_BY_VERSION[version].toLowerCase();
    const base = language.split('-')[0];
    const voice =
      voices.find((candidate) => candidate.lang.toLowerCase() === language) ??
      voices.find((candidate) => candidate.lang.toLowerCase().startsWith(`${base}-`));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => this.emit({ speaking: true, paused: false });
    utterance.onpause = () => this.emit({ paused: true });
    utterance.onresume = () => this.emit({ paused: false });
    utterance.onend = () => this.emit({ speaking: false, paused: false });
    utterance.onerror = () => this.emit({ speaking: false, paused: false });
    speechSynthesis.speak(utterance);
  }

  togglePause(): void {
    if (!this.state.available || !this.state.speaking) return;
    if (speechSynthesis.paused) speechSynthesis.resume();
    else speechSynthesis.pause();
  }

  stop(): void {
    if (!this.state.available) return;
    speechSynthesis.cancel();
    this.emit({ speaking: false, paused: false });
  }
}

export const bibleTts = new BibleTtsController();
