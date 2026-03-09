# RTC Backend

Backend de communication temps réel développé en **Rust** avec **Actix Web**, **WebSockets**, **PostgreSQL** et **JWT**.

Ce projet constitue le backend complet d'une application de communication similaire à un système de chat collaboratif (type Discord). Il combine :

* une **API REST** pour la gestion des ressources
* un **gateway WebSocket** pour les événements temps réel

Le système permet notamment :

* l'authentification des utilisateurs
* la gestion de serveurs et de membres
* la création de channels
* l'envoi de messages
* la diffusion d'événements temps réel

---

# Sommaire

1. Présentation du projet
2. Fonctionnalités principales
3. Architecture
4. Structure du projet
5. Authentification
6. Module Utilisateurs
7. Module Serveurs
8. Module Channels
9. Module Messages
10. Système WebSocket
11. Modèle de données
12. Gestion des erreurs
13. Validation
14. Tests
15. Couverture de code
16. Lancer le projet
17. Améliorations futures
18. Stack technique

---

# Présentation du projet

L'objectif de ce backend est de fournir une architecture **modulaire, scalable et testable** pour une application de communication temps réel.

Le système permet notamment :

* inscription et authentification d'utilisateurs
* gestion de profils
* création de serveurs
* gestion de membres
* création de channels
* messagerie temps réel
* gestion de présence des utilisateurs

L'architecture est basée sur une séparation claire des responsabilités :

```
Routes (HTTP)
      ↓
Services (Logique métier)
      ↓
Repositories (Accès base de données)
      ↓
Base de données
```

Les communications temps réel sont gérées via **WebSockets avec Actix Actors**.

---

# Fonctionnalités principales

## Authentification

* Inscription utilisateur
* Connexion utilisateur
* Hash du mot de passe avec **bcrypt**
* Génération de token **JWT**
* Vérification de token
* Middleware d'authentification

## Utilisateurs

* récupération du profil utilisateur
* récupération du profil public d'un utilisateur
* liste des utilisateurs avec pagination
* modification du profil
* suppression de compte

## Serveurs

Les serveurs représentent des espaces communautaires.

Fonctionnalités :

* création d'un serveur
* mise à jour du serveur
* suppression d'un serveur
* rejoindre un serveur via code d'invitation
* quitter un serveur
* transfert de propriété
* gestion des membres

Rôles disponibles :

* owner
* admin
* member

## Channels

Les channels sont des espaces de discussion à l'intérieur d'un serveur.

Fonctionnalités :

* création de channel
* liste des channels d'un serveur
* modification de channel
* suppression de channel

## Messages

Gestion des messages dans un channel :

* envoyer un message
* récupérer les messages
* modifier un message
* supprimer un message

Les événements sont également envoyés en **temps réel via WebSocket**.

---

# Architecture

Le projet suit une architecture en couches.

```
Client
 │
 ├── API REST (Actix Web)
 │       ├── Routes
 │       ├── Services
 │       └── Repositories
 │
 └── Gateway WebSocket
         ├── WsSession
         ├── WsServer
         └── événements temps réel
```

## Routes

Responsables de :

* recevoir les requêtes HTTP
* valider les entrées
* retourner les réponses

## Services

Responsables de :

* implémenter la logique métier
* vérifier les permissions
* orchestrer les appels aux repositories

## Repositories

Responsables de :

* exécuter les requêtes SQL
* gérer les transactions

## WebSockets

Responsables de :

* gérer les sessions utilisateurs
* gérer les rooms (serveurs / channels)
* diffuser les événements temps réel

---

# Structure du projet

```
src/

config/
    database.rs
    env.rs

models/
    user.rs
    server.rs
    server_member.rs
    channel.rs
    message.rs

modules/

    auth/
        middleware.rs
        route.rs
        service.rs

    user/
        repository.rs
        route.rs
        service.rs

    server/
        repository.rs
        route.rs
        service.rs

    channel/
        repository.rs
        route.rs
        service.rs

    message/
        repository.rs
        route.rs
        service.rs

utils/
    jwt.rs
    errors.rs

websocket/
    hub.rs
    routes.rs
    server.rs
    session.rs

main.rs
lib.rs
```

---

# Authentification

L'authentification repose sur **JWT**.

Processus :

