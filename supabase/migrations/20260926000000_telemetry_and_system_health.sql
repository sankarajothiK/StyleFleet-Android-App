-- ============================================================================
-- Migration: 20260926000000_telemetry_and_system_health.sql
-- StyleFleet Hardware Telemetry & System Health Diagnostics Subsystem
-- ============================================================================

-- 1. Device Hardware Telemetry Table
CREATE TABLE IF NOT EXISTS public.telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    platform TEXT NOT NULL, -- 'android', 'ios', 'web'
    os_name TEXT,
    os_version TEXT,
    app_version TEXT,
    battery_level NUMERIC(5,2),
    is_charging BOOLEAN,
    network_type TEXT,
    screen_resolution TEXT,
    memory_usage JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. System Health Status Table
CREATE TABLE IF NOT EXISTS public.system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    component TEXT NOT NULL, -- 'mobile_app', 'database', 'auth_service', 'storage', 'sync_engine'
    status TEXT NOT NULL DEFAULT 'healthy', -- 'healthy', 'degraded', 'unreachable', 'critical'
    latency_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    details JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Application System Logs & Error Tracking Table
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    level TEXT NOT NULL DEFAULT 'error', -- 'info', 'warn', 'error', 'fatal'
    tag TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    device_id TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_telemetry_shop_recorded ON public.telemetry(shop_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_device ON public.telemetry(device_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON public.telemetry(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_component ON public.system_health(component, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_shop ON public.system_health(shop_id);
CREATE INDEX IF NOT EXISTS idx_system_health_timestamp ON public.system_health(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_level_time ON public.system_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_shop ON public.system_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_tag ON public.system_logs(tag);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Allow telemetry insertion from authenticated users and anonymous bootstrap clients
CREATE POLICY "Allow telemetry insert" ON public.telemetry
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow telemetry select for shop members" ON public.telemetry
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        shop_id IS NULL OR
        shop_id IN (
            SELECT shop_id FROM public.shop_members 
            WHERE profile_id = auth.uid() AND is_active = true
        )
    );

-- Allow system health insert from clients and background services
CREATE POLICY "Allow system_health insert" ON public.system_health
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow system_health select for shop members" ON public.system_health
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        shop_id IS NULL OR
        shop_id IN (
            SELECT shop_id FROM public.shop_members 
            WHERE profile_id = auth.uid() AND is_active = true
        )
    );

-- Allow system logs insert for error reporting
CREATE POLICY "Allow system_logs insert" ON public.system_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow system_logs select for shop members" ON public.system_logs
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        shop_id IS NULL OR
        shop_id IN (
            SELECT shop_id FROM public.shop_members 
            WHERE profile_id = auth.uid() AND is_active = true
        )
    );
