const OpenAI = require('openai');
const { getFromS3 } = require('./fileService');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Транскрибация аудио через OpenAI Whisper
const transcribeAudio = async (audioPath) => {
  try {
    logger.info('Starting audio transcription:', { audioPath });

    // Получаем аудио файл из S3
    const audioBuffer = await getFromS3(audioPath);

    // Создаем временный файл для OpenAI API
    const tempFile = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' });

    // Отправляем на транскрибацию
    const transcription = await openai.audio.transcriptions.create({
      file: tempFile,
      model: 'whisper-1',
      language: 'ru',
      response_format: 'text'
    });

    const transcribedText = transcription.text;
    logger.info('Audio transcription completed:', { 
      audioPath, 
      textLength: transcribedText.length 
    });

    return transcribedText;
  } catch (error) {
    logger.error('Error transcribing audio:', error);
    throw new Error('Failed to transcribe audio');
  }
};

// Транскрибация аудио с временными метками
const transcribeAudioWithTimestamps = async (audioPath) => {
  try {
    logger.info('Starting audio transcription with timestamps:', { audioPath });

    const audioBuffer = await getFromS3(audioPath);
    const tempFile = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' });

    const transcription = await openai.audio.transcriptions.create({
      file: tempFile,
      model: 'whisper-1',
      language: 'ru',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    });

    logger.info('Audio transcription with timestamps completed:', { audioPath });
    return transcription;
  } catch (error) {
    logger.error('Error transcribing audio with timestamps:', error);
    throw new Error('Failed to transcribe audio with timestamps');
  }
};

// Валидация аудио файла
const validateAudioFile = (file) => {
  const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];
  const maxSize = 25 * 1024 * 1024; // 25MB для аудио

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Unsupported audio format. Please use MP3, WAV, OGG, or MP4.');
  }

  if (file.size > maxSize) {
    throw new Error(`Audio file size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
  }

  return true;
};

// Получение длительности аудио файла
const getAudioDuration = async (audioBuffer) => {
  try {
    // Простая оценка длительности на основе размера файла
    // Это приблизительная оценка, для точности нужна библиотека типа ffprobe
    const bytesPerSecond = 16000; // Примерная оценка для WAV
    const durationSeconds = audioBuffer.length / bytesPerSecond;
    
    return Math.round(durationSeconds);
  } catch (error) {
    logger.error('Error getting audio duration:', error);
    return null;
  }
};

// Конвертация аудио в нужный формат (если необходимо)
const convertAudioFormat = async (audioBuffer, targetFormat = 'wav') => {
  try {
    // Здесь можно добавить логику конвертации аудио
    // Для простоты возвращаем исходный буфер
    logger.info('Audio format conversion requested:', { targetFormat });
    return audioBuffer;
  } catch (error) {
    logger.error('Error converting audio format:', error);
    throw new Error('Failed to convert audio format');
  }
};

// Обработка аудио для улучшения качества
const enhanceAudio = async (audioBuffer) => {
  try {
    // Здесь можно добавить логику улучшения аудио
    // Например, шумоподавление, нормализация громкости
    logger.info('Audio enhancement requested');
    return audioBuffer;
  } catch (error) {
    logger.error('Error enhancing audio:', error);
    throw new Error('Failed to enhance audio');
  }
};

// Создание превью аудио (первые несколько секунд)
const createAudioPreview = async (audioBuffer, durationSeconds = 10) => {
  try {
    // Здесь можно добавить логику создания превью аудио
    // Для простоты возвращаем исходный буфер
    logger.info('Audio preview creation requested:', { durationSeconds });
    return audioBuffer;
  } catch (error) {
    logger.error('Error creating audio preview:', error);
    throw new Error('Failed to create audio preview');
  }
};

// Получение метаданных аудио файла
const getAudioMetadata = async (audioBuffer, filename) => {
  try {
    const metadata = {
      filename,
      size: audioBuffer.length,
      type: 'audio',
      extension: filename.split('.').pop().toLowerCase()
    };

    // Попытка получить длительность
    const duration = await getAudioDuration(audioBuffer);
    if (duration) {
      metadata.duration = duration;
    }

    return metadata;
  } catch (error) {
    logger.error('Error getting audio metadata:', error);
    return {
      filename,
      size: audioBuffer.length,
      type: 'audio',
      extension: filename.split('.').pop().toLowerCase()
    };
  }
};

module.exports = {
  transcribeAudio,
  transcribeAudioWithTimestamps,
  validateAudioFile,
  getAudioDuration,
  convertAudioFormat,
  enhanceAudio,
  createAudioPreview,
  getAudioMetadata
};