1. L'utilisateur s'inscrit
2. Le mot de passe est hashé
3. L'utilisateur se connecte
4. Un JWT est généré
5. Les routes protégées utilisent un middleware pour valider le token

Les claims du token incluent :

* user_id
* email
* username
* expiration

Ces informations sont utilisées également par le système WebSocket.

---

# Module Utilisateurs

Endpoints :

```
GET /users/me
PUT /users/me
DELETE /users/me
GET /users
GET /users/{id}
```

Fonctionnalités :

* récupérer son profil
* récupérer le profil public d'un utilisateur
* pagination des utilisateurs
* modification du profil
* suppression du compte

---

# Module Serveurs

Endpoints principaux :

```
POST /servers
GET /servers
PUT /servers/{id}
DELETE /servers/{id}
POST /servers/join
DELETE /servers/{id}/leave
```

Fonctionnalités :

* création de serveur
* génération de code d'invitation
* rejoindre un serveur
* quitter un serveur
* gestion des rôles
* transfert de propriété

---

# Module Channels

Endpoints :

```
POST /servers/{serverId}/channels
GET /servers/{serverId}/channels
PUT /channels/{id}
DELETE /channels/{id}
```

Fonctionnalités :

* création de channel
* liste des channels
* modification
* suppression

---

# Module Messages

Endpoints :

```
POST /channels/{channel_id}/messages
GET /channels/{channel_id}/messages
PUT /messages/{id}
DELETE /messages/{id}
```

Fonctionnalités :

* envoyer un message
* récupérer les messages
* modification
* suppression

Les événements sont également envoyés via WebSocket.

---

# Système WebSocket

Le système WebSocket repose sur **Actix Actors**.

## WsServer

Acteur central responsable de :

* stocker les sessions actives
* gérer les rooms
* diffuser les événements

## WsSession

Représente une connexion client.

Responsabilités :

* authentification via JWT
* gestion du heartbeat
* réception des messages
* envoi des événements

---

# Événements temps réel

Types d'événements :

* utilisateur connecté
* utilisateur déconnecté
* changement de statut
* message envoyé
* message supprimé
* utilisateur en train d'écrire
* membre rejoint serveur
* membre quitté serveur

---

# Modèle de données

Entités principales :

### User

* id
* username
* email
* password_hash

### Server

* id
* name
* owner_id
* invitation_code

### ServerMember

* server_id
* user_id
* role

### Channel

* id
* name
* server_id

### Message

* id
* content
* user_id
* channel_id

Relations :

* un utilisateur peut appartenir à plusieurs serveurs.
* un serveur possède plusieurs channels.
* un channel possède plusieurs messages.

---

# Gestion des erreurs

Le projet utilise des erreurs structurées.

Types d'erreurs :

* NotFound
* Conflict
* Database
* Internal

Les erreurs sont converties en réponses HTTP cohérentes.

---

# Validation

Les entrées sont validées avec **validator**.

Exemples :

* taille username
* taille message
* format email
* longueur mot de passe

---

# Tests

Les tests incluent :

* tests unitaires
* tests services
* tests routes
* tests WebSocket

Les outils utilisés :

* Actix test
* JWT tests
* tests WebSocket

---

# Couverture de code

La couverture est mesurée avec **Tarpaulin**.

Commande :

```bash
cargo tarpaulin --engine llvm --out Html
```

---

# Lancer le projet

Installer les dépendances :

```
cargo build
```

Lancer le serveur :

```
cargo run
```

Lancer les tests :

```
cargo test
```

---

# Stack technique

* Rust
* Actix Web
* Actix Actors
* WebSockets
* SQLx
* PostgreSQL
* JWT
* bcrypt
* Serde
* UUID
* Validator

---

# Améliorations futures

Améliorations possibles :

* édition des messages
* réactions aux messages
* pièces jointes
* rate limiting
* refresh token
* monitoring
* scaling WebSocket

---

# Résumé

Ce projet implémente un backend complet permettant :

* authentification JWT
* gestion des utilisateurs
* gestion de serveurs
* gestion de channels
* messagerie temps réel
* WebSockets
* validation
* gestion d'erreurs
* architecture modulaire

Il constitue une base solide pour une application de communication temps réel ou un projet backend avancé.

---

Projet réalisé à des fins éducatives / portfolio.
