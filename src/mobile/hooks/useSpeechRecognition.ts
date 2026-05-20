import { useEffect, useRef, useState } from 'react';

type AnyWindow = Window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

export function useSpeechRecognition(initialText = '') {
  const [transcript, setTranscript] = useState(initialText);
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);

  const isListeningRef = useRef(false);
  const accumulatedRef = useRef(initialText);
  const SRRef = useRef<any>(null);

  useEffect(() => {
    const w = window as unknown as AnyWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    SRRef.current = SR;
  }, []);

  function createAndStart() {
    const SR = SRRef.current;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.continuous = false; // prevents Android echo bug
    recognition.interimResults = true;

    // Accumulates final results within a single recognition session.
    // Reset to '' each time createAndStart() is called so Android can't
    // replay stale results from a previous session.
    let sessionFinal = '';

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
      accumulatedRef.current += sessionFinal;
      sessionFinal = '';
      if (isListeningRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setRecording(false);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        isListeningRef.current = false;
        setRecording(false);
      }
      // Other errors (no-speech, network, aborted) let onend handle restart
    };

    try {
      recognition.start();
    } catch {
      isListeningRef.current = false;
      setRecording(false);
    }
  }

  function start() {
    if (isListeningRef.current) return;
    // Sync accumulatedRef with any manual edits to transcript before recording
    accumulatedRef.current = transcript;
    isListeningRef.current = true;
    setRecording(true);
    createAndStart();
  }

  function stop() {
    isListeningRef.current = false;
    // setRecording(false) will be called by onend
  }

  function toggle() {
    if (recording) { stop(); } else { start(); }
  }

  function setTranscriptExternal(value: string) {
    accumulatedRef.current = value;
    setTranscript(value);
  }

  return { transcript, recording, supported, toggle, setTranscript: setTranscriptExternal };
}
