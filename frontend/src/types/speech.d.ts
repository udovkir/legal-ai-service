// Ambient declarations for Web Speech API to satisfy TypeScript during build

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

// Basic alias so usages like `useState<SpeechRecognition | null>` compile
type SpeechRecognition = any;

export {};


