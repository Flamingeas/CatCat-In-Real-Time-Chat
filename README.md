# CatCat

Application de communication temps réel développée en **Rust** (backend) et **Next.js** (frontend), avec une application desktop via **Tauri**.
C'est une application de communication similaire à un système de chat collaboratif (type Discord).

---

# Sommaire

- [Présentation](#présentation)
- [Stack technique](#stack-technique)
- [Fonctionnalités](#fonctionnalités)
- [Backend](#backend)
  - [Architecture](#architecture)
  - [Structure](#structure-backend)
  - [API REST](#api-rest)
  - [Système WebSocket](#système-websocket)
  - [Modèle de données](#modèle-de-données)
  - [Gestion des erreurs & Validation](#gestion-des-erreurs--validation)
  - [Tests & Couverture](#tests--couverture)
  - [Lancer le backend](#lancer-le-backend)
- [Frontend](#frontend)
  - [Structure](#structure-frontend)
  - [Lancer le frontend](#lancer-le-frontend)
  - [Application desktop (Tauri)](#application-desktop-tauri)
- [Déploiement](#déploiement)
  - [Docker (local)](#docker-local)
  - [CI/CD — GitHub Actions](#cicd--github-actions)
  - [Render](#render)
- [Améliorations futures](#améliorations-futures)

---

# Présentation

CatCat est une application de chat collaborative complète. L'objectif est de fournir une architecture **modulaire, scalable et testable** pour une communication temps réel.

Le système permet notamment :

* inscription et authentification d'utilisateurs
* création de serveurs et gestion de membres
* création de channels et messagerie temps réel
* messages directs entre utilisateurs
* modération (kick, ban permanent / temporaire)
* réactions emoji et support des GIFs
* gestion de présence des utilisateurs
* internationalisation FR / EN

---

# Stack technique

### Backend
* **Rust** / **Actix Web 4** / **Actix Actors**
* **SQLx** / **PostgreSQL** — données structurées
* **MongoDB** — messages et messages directs
* **JWT** / **bcrypt** — authentification
* **Serde** / **Validator** / **UUID**
* **utoipa** + **Swagger UI** — documentation OpenAPI
* **Tarpaulin** — couverture de code

### Frontend
* **Next.js** (App Router) / **TypeScript** / **React**
* **Tailwind CSS**
* **next-intl** — internationalisation FR / EN
* **Tauri v2** — application desktop native

---

# Fonctionnalités

| Domaine | Fonctionnalités |
|---|---|
| Authentification | Inscription, connexion, JWT, middleware |
| Utilisateurs | Profil, modification, suppression, pagination |
| Serveurs | CRUD, code d'invitation, rôles (owner / admin / member) |
| Modération | Kick, ban permanent, ban temporaire, unban |
| Channels | CRUD dans un serveur |
| Messages | Envoi, édition, suppression, réactions emoji, GIFs |
| Messages directs | Conversations privées, CRUD messages |
| Temps réel | WebSocket — présence, messages, modération, typing… |
| Interface | Thème sombre/clair, notifications, i18n FR/EN |
| Desktop | Application native Windows / Linux via Tauri |

---

# Backend

## Architecture

```
Client
 │
 ├── API REST (Actix Web :8080)
 │       ├── Routes
 │       ├── Services  (logique métier, permissions)
 │       └── Repositories
 │               ├── PostgreSQL  (users, servers, channels, membres, bans)
 │               └── MongoDB     (messages, messages directs)
 │
 └── Gateway WebSocket (/ws)
         ├── WsSession  (connexion client, heartbeat)
         ├── WsServer   (acteur central, rooms)
         └── WsHub      (suivi de présence)
```

---

## Structure (backend)

```
server/src/
├── config/         database.rs, env.rs, state.rs
├── models/         user, server, server_member, server_ban,
│                   channel, message, message_reactions, direct_message
├── modules/
│   ├── auth/       middleware.rs, route.rs, service.rs
│   ├── user/       repository.rs, route.rs, service.rs
│   ├── server/     repository.rs, route.rs, service.rs
│   ├── channel/    repository.rs, route.rs, service.rs
│   ├── message/    repository.rs, route.rs, service.rs
│   └── direct_message/
├── utils/          jwt.rs, errors.rs
├── websocket/      hub.rs, server.rs, session.rs, routes.rs
└── main.rs
```

---

## API REST

Toutes les routes `/api` nécessitent `Authorization: Bearer <token>`.
La documentation Swagger est disponible sur `http://localhost:8080/swagger-ui/`.

```
# Auth
POST   /auth/signup
POST   /auth/login

# Utilisateurs
GET|PUT|DELETE  /api/users/me
GET             /api/users
GET             /api/users/{id}

# Serveurs
POST|GET        /api/servers
PUT|DELETE      /api/servers/{id}
POST            /api/servers/join
DELETE          /api/servers/{id}/leave
POST            /api/servers/{id}/transfer-owner

# Membres & Modération
GET             /api/servers/{id}/members
PATCH           /api/servers/{id}/members/{user_id}/role
DELETE          /api/servers/{id}/members/{user_id}           (kick)
POST            /api/servers/{id}/bans/{user_id}              (ban permanent)
POST            /api/servers/{id}/bans-temporary/{user_id}    (ban temporaire)
DELETE          /api/servers/{id}/bans/{user_id}              (unban)
GET             /api/servers/{id}/bans

# Channels
POST|GET        /api/servers/{id}/channels
PUT|DELETE      /api/channels/{id}

# Messages
POST|GET        /api/channels/{channel_id}/messages
PUT|DELETE      /api/messages/{id}
POST|DELETE     /api/messages/{id}/reactions

# Messages directs
POST|GET        /api/dm/conversations
GET|POST        /api/dm/conversations/{id}/messages
PUT|DELETE      /api/dm/messages/{id}
```

---

## Système WebSocket

Connexion : `ws://localhost:8080/ws?token=<jwt>`

Événements diffusés :

* utilisateur connecté / déconnecté (présence)
* message envoyé / modifié / supprimé
* réaction ajoutée / retirée
* message direct envoyé / modifié / supprimé
* utilisateur en train d'écrire
* membre rejoint / quitté / expulsé / banni / débanni
* rôle d'un membre modifié
* serveur modifié / supprimé

---

## Modèle de données

### PostgreSQL
| Entité | Champs principaux |
|---|---|
| User | id, username, email, password_hash |
| Server | id, name, owner_id, invitation_code |
| ServerMember | server_id, user_id, role |
| ServerBan | server_id, user_id, reason, created_at, expires_at |
| Channel | id, name, server_id |

### MongoDB
| Collection | Champs principaux |
|---|---|
| messages | _id, content, user_id, channel_id, created_at, reactions |
| conversations | _id, participants[], created_at |
| direct_messages | _id, content, sender_id, conversation_id, created_at |

---

## Gestion des erreurs & Validation

Les erreurs retournent un JSON structuré :

```json
{ "code": "VALIDATION_ERROR", "message": "..." }
```

Les entrées sont validées avec **validator** : format email, longueur username / mot de passe / message (max 2000), longueur emoji (max 10).

---

## Tests & Couverture

```bash
cd server
cargo test

# Couverture
cargo tarpaulin --engine llvm --out Html
```

Les tests couvrent les modèles, les routes, les services et le hub WebSocket.

---

## Lancer le backend

```bash
cd server
cargo build
cargo run
```

Variables d'environnement :

| Variable | Description |
|---|---|
| `DATABASE_URL` | URL PostgreSQL |
| `MONGODB_URI` | URI MongoDB |
| `MONGODB_DB_NAME` | Nom de la base MongoDB |
| `JWT_SECRET` | Clé secrète JWT |
| `SERVER_HOST` | Hôte d'écoute (défaut : `0.0.0.0`) |
| `SERVER_PORT` | Port (défaut : `8080`) |
| `CORS_ORIGINS` | Origines autorisées (virgule-séparées) |

---

# Frontend

## Structure (frontend)

```
client/
├── src/
│   ├── app/            Pages Next.js (App Router), traductions FR/EN
│   ├── components/     Composants UI (chat, modals, GIF picker…)
│   ├── features/       Services et logique métier
│   ├── hooks/          Hooks React (auth, channels, messages, DMs…)
│   ├── lib/            WebSocket provider, client API
│   └── utils/
└── src-tauri/          Configuration et code natif Tauri
```

---

## Lancer le frontend

```bash
cd client
npm install
npm run dev
```

---

## Application desktop (Tauri)

L'application desktop **CatCat** (v1.0.0) est construite avec **Tauri v2**. Elle embarque le frontend Next.js dans une fenêtre native avec support des notifications système.

Lancer en développement :

```bash
cd client
npm run tauri dev
```

Compiler :

```bash
cd client
npm run tauri build
```

Les binaires sont générés dans `client/src-tauri/target/release/bundle/` :
* Linux : `.AppImage` / `.deb`
* Windows : `.exe` / `.msi`

---

# Déploiement

## Docker (local)

Seul prérequis : **Docker** (avec Docker Compose). Aucune configuration n'est nécessaire, PostgreSQL et MongoDB sont lancés en local par le compose.

```bash
docker compose up --build
```

Pour utiliser une base MongoDB externe (ex. Atlas) à la place, définir `MONGODB_URI` et `MONGODB_DB_NAME` dans un fichier `.env` à la racine.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui/ |

---

## CI/CD — GitHub Actions

Le pipeline est défini dans `.github/workflows/ci.yml` et s'exécute sur un runner **self-hosted**.

### Jobs et déclencheurs

| Job | Déclencheur | Description |
|---|---|---|
| `backend` | Tous les pushs / PRs | Format, Clippy, tests, couverture Tarpaulin, build release |
| `frontend` | Tous les pushs / PRs | Lint ESLint, build Next.js |
| `docker` | Tous les pushs / PRs | Build images backend + frontend, push sur **GHCR** |
| `desktop` | Tag `v*` uniquement | Build application Tauri Linux (`.deb`), upload artifact |
| `deploy` | Tag `v*` uniquement | Déploiement automatique sur **Render** via deploy hooks |

### Flux de déploiement sur release

```
git tag v1.x.x && git push --tags
        │
        ├── backend  ──┐
        └── frontend ──┤──> docker (push :latest sur GHCR) ──> deploy (Render)
                       │
                       └──> desktop (build .deb)
```

Les images Docker sont publiées sur le **GitHub Container Registry** (`ghcr.io`) :
* tag court (SHA) sur chaque push
* tag de version + `:latest` sur les tags `v*`

---

## Render

Le déploiement sur Render est déclenché **automatiquement** lors d'un push de tag `v*` via des deploy hooks (secrets `RENDER_BACKEND_DEPLOY_HOOK_URL` et `RENDER_FRONTEND_DEPLOY_HOOK_URL`).

Les services Render récupèrent les images `:latest` publiées sur GHCR par le job `docker`.

| Service | URL de production |
|---|---|
| Backend API | `https://catcat-backend.onrender.com` |
| WebSocket | `wss://catcat-backend.onrender.com/ws` |

---

# Améliorations futures

* pièces jointes (fichiers, images)
* rate limiting
* refresh token
* monitoring
* scaling WebSocket

---

Projet réalisé à des fins éducatives — Epitech T-DEV-600 Promo 236 [2028].
