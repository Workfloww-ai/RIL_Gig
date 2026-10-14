-- 001_notification_system.sql
-- Enterprise Event-Driven Notification System Migration

-- Ensure auth schema, roles, and helper functions exist in any standard Postgres environment
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    SELECT NULL::uuid;
$$ LANGUAGE sql STABLE;

-- 1. In-App Notifications Storage
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(company_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications(user_id, read, created_at DESC);

-- 2. User Notification Channel Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    deadline_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    post_completion_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    streak_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure users table has email_unsubscribed and unsubscribed_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email_unsubscribed') THEN
        ALTER TABLE public.users ADD COLUMN email_unsubscribed BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='unsubscribed_at') THEN
        ALTER TABLE public.users ADD COLUMN unsubscribed_at TIMESTAMPTZ;
    END IF;
END $$;

-- 3. Global Platform Notification System Settings (Developer Governance)
CREATE TABLE IF NOT EXISTS public.global_notification_settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'global_default',
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    deadline_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    post_completion_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    streak_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start VARCHAR(5) NOT NULL DEFAULT '22:00',
    quiet_hours_end VARCHAR(5) NOT NULL DEFAULT '08:00',
    max_daily_per_user INTEGER NOT NULL DEFAULT 10,
    updated_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.global_notification_settings (id)
VALUES ('global_default')
ON CONFLICT (id) DO NOTHING;

-- 4. Notification Templates & Immutable Versions
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type VARCHAR(64) NOT NULL,
    channel VARCHAR(16) NOT NULL DEFAULT 'ALL', -- ALL, IN_APP, PUSH, EMAIL
    variation_index INTEGER NOT NULL DEFAULT 0,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    cta_label VARCHAR(64),
    cta_url TEXT,
    language VARCHAR(8) NOT NULL DEFAULT 'en',
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(notification_type, channel, variation_index)
);
CREATE INDEX IF NOT EXISTS idx_templates_content_hash ON public.notification_templates(content_hash);

CREATE TABLE IF NOT EXISTS public.notification_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.notification_templates(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    notification_type VARCHAR(64) NOT NULL,
    channel VARCHAR(16) NOT NULL,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    cta_label VARCHAR(64),
    cta_url TEXT,
    content_hash VARCHAR(64) NOT NULL,
    published_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(template_id, version_number)
);

-- 5. Workflows (Automation Engine) & Immutable Versions
CREATE TABLE IF NOT EXISTS public.notification_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(company_id) ON DELETE CASCADE,
    title VARCHAR(128) NOT NULL,
    description TEXT,
    trigger_lifecycle VARCHAR(64) NOT NULL, -- e.g. MODULE_ASSIGNED, ASSESSMENT_COMPLETED, DAILY_STREAK_CHECK
    category VARCHAR(64) NOT NULL DEFAULT 'CUSTOM',
    notification_type VARCHAR(64) NOT NULL,
    filter_rules JSONB DEFAULT '[]'::jsonb, -- e.g. [{"field": "score", "operator": "<", "value": "70"}]
    filter_match_type VARCHAR(8) NOT NULL DEFAULT 'ALL', -- ALL or ANY
    channels TEXT[] NOT NULL DEFAULT ARRAY['IN_APP', 'PUSH']::text[],
    delivery_policy VARCHAR(24) NOT NULL DEFAULT 'PARALLEL', -- PARALLEL or ORDERED_FALLBACK
    cooldown_seconds INTEGER NOT NULL DEFAULT 3600,
    pinned_template_id UUID REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    pinned_template_version_id UUID REFERENCES public.notification_template_versions(id) ON DELETE SET NULL,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    content_fingerprint VARCHAR(64),
    version_number INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON public.notification_workflows(trigger_lifecycle, is_active);

CREATE TABLE IF NOT EXISTS public.notification_workflow_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.notification_workflows(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    trigger_lifecycle VARCHAR NOT NULL,
    category VARCHAR NOT NULL,
    filter_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    filter_match_type VARCHAR NOT NULL DEFAULT 'ALL',
    notification_type VARCHAR NOT NULL,
    channels TEXT[] NOT NULL DEFAULT ARRAY['IN_APP', 'PUSH']::text[],
    delivery_policy VARCHAR NOT NULL DEFAULT 'PARALLEL',
    pinned_template_id UUID,
    pinned_template_version_id UUID,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    content_fingerprint VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workflow_id, version_number)
);

-- 6. Notification Queue & Deliveries
CREATE TABLE IF NOT EXISTS public.notification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    assignment_id UUID,
    notification_type VARCHAR(64) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    retry_count INTEGER NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_pending ON public.notification_jobs(status, scheduled_at) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_job_id UUID REFERENCES public.notification_jobs(id) ON DELETE CASCADE,
    company_id UUID,
    user_id UUID NOT NULL,
    channel VARCHAR(16) NOT NULL, -- IN_APP, PUSH, EMAIL
    status VARCHAR(16) NOT NULL, -- SENT, FAILED, SUPPRESSED
    blocked_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Row Level Security (RLS) Policies
