# LegalAI - AI-сервис для юридических консультаций

Полнофункциональное full-stack приложение для получения юридических консультаций с использованием искусственного интеллекта. Поддерживает текстовые, голосовые запросы и анализ документов.

## 🚀 Возможности

### Мультимодальный ввод
- **Текстовые вопросы** с автодополнением
- **Голосовой ввод** через Web Speech API
- **Загрузка файлов** (PDF, DOCX, изображения) с OCR
- **Drag-and-drop** интерфейс

### AI-обработка
- Интеграция с OpenAI GPT-4
- Семантический поиск с pgvector
- Автоматическое определение тегов
- Генерация SEO-статей

### Автоматизация
- n8n workflows для автоматизации процессов
- Webhook интеграции
- Telegram уведомления
- Автоматическая модерация

### Безопасность
- JWT аутентификация
- Ролевая модель (пользователь/модератор/админ)
- Валидация файлов
- Rate limiting

## 🛠 Технологический стек

### Frontend
- **React 18** с TypeScript
- **Tailwind CSS** для стилизации
- **Framer Motion** для анимаций
- **React Query** для управления состоянием
- **Socket.IO** для real-time обновлений

### Backend
- **Node.js** с Express
- **PostgreSQL** с pgvector для семантического поиска
- **Redis** для кэширования
- **AWS S3** для хранения файлов
- **OpenAI API** для AI-обработки

### Инфраструктура
- **Docker** и Docker Compose
- **Nginx** для проксирования
- **n8n** для автоматизации
- **Winston** для логирования

## 📋 Требования

- Docker и Docker Compose
- Node.js 18+ (для разработки)
- PostgreSQL 16+ с расширением pgvector
- Redis 7+
- AWS S3 bucket (для продакшена)

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd legal-ai-service
```

### 2. Настройка переменных окружения

Скопируйте пример файла окружения:

```bash
cp env.example .env
```

Отредактируйте `.env` файл, указав ваши настройки:

```env
# Database
DATABASE_URL=postgresql://legal_user:legal_password@localhost:5432/legal_ai_db
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=legal-ai-files
AWS_REGION=us-east-1

# n8n
N8N_USER=admin
N8N_PASSWORD=secure-password
N8N_WEBHOOK_URL=http://localhost:5678/webhook
```

### 3. Запуск с Docker

```bash
# Сборка и запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f
```

### 4. Инициализация базы данных

База данных автоматически инициализируется при первом запуске. Если нужно пересоздать:

```bash
docker-compose down -v
docker-compose up -d
```

### 5. Доступ к приложению

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **n8n**: http://localhost:5678 (admin/secure-password)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 🏗 Разработка

### Установка зависимостей

```bash
# Установка всех зависимостей
npm run install:all

# Или по отдельности
npm install
cd frontend && npm install
cd backend && npm install
```

### Запуск в режиме разработки

```bash
# Запуск всех сервисов
npm run dev

# Или по отдельности
npm run dev:frontend  # Frontend на порту 3000
npm run dev:backend   # Backend на порту 3001
```

### Структура проекта

```
legal-ai-service/
├── frontend/                 # React приложение
│   ├── src/
│   │   ├── components/      # React компоненты
│   │   ├── pages/          # Страницы приложения
│   │   ├── contexts/       # React контексты
│   │   ├── services/       # API сервисы
│   │   └── utils/          # Утилиты
│   ├── public/             # Статические файлы
│   └── package.json
├── backend/                 # Node.js API
│   ├── src/
│   │   ├── routes/         # API маршруты
│   │   ├── services/       # Бизнес-логика
│   │   ├── middleware/     # Express middleware
│   │   ├── database/       # База данных
│   │   └── utils/          # Утилиты
│   └── package.json
├── database/               # SQL скрипты
│   └── init.sql
├── nginx/                  # Nginx конфигурация
│   └── nginx.conf
├── docker-compose.yml      # Docker конфигурация
├── package.json           # Корневой package.json
└── README.md
```

## 🔧 Конфигурация

### Настройка OpenAI

1. Получите API ключ на [platform.openai.com](https://platform.openai.com)
2. Добавьте ключ в `.env` файл
3. Выберите модель (рекомендуется `gpt-4-turbo-preview`)

### Настройка AWS S3

1. Создайте S3 bucket
2. Создайте IAM пользователя с правами на S3
3. Добавьте ключи в `.env` файл

### Настройка n8n

1. Откройте http://localhost:5678
2. Войдите с учетными данными из `.env`
3. Создайте workflows для автоматизации

## 📊 API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `POST /api/auth/logout` - Выход
- `POST /api/auth/refresh` - Обновление токена

### Запросы
- `GET /api/queries` - Получение запросов
- `POST /api/queries/text` - Создание текстового запроса
- `POST /api/queries/voice` - Создание голосового запроса
- `POST /api/queries/files` - Создание запроса с файлами

### Ответы
- `GET /api/responses/:queryId` - Получение ответа
- `POST /api/responses/:queryId/rate` - Оценка ответа
- `GET /api/responses/stats/overview` - Статистика

### Пользователи
- `GET /api/users/profile` - Профиль пользователя
- `PUT /api/users/profile` - Обновление профиля
- `GET /api/users/stats` - Статистика пользователя

## 🔒 Безопасность

### JWT токены
- Токены имеют ограниченное время жизни
- Автоматическое обновление токенов
- Безопасное хранение в localStorage

### Валидация файлов
- Проверка MIME типов
- Ограничение размера файлов
- Антивирусное сканирование (опционально)

### Rate Limiting
- Ограничение запросов к API
- Защита от DDoS атак
- Настраиваемые лимиты

## 🚀 Деплой

### Продакшен

1. Настройте SSL сертификаты
2. Обновите переменные окружения
3. Настройте мониторинг
4. Запустите с продакшен конфигурацией

```bash
# Продакшен сборка
docker-compose -f docker-compose.prod.yml up -d
```

### CI/CD

Проект готов для интеграции с:
- GitHub Actions
- GitLab CI
- Jenkins
- Docker Hub

## 📈 Мониторинг

### Логи
- Winston логирование
- Структурированные логи
- Ротация логов

### Метрики
- Health checks
- Performance мониторинг
- Error tracking

### Алерты
- Telegram уведомления
- Email уведомления
- Slack интеграция

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch
3. Внесите изменения
4. Добавьте тесты
5. Создайте Pull Request

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🆘 Поддержка

- **Документация**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

## 🙏 Благодарности

- OpenAI за предоставление API
- Сообщество open source
- Все контрибьюторы проекта

---

**LegalAI** - современное решение для юридических консультаций с использованием AI технологий.

