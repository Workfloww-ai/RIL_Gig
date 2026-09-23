-- Create enum for tracking session status
CREATE TYPE tracking_session_status AS ENUM (
    'scheduled',
    'active',
    'arrived',
    'completed',
    'cancelled',
    'expired'
);

-- job_tracking_sessions
CREATE TABLE job_tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    scheduled_start_time TIMESTAMPTZ,
    tracking_start_time TIMESTAMPTZ,
    tracking_end_time TIMESTAMPTZ,

    status tracking_session_status DEFAULT 'scheduled',

    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    last_location_at TIMESTAMPTZ,

    current_eta_seconds INTEGER,
    current_distance_meters INTEGER,
    current_eta_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_job_tracking_sessions_job ON job_tracking_sessions(job_id);
CREATE INDEX idx_job_tracking_sessions_worker ON job_tracking_sessions(worker_id);
CREATE INDEX idx_job_tracking_sessions_status ON job_tracking_sessions(status);

-- worker_current_locations
CREATE TABLE worker_current_locations (
    worker_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(job_id) ON DELETE SET NULL,

    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    accuracy DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,

    recorded_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_worker_current_locations_job ON worker_current_locations(job_id);

-- worker_location_history
CREATE TABLE worker_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(job_id) ON DELETE SET NULL,

    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    accuracy DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,

    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_worker_location_history_worker ON worker_location_history(worker_id);
CREATE INDEX idx_worker_location_history_recorded_at ON worker_location_history(recorded_at);

-- tracking_events
CREATE TABLE tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    event_type TEXT NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,

    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    metadata JSONB,

    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tracking_events_job ON tracking_events(job_id);
CREATE INDEX idx_tracking_events_worker ON tracking_events(worker_id);
CREATE INDEX idx_tracking_events_time ON tracking_events(event_time);

-- Enable RLS for all tables (can configure policies later as needed)
ALTER TABLE job_tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_current_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