ALTER TABLE public.notification_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent conflicts on rerun
DROP POLICY IF EXISTS "users_read_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "rls_notification_workflows_read" ON public.notification_workflows;
DROP POLICY IF EXISTS "rls_notification_workflows_service_manage" ON public.notification_workflows;
DROP POLICY IF EXISTS "users_read_own_preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "users_update_own_preferences" ON public.notification_preferences;

-- Notifications: user can view/update own notifications
CREATE POLICY "users_read_own_notifications" ON public.notifications
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_update_own_notifications" ON public.notifications
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Preferences: user can view/update own preferences
CREATE POLICY "users_read_own_preferences" ON public.notification_preferences
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_update_own_preferences" ON public.notification_preferences
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workflows: authenticated can view, only service_role can modify
CREATE POLICY "rls_notification_workflows_read" ON public.notification_workflows
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "rls_notification_workflows_service_manage" ON public.notification_workflows
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. High-Performance Postgres RPCs

-- RPC 1: Deterministic Batch Job Scheduler with Stable Idempotency Keys
CREATE OR REPLACE FUNCTION schedule_bulk_notification_jobs_rpc(
    p_user_ids UUID[],
    p_notification_type VARCHAR,
    p_metadata JSONB,
    p_assignment_id UUID DEFAULT NULL,
    p_scheduled_at TIMESTAMPTZ DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_scheduled_at TIMESTAMPTZ;
    v_inserted_count INTEGER := 0;
    v_entity_id VARCHAR;
    v_default_company_id UUID;
BEGIN
    v_scheduled_at := COALESCE(p_scheduled_at, NOW());
    v_entity_id := COALESCE(
        p_metadata->>'task_id',
        p_metadata->>'sprint_id',
        p_metadata->>'scenario_id',
        p_metadata->>'module_id',
        p_metadata->>'entity_id',
        p_assignment_id::text,
        'bulk'
    );

    SELECT company_id INTO v_default_company_id FROM public.companies LIMIT 1;

    WITH inserted AS (
        INSERT INTO public.notification_jobs (
            company_id,
            user_id,
            assignment_id,
            notification_type,
            scheduled_at,
            idempotency_key,
            metadata
        )
        SELECT
            COALESCE(u.company_id, v_default_company_id),
            u.user_id,
            p_assignment_id,
            p_notification_type,
            v_scheduled_at,
            u.user_id::text || ':' || p_notification_type || ':' || v_entity_id,
            p_metadata
        FROM public.users u
        WHERE u.user_id = ANY(p_user_ids)
          AND (u.is_active IS NOT FALSE)
          AND COALESCE(u.company_id, v_default_company_id) IS NOT NULL
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
    )
    SELECT COUNT(*) INTO v_inserted_count FROM inserted;

    RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 2: Consolidated Recipient Context Aggregator (Single Roundtrip)
CREATE OR REPLACE FUNCTION get_notification_recipient_context_rpc(
    p_user_id UUID,
    p_company_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
    v_company_name TEXT := 'Your Company';
    v_streak_days INTEGER := 0;
    v_progress_pct NUMERIC := 0;
    v_result JSONB;
BEGIN
    SELECT user_id, email, COALESCE(name, first_name) as name, company_id, email_unsubscribed
    INTO v_user
    FROM public.users
    WHERE user_id = p_user_id;

    IF v_user IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;

    -- Company lookup
    SELECT name INTO v_company_name
    FROM public.companies
    WHERE company_id = COALESCE(p_company_id, v_user.company_id)
    LIMIT 1;

    -- Aggregate metrics and activity if learner_metrics table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='learner_metrics') THEN
        SELECT COALESCE(current_streak, 0) INTO v_streak_days
        FROM public.learner_metrics
        WHERE user_id = p_user_id
        LIMIT 1;
    END IF;

    -- Assemble unified dictionary with canonical namespaces
    v_result := jsonb_build_object(
        'subscriber.first_name', split_part(COALESCE(v_user.name, 'Learner'), ' ', 1),
        'subscriber.full_name', COALESCE(v_user.name, 'Learner'),
        'subscriber.email', COALESCE(v_user.email, ''),
        'subscriber.company_name', COALESCE(v_company_name, 'Your Company'),
        'subscriber.email_unsubscribed', COALESCE(v_user.email_unsubscribed, FALSE),
        'gamification.streak_days', COALESCE(v_streak_days, 0),
        'curriculum.progress_percentage', v_progress_pct
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
