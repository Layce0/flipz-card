import { useCallback, useEffect } from 'react';

const REVEAL_SOUND_SRC = '/sounds/card-reveal-fast.mp3';
const REVEAL_SOUND_GAIN = 5;

let sharedAudioContext: AudioContext | null = null;
let sharedGainNode: GainNode | null = null;
let sharedAudioBuffer: AudioBuffer | null = null;
let sharedAudioBufferPromise: Promise<void> | null = null;
let sharedFallbackAudio: HTMLAudioElement | null = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
};

const getGainNode = () => {
  const audioContext = getAudioContext();
  if (!audioContext) return null;

  if (!sharedGainNode) {
    sharedGainNode = audioContext.createGain();
    sharedGainNode.gain.value = REVEAL_SOUND_GAIN;
    sharedGainNode.connect(audioContext.destination);
  }

  return sharedGainNode;
};

const getFallbackAudio = () => {
  if (typeof window === 'undefined') return null;

  if (!sharedFallbackAudio) {
    sharedFallbackAudio = new Audio(REVEAL_SOUND_SRC);
    sharedFallbackAudio.preload = 'auto';
    sharedFallbackAudio.load();
  }

  return sharedFallbackAudio;
};

const preloadAudioBuffer = async () => {
  if (sharedAudioBuffer) return;
  if (sharedAudioBufferPromise) return sharedAudioBufferPromise;

  const audioContext = getAudioContext();
  if (!audioContext) return;

  sharedAudioBufferPromise = fetch(REVEAL_SOUND_SRC)
    .then(async (response) => {
      const audioData = await response.arrayBuffer();
      const decodedAudio = await audioContext.decodeAudioData(audioData.slice(0));
      sharedAudioBuffer = decodedAudio;
    })
    .catch(() => {
      sharedAudioBuffer = null;
    })
    .finally(() => {
      sharedAudioBufferPromise = null;
    });

  return sharedAudioBufferPromise;
};

const startBufferedPlayback = (audioContext: AudioContext, gainNode: GainNode, audioBuffer: AudioBuffer) => {
  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(gainNode);
  sourceNode.start(0);
  sourceNode.onended = () => sourceNode.disconnect();
};

export const useCardRevealSound = () => {
  useEffect(() => {
    getFallbackAudio();
    void preloadAudioBuffer();
  }, []);

  const primeRevealSound = useCallback(() => {
    const fallbackAudio = getFallbackAudio();
    if (fallbackAudio) {
      try {
        fallbackAudio.muted = true;
        const playPromise = fallbackAudio.play();
        if (playPromise) {
          void playPromise
            .then(() => {
              fallbackAudio.pause();
              fallbackAudio.currentTime = 0;
              fallbackAudio.muted = false;
            })
            .catch(() => {
              fallbackAudio.muted = false;
            });
        } else {
          fallbackAudio.muted = false;
        }
      } catch (_) {
        fallbackAudio.muted = false;
      }
    }

    const audioContext = getAudioContext();
    if (audioContext?.state === 'suspended') {
      void audioContext.resume();
    }

    void preloadAudioBuffer();
  }, []);

  const playRevealSound = useCallback(() => {
    const audioContext = getAudioContext();
    const gainNode = getGainNode();

    if (audioContext && gainNode && sharedAudioBuffer) {
      if (audioContext.state === 'suspended') {
        void audioContext.resume().then(() => {
          if (sharedAudioBuffer) {
            startBufferedPlayback(audioContext, gainNode, sharedAudioBuffer);
          }
        });
        return;
      }

      startBufferedPlayback(audioContext, gainNode, sharedAudioBuffer);
      return;
    }

    const fallbackAudio = getFallbackAudio();
    if (!fallbackAudio) return;

    fallbackAudio.currentTime = 0;
    fallbackAudio.volume = 1;
    void fallbackAudio.play();
  }, []);

  return {
    primeRevealSound,
    playRevealSound,
  };
};
