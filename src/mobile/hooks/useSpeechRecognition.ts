import { useCallback, useEffect, useRef, useState } from 'react';

type AnyWindow = Window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

export function useSpeechRecognition(initialText = '') {
  const [transcript, setTranscript] = useState(initialText);
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);

  // refs so callbacks always see current values without stale closures
  const isListeningRef = useRef(false);
  const accumulatedRef = useRef(initialText);
  const SRClassRef = useRef<any>(null);
  const activeRecognitionRef = useRef<any>(null);
  const transcriptRef = useRef(initialText);

  // keep transcriptRef in sync so start() can snapshot it correctly
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  useEffect(() => {
    const w = window as unknown as AnyWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    SRClassRef.current = SR;

    return () => {
      isListeningRef.current = false;
      try { activeRecognitionRef.current?.abort(); } catch {}
      activeRecognitionRef.current = null;
    };
  }, []);

  const createAndStart = useCallback(() => {
    const SR = SRClassRef.current;
    if (!SR || !isListeningRef.current) return;

    let sessionFinal = '';

    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    activeRecognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          sessionFinal += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(accumulatedRef.current + sessionFinal + interim);
    };

    recognition.onend = () => {
      if (activeRecognitionRef.current === recognition) {
        activeRecognitionRef.current = null;
      }
      accumulatedRef.current += sessionFinal;
      sessionFinal = '';

      if (isListeningRef.current) {
        // 300ms delay masks the Android beep on stop/start cycle
        setTimeout(() => {
          if (isListeningRef.current) createAndStart();
        }, 300);
      } else {
        setRecording(false);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        isListeningRef.current = false;
        setRecording(false);
      }
      // no-speech / network / aborted → onend handles restart
    };

    try {
      recognition.start();
    } catch {
      isListeningRef.current = false;
      setRecording(false);
    }
  }, []);

  const start = useCallback(() => {
    if (isListeningRef.current) return;
    accumulatedRef.current = transcriptRef.current;
    isListeningRef.current = true;
    setRecording(true);
    createAndStart();
  }, [createAndStart]);

  const stop = useCallback(() => {
    isListeningRef.current = false;
    try { activeRecognitionRef.current?.stop(); } catch {}
    // setRecording(false) is called by onend
  }, []);

  // stable toggle: reads ref not state, so it's never stale
  const toggle = useCallback(() => {
    if (isListeningRef.current) { stop(); } else { start(); }
  }, [start, stop]);

  const setTranscriptExternal = useCallback((value: string) => {
    accumulatedRef.current = value;
    transcriptRef.current = value;
    setTranscript(value);
  }, []);

  return { transcript, recording, supported, toggle, setTranscript: setTranscriptExternal };
}
