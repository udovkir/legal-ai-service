const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Ошибки валидации
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }

  // Ошибки базы данных
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({
      error: 'Resource already exists',
      details: err.detail
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      error: 'Referenced resource not found',
      details: err.detail
    });
  }

  if (err.code === '23502') { // Not null violation
    return res.status(400).json({
      error: 'Required field missing',
      details: err.detail
    });
  }

  // Ошибки файлов
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      details: 'File size exceeds the maximum allowed limit'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field',
      details: 'File upload field name is incorrect'
    });
  }

  // Ошибки OpenAI API
  if (err.message && err.message.includes('OpenAI')) {
    return res.status(503).json({
      error: 'AI Service Unavailable',
      details: 'The AI service is currently unavailable. Please try again later.'
    });
  }

  // Ошибки AWS S3
  if (err.code === 'NoSuchBucket' || err.code === 'AccessDenied') {
    return res.status(500).json({
      error: 'File Storage Error',
      details: 'Unable to access file storage service'
    });
  }

  // Ошибки Redis
  if (err.code === 'ECONNREFUSED' && err.message.includes('redis')) {
    return res.status(503).json({
      error: 'Cache Service Unavailable',
      details: 'The cache service is currently unavailable'
    });
  }

  // Ошибки PostgreSQL
  if (err.code === 'ECONNREFUSED' && err.message.includes('postgres')) {
    return res.status(503).json({
      error: 'Database Unavailable',
      details: 'The database service is currently unavailable'
    });
  }

  // Ошибки Socket.IO
  if (err.message && err.message.includes('socket')) {
    return res.status(503).json({
      error: 'Real-time Service Unavailable',
      details: 'The real-time communication service is currently unavailable'
    });
  }

  // Общие ошибки сервера
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // В продакшене не отправляем стек ошибки
  const response = {
    error: message
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;

