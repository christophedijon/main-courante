import { useEffect, useRef, useState } from 'react';

type AnyWindow = Window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

export function useSpeechRecognition(initialText = '') {
  const [transcript, setTranscript] = useState(initialText);
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);

  const recRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const lastResultIndexRef = useRef(0);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    // Sync finalTranscriptRef when transcript is set externally (e.g. initial draft value)
    finalTranscriptRef.current = initialText;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const w = window as unknown as AnyWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let interimTranscript = '';

      // Start from lastResultIndexRef to avoid replaying already-processed results on Android
      for (let i = lastResultIndexRef.current; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          const text = result[0].transcript;
          finalTranscriptRef.current = finalTranscriptRef.current
            ? finalTranscriptRef.current + ' ' + text.trim()
            : text.trim();
          lastResultIndexRef.current = i + 1;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setTranscript(
        interimTranscript
          ? finalTranscriptRef.current + ' ' + interimTranscript
          : finalTranscriptRef.current,
      );
    };

    rec.onend = () => {
      // On Android, continuous mode fires onend between sentences and auto-restarts.
      // Only restart if we're still supposed to be listening; do NOT reset refs.
      if (isListeningRef.current) {
        try { rec.start(); } catch {}
      } else {
        setRecording(false);
      }
    };

    recRef.current = rec;
    return () => {
      isListeningRef.current = false;
      try { rec.stop(); } catch {}
    };
  }, []);

  function start() {
    if (!recRef.current || isListeningRef.current) return;
    // Reset accumulation only on a fresh explicit start
    lastResultIndexRef.current = 0;
    finalTranscriptRef.current = transcript;
    isListeningRef.current = true;
    try {
      recRef.current.start();
      setRecording(true);
    } catch {
      isListeningRef.current = false;
      setRecording(false);
    }
  }

  function stop() {
    isListeningRef.current = false;
    try { recRef.current?.stop(); } catch {}
    setRecording(false);
  }

  function toggle() {
    if (recording) { stop(); } else { start(); }
  }

  function setTranscriptExternal(value: string) {
    finalTranscriptRef.current = value;
    setTranscript(value);
  }

  return { transcript, recording, supported, toggle, setTranscript: setTranscriptExternal };
}
