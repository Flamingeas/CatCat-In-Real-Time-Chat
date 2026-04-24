DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.server_bans CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;
DROP TABLE IF EXISTS public.server_members CASCADE;
DROP TABLE IF EXISTS public.servers CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TABLE public.users (
                              id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
                              username text NOT NULL,
                              email text NOT NULL,
                              password_hash text NOT NULL,
                              created_at timestamp with time zone DEFAULT now() NOT NULL,
                              updated_at timestamp with time zone DEFAULT now() NOT NULL,
                              CONSTRAINT users_pkey PRIMARY KEY (id),
                              CONSTRAINT users_email_unique UNIQUE (email),
                              CONSTRAINT users_username_unique UNIQUE (username)
);

CREATE TABLE public.servers (
                                id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
                                name text NOT NULL,
                                owner_id uuid NOT NULL,
                                created_at timestamp with time zone DEFAULT now() NOT NULL,
                                invitation_code text NOT NULL,
                                updated_at timestamp with time zone DEFAULT now() NOT NULL,
                                CONSTRAINT servers_pkey PRIMARY KEY (id),
                                CONSTRAINT servers_invitation_code_unique UNIQUE (invitation_code),
                                CONSTRAINT servers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE TABLE public.channels (
                                 id uuid DEFAULT public.gen_random_uuid() NOT NULL,
                                 name text NOT NULL,
                                 server_id uuid NOT NULL,
                                 created_at timestamp with time zone DEFAULT now() NOT NULL,
                                 updated_at timestamp with time zone DEFAULT now() NOT NULL,
                                 CONSTRAINT channels_pkey PRIMARY KEY (id),
                                 CONSTRAINT channels_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE
);

CREATE TABLE public.server_members (
                                       server_id uuid NOT NULL,
                                       user_id uuid NOT NULL,
                                       role text DEFAULT 'member'::text NOT NULL,
                                       joined_at timestamp with time zone DEFAULT now() NOT NULL,
                                       CONSTRAINT server_members_pkey PRIMARY KEY (server_id, user_id),
                                       CONSTRAINT server_members_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE,
                                       CONSTRAINT server_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE TABLE public.server_bans (
                                    server_id uuid NOT NULL,
                                    user_id uuid NOT NULL,
                                    banned_by uuid NOT NULL,
                                    created_at timestamp without time zone DEFAULT now() NOT NULL,
                                    expires_at timestamp without time zone,
                                    reason text,
                                    CONSTRAINT server_bans_pkey PRIMARY KEY (server_id, user_id),
                                    CONSTRAINT server_bans_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE,
                                    CONSTRAINT server_bans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
                                    CONSTRAINT server_bans_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.users(id)
);

CREATE TABLE public.conversations (
                                      id uuid DEFAULT public.gen_random_uuid() NOT NULL,
                                      user1_id uuid NOT NULL,
                                      user2_id uuid NOT NULL,
                                      created_at timestamp with time zone DEFAULT now() NOT NULL,
                                      CONSTRAINT conversations_pkey PRIMARY KEY (id),
                                      CONSTRAINT conversations_user_order CHECK (user1_id < user2_id),
                                      CONSTRAINT conversations_user1_id_user2_id_key UNIQUE (user1_id, user2_id),
                                      CONSTRAINT conversations_user1_id_fkey FOREIGN KEY (user1_id) REFERENCES public.users(id) ON DELETE CASCADE,
                                      CONSTRAINT conversations_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_channels_server_id ON public.channels(server_id);
CREATE INDEX idx_server_members_server ON public.server_members(server_id);
CREATE INDEX idx_server_members_user ON public.server_members(user_id);
CREATE INDEX idx_conversations_user1 ON public.conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON public.conversations(user2_id);

CREATE UNIQUE INDEX uniq_channels_name_per_server
    ON public.channels(server_id, lower(name));

DROP TRIGGER IF EXISTS trg_channels_updated_at ON public.channels;
CREATE TRIGGER trg_channels_updated_at
    BEFORE UPDATE ON public.channels
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_servers_updated_at ON public.servers;
CREATE TRIGGER trg_servers_updated_at
    BEFORE UPDATE ON public.servers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();