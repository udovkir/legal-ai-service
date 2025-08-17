import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  DocumentIcon, 
  PhotoIcon, 
  XMarkIcon, 
  CloudArrowUpIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // в байтах
  acceptedTypes?: string[];
  disabled?: boolean;
  className?: string;
}

interface FileWithPreview extends File {
  preview?: string;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png'],
  disabled = false,
  className = '',
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (disabled) return;

    // Обработка отклоненных файлов
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(({ file, errors }) => {
        console.error('File rejected:', file.name, errors);
      });
    }

    // Добавление новых файлов
    const newFiles: FileWithPreview[] = acceptedFiles.map(file => ({
      ...file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const,
    }));

    const updatedFiles = [...files, ...newFiles].slice(0, maxFiles);
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  }, [files, maxFiles, disabled, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    maxFiles,
    maxSize,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    disabled,
  });

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(file => file.id !== fileId);
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  };

  const getFileIcon = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return <DocumentIcon className="w-8 h-8 text-error-500" />;
      case 'docx':
      case 'doc':
        return <DocumentIcon className="w-8 h-8 text-primary-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return <PhotoIcon className="w-8 h-8 text-success-500" />;
      default:
        return <DocumentIcon className="w-8 h-8 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileStatusColor = (status: FileWithPreview['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'uploading':
        return 'text-primary-500';
      case 'success':
        return 'text-success-500';
      case 'error':
        return 'text-error-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className={className}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`dropzone ${
          isDragActive ? 'active' : ''
        } ${
          isDragReject ? 'reject' : ''
        } ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          <CloudArrowUpIcon className="w-12 h-12 text-gray-400" />
          
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">
              {isDragActive 
                ? isDragReject 
                  ? 'Неподдерживаемый тип файла' 
                  : 'Отпустите файлы здесь'
                : 'Перетащите файлы сюда или нажмите для выбора'
              }
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Поддерживаемые форматы: PDF, DOCX, DOC, JPG, PNG
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Максимум {maxFiles} файлов, до {formatFileSize(maxSize)} каждый
            </p>
          </div>

          {isDragReject && (
            <div className="flex items-center space-x-2 text-error-600">
              <ExclamationTriangleIcon className="w-5 h-5" />
              <span className="text-sm">Неподдерживаемый тип файла</span>
            </div>
          )}
        </div>
      </div>

      {/* Список файлов */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-2"
          >
            <h4 className="text-sm font-medium text-gray-900">
              Выбранные файлы ({files.length}/{maxFiles})
            </h4>
            
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(file)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                    
                    {/* Прогресс загрузки */}
                    {file.status === 'uploading' && file.progress !== undefined && (
                      <div className="mt-1">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {file.progress}% загружено
                        </p>
                      </div>
                    )}
                    
                    {/* Ошибка */}
                    {file.status === 'error' && file.error && (
                      <p className="text-xs text-error-600 mt-1">
                        {file.error}
                      </p>
                    )}
                  </div>
                </div>

                {/* Кнопка удаления */}
                <button
                  onClick={() => removeFile(file.id)}
                  disabled={disabled}
                  className="p-1 text-gray-400 hover:text-error-500 transition-colors duration-200 disabled:opacity-50"
                  title="Удалить файл"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Информация о лимитах */}
      <div className="mt-3 text-xs text-gray-500">
        <p>• Максимум {maxFiles} файлов одновременно</p>
        <p>• Размер каждого файла до {formatFileSize(maxSize)}</p>
        <p>• Поддерживаемые форматы: {acceptedTypes.join(', ')}</p>
      </div>
    </div>
  );
};

export default FileUploader;

