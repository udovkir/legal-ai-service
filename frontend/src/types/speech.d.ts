// Ambient declarations for Web Speech API to satisfy TypeScript during build

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }

  // Make the alias global so generic annotations compile
  type SpeechRecognition = any;
}

export {};


