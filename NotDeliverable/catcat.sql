--
-- PostgreSQL database dump
--

\restrict 4p7Ej1QP210VO2dmpti7Zo7RNo5WA5eSaDeMmk5Sh84cGgaGhdVR3m17CLVw52N

-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: catcat; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE catcat WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


ALTER DATABASE catcat OWNER TO postgres;

\unrestrict 4p7Ej1QP210VO2dmpti7Zo7RNo5WA5eSaDeMmk5Sh84cGgaGhdVR3m17CLVw52N
\connect catcat
\restrict 4p7Ej1QP210VO2dmpti7Zo7RNo5WA5eSaDeMmk5Sh84cGgaGhdVR3m17CLVw52N

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _sqlx_test; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA _sqlx_test;


ALTER SCHEMA _sqlx_test OWNER TO postgres;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: database_ids; Type: SEQUENCE; Schema: _sqlx_test; Owner: postgres
--

CREATE SEQUENCE _sqlx_test.database_ids
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE _sqlx_test.database_ids OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: databases; Type: TABLE; Schema: _sqlx_test; Owner: postgres
--

CREATE TABLE _sqlx_test.databases (
    db_name text NOT NULL,
    test_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE _sqlx_test.databases OWNER TO postgres;

--
-- Name: channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.channels (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    name text NOT NULL,
    server_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.channels OWNER TO postgres;

--
-- Name: server_bans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.server_bans (
    server_id uuid NOT NULL,
    user_id uuid NOT NULL,
    banned_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone,
    reason text
);


ALTER TABLE public.server_bans OWNER TO postgres;

--
-- Name: server_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.server_members (
    server_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.server_members OWNER TO postgres;

--
-- Name: servers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invitation_code text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.servers OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    user1_id uuid NOT NULL,
    user2_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_user_order CHECK (user1_id < user2_id)
);

--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
    CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: databases databases_pkey; Type: CONSTRAINT; Schema: _sqlx_test; Owner: postgres
--

ALTER TABLE ONLY _sqlx_test.databases
    ADD CONSTRAINT databases_pkey PRIMARY KEY (db_name);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_user1_id_user2_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user1_id_user2_id_key UNIQUE (user1_id, user2_id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: server_bans server_bans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_bans
    ADD CONSTRAINT server_bans_pkey PRIMARY KEY (server_id, user_id);


--
-- Name: server_members server_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_pkey PRIMARY KEY (server_id, user_id);


--
-- Name: servers servers_invitation_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_invitation_code_unique UNIQUE (invitation_code);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: databases_created_at; Type: INDEX; Schema: _sqlx_test; Owner: postgres
--

CREATE INDEX databases_created_at ON _sqlx_test.databases USING btree (created_at);


--
-- Name: idx_conversations_user1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_user1 ON public.conversations USING btree (user1_id);


--
-- Name: idx_conversations_user2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_user2 ON public.conversations USING btree (user2_id);


--
-- Name: idx_channels_server_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_channels_server_id ON public.channels USING btree (server_id);


--
-- Name: idx_server_members_server; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_server_members_server ON public.server_members USING btree (server_id);


--
-- Name: idx_server_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_server_members_user ON public.server_members USING btree (user_id);


--
-- Name: uniq_channels_name_per_server; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_channels_name_per_server ON public.channels USING btree (server_id, lower(name));


--
-- Name: channels trg_channels_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: servers trg_servers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_servers_updated_at BEFORE UPDATE ON public.servers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: conversations conversations_user1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user1_id_fkey FOREIGN KEY (user1_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: channels channels_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_bans server_bans_banned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_bans
    ADD CONSTRAINT server_bans_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.users(id);


--
-- Name: server_bans server_bans_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_bans
    ADD CONSTRAINT server_bans_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_bans server_bans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_bans
    ADD CONSTRAINT server_bans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: server_members server_members_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_members server_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_members
    ADD CONSTRAINT server_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: servers servers_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 4p7Ej1QP210VO2dmpti7Zo7RNo5WA5eSaDeMmk5Sh84cGgaGhdVR3m17CLVw52N

