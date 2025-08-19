import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface TextInputWithSpeechProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const TextInputWithSpeech: React.FC<TextInputWithSpeechProps> = ({
  onSubmit,
  placeholder = 'Задайте ваш юридический вопрос...',
  disabled = false,
  loading = false,
  className = '',
}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [transcript, setTranscript] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Инициализация Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'ru-RU';

      recognitionInstance.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript + interimTranscript);
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
        setIsListening(false);
        if (transcript.trim()) {
          setText(transcript.trim());
        }
      };

      setRecognition(recognitionInstance);
    }
  }, [transcript]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled && !loading) {
      onSubmit(text.trim());
      setText('');
      setTranscript('');
    }
  };

  const startRecording = () => {
    if (recognition && !isRecording) {
      setIsRecording(true);
      recognition.start();
    }
  };

  const stopRecording = () => {
    if (recognition && isRecording) {
      recognition.stop();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    autoResize();
  }, [text]);

  const isWebSpeechSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled || loading}
            className="w-full px-4 py-3 pr-24 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
            rows={1}
            maxLength={5000}
          />
          
          {/* Индикатор записи */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-3 right-16 flex items-center space-x-1"
              >
                <div className="w-2 h-2 bg-error-500 rounded-full animate-pulse" />
                <span className="text-xs text-error-600 font-medium">Запись...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Кнопки действий */}
          <div className="absolute top-2 right-2 flex items-center space-x-1">
            {/* Кнопка голосового ввода */}
            {isWebSpeechSupported && (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={disabled || loading}
                className={`p-2 rounded-md transition-colors duration-200 ${
                  isRecording
                    ? 'bg-error-100 text-error-600 hover:bg-error-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isRecording ? 'Остановить запись' : 'Начать голосовой ввод'}
              >
                {isRecording ? (
                  <StopIcon className="w-4 h-4" />
                ) : (
                  <MicrophoneIcon className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Кнопка отправки */}
            <button
              type="submit"
              disabled={!text.trim() || disabled || loading}
              className="p-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              title="Отправить"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Счетчик символов */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span>{text.length}/5000</span>
          {isWebSpeechSupported && (
            <span className="flex items-center space-x-1">
              <MicrophoneIcon className="w-3 h-3" />
              <span>Голосовой ввод доступен</span>
            </span>
          )}
        </div>
      </form>

      {/* Предварительный просмотр транскрипции */}
      <AnimatePresence>
        {isListening && transcript && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 p-3 bg-primary-50 border border-primary-200 rounded-lg"
          >
            <div className="text-xs text-primary-600 font-medium mb-1">
              Распознавание речи:
            </div>
            <div className="text-sm text-primary-800">{transcript}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Подсказки */}
      {!isWebSpeechSupported && (
        <div className="mt-2 text-xs text-gray-500">
          <span>Голосовой ввод не поддерживается в вашем браузере</span>
        </div>
      )}
    </div>
  );
};

export default TextInputWithSpeech;

