const AWS = require('aws-sdk');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const logger = require('../utils/logger');

// Настройка AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;

// Загрузка файла в S3
const uploadToS3 = async (buffer, key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: getContentType(key),
      ACL: 'private'
    };

    const result = await s3.upload(params).promise();
    logger.info('File uploaded to S3:', { key, size: buffer.length });
    return result.Location;
  } catch (error) {
    logger.error('Error uploading to S3:', error);
    throw new Error('Failed to upload file to S3');
  }
};

// Получение файла из S3
const getFromS3 = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    const result = await s3.getObject(params).promise();
    return result.Body;
  } catch (error) {
    logger.error('Error getting file from S3:', error);
    throw new Error('Failed to get file from S3');
  }
};

// Удаление файла из S3
const deleteFromS3 = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(params).promise();
    logger.info('File deleted from S3:', { key });
  } catch (error) {
    logger.error('Error deleting file from S3:', error);
    throw new Error('Failed to delete file from S3');
  }
};

// Извлечение текста из файла
const extractTextFromFile = async (buffer, filename) => {
  try {
    const fileExtension = filename.split('.').pop().toLowerCase();
    
    switch (fileExtension) {
      case 'pdf':
        return await extractTextFromPDF(buffer);
      case 'docx':
      case 'doc':
        return await extractTextFromWord(buffer);
      case 'jpg':
      case 'jpeg':
      case 'png':
        return await extractTextFromImage(buffer);
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  } catch (error) {
    logger.error('Error extracting text from file:', error);
    throw new Error(`Failed to extract text from ${filename}`);
  }
};

// Извлечение текста из PDF
const extractTextFromPDF = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    logger.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

// Извлечение текста из Word документа
const extractTextFromWord = async (buffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    logger.error('Error extracting text from Word document:', error);
    throw new Error('Failed to extract text from Word document');
  }
};

// Извлечение текста из изображения (OCR)
const extractTextFromImage = async (buffer) => {
  try {
    // Предобработка изображения для улучшения OCR
    const processedBuffer = await sharp(buffer)
      .grayscale()
      .normalize()
      .sharpen()
      .toBuffer();

    const result = await Tesseract.recognize(processedBuffer, 'rus+eng', {
      logger: m => logger.debug('Tesseract:', m)
    });

    return result.data.text;
  } catch (error) {
    logger.error('Error extracting text from image:', error);
    throw new Error('Failed to extract text from image');
  }
};

// Получение MIME типа файла
const getContentType = (filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  
  const mimeTypes = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg'
  };

  return mimeTypes[extension] || 'application/octet-stream';
};

// Валидация файла
const validateFile = (file) => {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,doc,jpg,jpeg,png').split(',');
  
  // Проверка размера
  if (file.size > maxSize) {
    throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
  }

  // Проверка типа файла
  const fileExtension = file.originalname.split('.').pop().toLowerCase();
  if (!allowedTypes.includes(fileExtension)) {
    throw new Error(`File type .${fileExtension} is not allowed`);
  }

  return true;
};

// Создание превью для изображений
const createThumbnail = async (buffer, width = 200, height = 200) => {
  try {
    const thumbnail = await sharp(buffer)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    logger.error('Error creating thumbnail:', error);
    throw new Error('Failed to create thumbnail');
  }
};

// Получение метаданных файла
const getFileMetadata = async (buffer, filename) => {
  try {
    const fileExtension = filename.split('.').pop().toLowerCase();
    const metadata = {
      filename,
      size: buffer.length,
      type: getContentType(filename),
      extension: fileExtension
    };

    // Дополнительные метаданные для изображений
    if (['jpg', 'jpeg', 'png'].includes(fileExtension)) {
      const imageInfo = await sharp(buffer).metadata();
      metadata.width = imageInfo.width;
      metadata.height = imageInfo.height;
      metadata.format = imageInfo.format;
    }

    // Дополнительные метаданные для PDF
    if (fileExtension === 'pdf') {
      const pdfInfo = await pdfParse(buffer, { max: 1 }); // Только первая страница для метаданных
      metadata.pageCount = pdfInfo.numpages;
      metadata.pdfVersion = pdfInfo.info?.PDFFormatVersion;
    }

    return metadata;
  } catch (error) {
    logger.error('Error getting file metadata:', error);
    return {
      filename,
      size: buffer.length,
      type: getContentType(filename),
      extension: filename.split('.').pop().toLowerCase()
    };
  }
};

// Генерация уникального имени файла
const generateUniqueFilename = (originalFilename) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalFilename.split('.').pop();
  return `${timestamp}_${randomString}.${extension}`;
};

module.exports = {
  uploadToS3,
  getFromS3,
  deleteFromS3,
  extractTextFromFile,
  validateFile,
  createThumbnail,
  getFileMetadata,
  generateUniqueFilename
};

