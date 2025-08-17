-- Включение расширения pgvector для семантического поиска
CREATE EXTENSION IF NOT EXISTS vector;

-- Таблица пользователей
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица запросов
CREATE TABLE queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    audio_path TEXT, -- S3 путь к аудио файлу
    files_path TEXT[], -- S3 пути к загруженным файлам
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица ответов
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID REFERENCES queries(id) ON DELETE CASCADE,
    ai_response JSONB NOT NULL, -- {text, laws, recommendations, confidence}
    is_published BOOLEAN DEFAULT FALSE,
    seo_article TEXT, -- сгенерированный HTML для SEO
    rating INT CHECK (rating BETWEEN 1 AND 5),
    embedding vector(1536), -- векторное представление для семантического поиска
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица тегов для категоризации
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Связь запросов с тегами (many-to-many)
CREATE TABLE query_tags (
    query_id UUID REFERENCES queries(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (query_id, tag_id)
);

-- Таблица для хранения обработанных файлов
CREATE TABLE processed_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID REFERENCES queries(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    s3_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    extracted_text TEXT,
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица для логов действий
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_queries_user_id ON queries(user_id);
CREATE INDEX idx_queries_status ON queries(status);
CREATE INDEX idx_queries_created_at ON queries(created_at);
CREATE INDEX idx_responses_query_id ON responses(query_id);
CREATE INDEX idx_responses_published ON responses(is_published);
CREATE INDEX idx_responses_rating ON responses(rating);
CREATE INDEX idx_ai_response ON responses USING GIN (ai_response);
CREATE INDEX idx_responses_embedding ON responses USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_processed_files_query_id ON processed_files(query_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- Вставка базовых тегов
INSERT INTO tags (name, description, color) VALUES
('Наследство', 'Вопросы наследования имущества', '#EF4444'),
('ДТП', 'Дорожно-транспортные происшествия', '#F59E0B'),
('Трудовые споры', 'Споры с работодателем', '#10B981'),
('Недвижимость', 'Вопросы недвижимости', '#8B5CF6'),
('Семейное право', 'Брак, развод, алименты', '#EC4899'),
('Уголовное право', 'Уголовные дела', '#6B7280'),
('Гражданское право', 'Гражданские споры', '#3B82F6'),
('Административное право', 'Споры с госорганами', '#84CC16');

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_queries_updated_at BEFORE UPDATE ON queries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_responses_updated_at BEFORE UPDATE ON responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция для поиска похожих запросов
CREATE OR REPLACE FUNCTION find_similar_queries(query_embedding vector(1536), similarity_threshold float DEFAULT 0.8)
RETURNS TABLE (
    query_id UUID,
    text TEXT,
    similarity float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.query_id,
        q.text,
        1 - (r.embedding <=> query_embedding) as similarity
    FROM responses r
    JOIN queries q ON r.query_id = q.id
    WHERE 1 - (r.embedding <=> query_embedding) > similarity_threshold
    ORDER BY r.embedding <=> query_embedding;
END;
$$ LANGUAGE plpgsql;

