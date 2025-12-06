-- ═══════════════════════════════════════════════════════════════════════════
-- ZENITE USERNAME SYSTEM v3.0 - BULLETPROOF EDITION
-- ═══════════════════════════════════════════════════════════════════════════
-- This script MUST be run in Supabase SQL Editor with service_role privileges
-- It handles all edge cases for user registration with automatic profile creation
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Ensure the profiles table exists with all required columns
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL DEFAULT 'unknown_traveler',
    display_name TEXT DEFAULT 'Unknown Traveler',
    avatar_url TEXT DEFAULT NULL,
    bio TEXT DEFAULT '',
    is_public BOOLEAN DEFAULT FALSE,
    data JSONB DEFAULT '{}'::JSONB,
    username_changed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if table already exists (idempotent migrations)
DO $$
BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT 'unknown_traveler';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT 'Unknown Traveler';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::JSONB;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ DEFAULT NULL;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Some columns may already exist: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Create unique index for case-insensitive username lookups
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop old index if it exists to recreate it properly
DROP INDEX IF EXISTS profiles_username_lower_idx;

-- Create index that allows NULL values (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx 
ON public.profiles (LOWER(username)) 
WHERE username IS NOT NULL AND username != '';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Helper function to generate a unique username
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_unique_username(base_input TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_base TEXT;
    candidate TEXT;
    random_suffix TEXT;
    attempt_count INT := 0;
    max_attempts INT := 50;
BEGIN
    -- Normalize input: lowercase, alphanumeric + underscore only
    clean_base := LOWER(COALESCE(base_input, ''));
    clean_base := REGEXP_REPLACE(clean_base, '[^a-z0-9_]', '', 'g');
    clean_base := LEFT(clean_base, 12); -- Leave room for suffix
    
    -- Fallback if empty or too short
    IF LENGTH(clean_base) < 2 THEN
        clean_base := 'traveler';
    END IF;
    
    -- Try to find a unique username
    LOOP
        EXIT WHEN attempt_count >= max_attempts;
        
        -- Generate random 5-digit suffix
        random_suffix := LPAD(FLOOR(RANDOM() * 99999 + 1)::TEXT, 5, '0');
        candidate := clean_base || '_' || random_suffix;
        
        -- Check if it already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE LOWER(username) = LOWER(candidate)
        ) THEN
            RETURN candidate;
        END IF;
        
        attempt_count := attempt_count + 1;
    END LOOP;
    
    -- Ultimate fallback with epoch timestamp
    RETURN 'user_' || FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT::TEXT;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: THE BULLETPROOF TRIGGER FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════
-- This function is called AFTER a new user is inserted into auth.users
-- It MUST NOT fail, or the entire signup will fail with a 500 error
-- Uses SECURITY DEFINER to bypass RLS during profile creation
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_username TEXT;
    v_display_name TEXT;
    v_avatar_url TEXT;
    v_email_prefix TEXT;
    v_meta JSONB;
BEGIN
    -- Safely extract metadata (may be NULL or empty)
    v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
    
    -- Extract email prefix as fallback
    v_email_prefix := COALESCE(
        SPLIT_PART(COALESCE(NEW.email, ''), '@', 1),
        'traveler'
    );
    
    -- Get username from multiple possible sources
    v_username := COALESCE(
        NULLIF(TRIM(v_meta->>'username'), ''),
        NULLIF(TRIM(v_meta->>'preferred_username'), ''),
        NULLIF(TRIM(v_meta->>'user_name'), ''),
        NULLIF(TRIM(v_meta->>'name'), ''),
        v_email_prefix,
        'traveler'
    );
    
    -- Normalize username: lowercase, only a-z0-9_, max 20 chars
    v_username := LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9_]', '', 'g'));
    v_username := LEFT(v_username, 20);
    
    -- If still invalid, generate a unique one
    IF LENGTH(v_username) < 2 THEN
        v_username := public.generate_unique_username(v_email_prefix);
    END IF;
    
    -- Check for duplicates and generate unique if needed
    IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(v_username)) THEN
        v_username := public.generate_unique_username(v_username);
    END IF;
    
    -- Get display name with fallbacks
    v_display_name := COALESCE(
        NULLIF(TRIM(v_meta->>'display_name'), ''),
        NULLIF(TRIM(v_meta->>'full_name'), ''),
        NULLIF(TRIM(v_meta->>'name'), ''),
        v_username,
        'Unknown Traveler'
    );
    
    -- Get avatar URL from OAuth providers
    v_avatar_url := COALESCE(
        NULLIF(TRIM(v_meta->>'avatar_url'), ''),
        NULLIF(TRIM(v_meta->>'picture'), ''),
        NULL
    );
    
    -- INSERT the profile - this is the critical operation
    INSERT INTO public.profiles (
        id,
        username,
        display_name,
        avatar_url,
        bio,
        is_public,
        data,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        v_username,
        v_display_name,
        v_avatar_url,
        '',
        FALSE,
        '{}'::JSONB,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = COALESCE(NULLIF(profiles.username, ''), EXCLUDED.username),
        display_name = COALESCE(NULLIF(profiles.display_name, ''), EXCLUDED.display_name),
        avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
        updated_at = NOW();
    
    -- Always return NEW to allow the auth.users insert to succeed
    RETURN NEW;

EXCEPTION WHEN unique_violation THEN
    -- Username collision - try again with a generated one
    BEGIN
        INSERT INTO public.profiles (id, username, display_name, created_at, updated_at)
        VALUES (
            NEW.id, 
            public.generate_unique_username(v_username),
            COALESCE(v_display_name, 'Unknown Traveler'),
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[ZENITE] Secondary insert failed for user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;

WHEN OTHERS THEN
    -- Log the error but DO NOT re-raise - this allows signup to succeed
    RAISE WARNING '[ZENITE] handle_new_user failed for user %: % (SQLSTATE: %)', 
        NEW.id, SQLERRM, SQLSTATE;
    
    -- Emergency fallback: try minimal insert
    BEGIN
        INSERT INTO public.profiles (id, username, created_at, updated_at)
        VALUES (
            NEW.id,
            'traveler_' || FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::TEXT,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[ZENITE] Emergency fallback also failed: %', SQLERRM;
    END;
    
    -- CRITICAL: Always return NEW so auth.users insert succeeds
    RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: Create/Replace the trigger
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: Username availability check (for frontend validation)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_username_available(
    check_username TEXT, 
    current_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized TEXT;
    count_existing INT;
BEGIN
    -- Normalize input
    normalized := LOWER(TRIM(COALESCE(check_username, '')));
    
    -- Validate format
    IF LENGTH(normalized) < 2 THEN RETURN FALSE; END IF;
    IF LENGTH(normalized) > 20 THEN RETURN FALSE; END IF;
    IF normalized !~ '^[a-z0-9_]+$' THEN RETURN FALSE; END IF;
    
    -- Check if exists (excluding current user if provided)
    IF current_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO count_existing
        FROM public.profiles
        WHERE LOWER(username) = normalized AND id != current_user_id;
    ELSE
        SELECT COUNT(*) INTO count_existing
        FROM public.profiles
        WHERE LOWER(username) = normalized;
    END IF;
    
    RETURN count_existing = 0;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 7: Username cooldown check
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_username_cooldown_days(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    last_change TIMESTAMPTZ;
    cooldown_end TIMESTAMPTZ;
BEGIN
    SELECT username_changed_at INTO last_change
    FROM public.profiles
    WHERE id = target_user_id;
    
    IF last_change IS NULL THEN RETURN 0; END IF;
    
    cooldown_end := last_change + INTERVAL '14 days';
    
    IF NOW() >= cooldown_end THEN RETURN 0; END IF;
    
    RETURN GREATEST(0, CEIL(EXTRACT(EPOCH FROM (cooldown_end - NOW())) / 86400)::INT);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 8: Username change function (with cooldown)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.change_username(new_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_normalized TEXT;
    v_cooldown INT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    v_normalized := LOWER(TRIM(COALESCE(new_username, '')));
    
    -- Validate
    IF LENGTH(v_normalized) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username too short (min 2 chars)');
    END IF;
    
    IF LENGTH(v_normalized) > 20 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username too long (max 20 chars)');
    END IF;
    
    IF v_normalized !~ '^[a-z0-9_]+$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only letters, numbers, and underscore allowed');
    END IF;
    
    -- Check cooldown
    v_cooldown := public.get_username_cooldown_days(v_user_id);
    IF v_cooldown > 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Wait ' || v_cooldown || ' days to change again',
            'cooldown_days', v_cooldown
        );
    END IF;
    
    -- Check availability
    IF NOT public.check_username_available(v_normalized, v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username unavailable');
    END IF;
    
    -- Update
    UPDATE public.profiles
    SET username = v_normalized,
        username_changed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'username', v_normalized,
        'message', 'Username changed successfully!'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 9: Row Level Security (RLS) Policies
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read public profiles or their own
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT USING (
        id = auth.uid() OR is_public = TRUE
    );

-- Allow users to update only their own profile
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Allow inserts (trigger runs with SECURITY DEFINER so this is mostly for manual inserts)
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid() OR auth.uid() IS NULL);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 10: Grant permissions
-- ═══════════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.generate_unique_username(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_username_cooldown_days(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_username(TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! The system is now bulletproof.
-- ═══════════════════════════════════════════════════════════════════════════
