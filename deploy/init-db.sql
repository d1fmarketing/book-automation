-- Initialize database schema for ebook pipeline

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create tables
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    config JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    UNIQUE(name, topic)
);

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    queue_name VARCHAR(100) NOT NULL,
    job_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    data JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(queue_name, job_id)
);

CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255),
    topic VARCHAR(255) NOT NULL,
    isbn VARCHAR(20),
    language VARCHAR(10) DEFAULT 'en',
    word_count INTEGER,
    chapter_count INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}',
    file_paths JSONB NOT NULL DEFAULT '{}',
    quality_score NUMERIC(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255),
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost NUMERIC(10,6) DEFAULT 0,
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_id VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    size BIGINT,
    location VARCHAR(50) NOT NULL,
    path TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    value NUMERIC,
    labels JSONB NOT NULL DEFAULT '{}',
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_pipelines_status ON pipelines(status);
CREATE INDEX idx_pipelines_created_at ON pipelines(created_at DESC);
CREATE INDEX idx_pipelines_topic ON pipelines(topic);

CREATE INDEX idx_jobs_pipeline_id ON jobs(pipeline_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_queue_job ON jobs(queue_name, job_id);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

CREATE INDEX idx_books_pipeline_id ON books(pipeline_id);
CREATE INDEX idx_books_topic ON books(topic);
CREATE INDEX idx_books_created_at ON books(created_at DESC);
CREATE INDEX idx_books_title_trgm ON books USING gin(title gin_trgm_ops);

CREATE INDEX idx_api_usage_service ON api_usage(service);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at DESC);
CREATE INDEX idx_api_usage_pipeline_id ON api_usage(pipeline_id);

CREATE INDEX idx_backups_type ON backups(type);
CREATE INDEX idx_backups_created_at ON backups(created_at DESC);

CREATE INDEX idx_metrics_name ON metrics(metric_name);
CREATE INDEX idx_metrics_created_at ON metrics(created_at DESC);
CREATE INDEX idx_metrics_pipeline_id ON metrics(pipeline_id);

-- Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pipelines_updated_at BEFORE UPDATE ON pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views
CREATE OR REPLACE VIEW pipeline_summary AS
SELECT 
    p.id,
    p.name,
    p.topic,
    p.status,
    p.created_at,
    p.completed_at,
    COUNT(DISTINCT j.id) as total_jobs,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'completed') as completed_jobs,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'failed') as failed_jobs,
    MAX(b.quality_score) as book_quality,
    SUM(au.cost) as total_cost
FROM pipelines p
LEFT JOIN jobs j ON j.pipeline_id = p.id
LEFT JOIN books b ON b.pipeline_id = p.id
LEFT JOIN api_usage au ON au.pipeline_id = p.id
GROUP BY p.id;

CREATE OR REPLACE VIEW daily_metrics AS
SELECT 
    DATE(created_at) as date,
    COUNT(DISTINCT pipeline_id) as pipelines_run,
    COUNT(*) as jobs_processed,
    COUNT(*) FILTER (WHERE status = 'completed') as jobs_completed,
    COUNT(*) FILTER (WHERE status = 'failed') as jobs_failed,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_job_duration_seconds
FROM jobs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Insert default data
INSERT INTO pipelines (name, topic, status, config) VALUES
    ('demo', 'Demo Pipeline', 'completed', '{"stages": ["research", "write", "format", "qa"]}')
ON CONFLICT (name, topic) DO NOTHING;