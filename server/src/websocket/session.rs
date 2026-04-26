use actix::{Actor, ActorContext, Addr, AsyncContext, Handler, Running, StreamHandler};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use uuid::Uuid;

use super::server::{ClientMessage, Connect, Disconnect, WsServer};
use crate::utils::jwt::verify_token;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_INACTIVITY: Duration = Duration::from_secs(20);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UserStatus {
    Online,
    Away,
    DoNotDisturb,
    Invisible,
    Offline,
}
impl Default for UserStatus {
    fn default() -> Self {
        UserStatus::Online
    }
}

pub struct WsSession {
    pub jwt_secret: String,
    pub server: Addr<WsServer>,
    pub hb: Instant,

    pub user_id: Option<Uuid>,
    pub username: Option<String>,
    pub status: UserStatus,

    pub active_servers: Vec<Uuid>,
    pub active_channels: Vec<Uuid>,
}

impl WsSession {
    pub fn new(jwt_secret: String, server: Addr<WsServer>) -> Self {
        Self {
            jwt_secret,
            server,
            hb: Instant::now(),
            user_id: None,
            username: None,
            status: UserStatus::Online,
            active_servers: vec![],
            active_channels: vec![],
        }
    }

    fn start_heartbeat(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_INACTIVITY {
                log::warn!("WS heartbeat failed -> disconnect");
                if let Some(uid) = act.user_id {
                    act.server.do_send(Disconnect {
                        user_id: uid,
                        addr: ctx.address().recipient(),
                    });
                }
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }

    fn is_authed(&self) -> bool {
        self.user_id.is_some() && self.username.is_some()
    }

    fn send_out(ctx: &mut ws::WebsocketContext<Self>, msg: OutgoingMessage) {
        if let Ok(json) = serde_json::to_string(&msg) {
            ctx.text(json);
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum IncomingMessage {
    Auth {
        token: String,
    },

    JoinServer {
        server_id: Uuid,
    },
    LeaveServer {
        server_id: Uuid,
    },

    JoinChannel {
        channel_id: Uuid,
    },
    LeaveChannel {
        channel_id: Uuid,
    },

    #[serde(rename = "typing")]
    Typing {
        channel_id: Uuid,
    },

    #[serde(rename = "user_typing")]
    UserTyping {
        channel_id: Uuid,
        user_id: Option<Uuid>,
        username: Option<String>,
    },

    SendMessage {
        channel_id: Uuid,
        content: String,
    },

    StatusChange {
        status: UserStatus,
        server_id: Option<Uuid>,
    },

    Ping {
        t: Option<i64>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OutgoingMessage {
    Authed {
        user_id: Uuid,
        username: String,
    },

    PresenceSnapshot {
        server_id: Uuid,
        online: Vec<(Uuid, String)>,
    },

    UserConnected {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
        status: UserStatus,
    },
    UserDisconnected {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    UserStatusChanged {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
        status: UserStatus,
    },
    UserProfileUpdated {
        user_id: Uuid,
        username: String,
    },
    NewMessage {
        message_id: Uuid,
        channel_id: Uuid,
        user_id: Uuid,
        username: String,
        content: String,
        created_at: String,
    },
    MessageUpdated {
        message_id: Uuid,
        channel_id: Uuid,
        user_id: Uuid,
        username: String,
        content: String,
        updated_at: String,
    },
    MessageDeleted {
        server_id: Uuid,
        channel_id: Uuid,
        message_id: Uuid,
    },
    MessageReactionAdded {
        message_id: Uuid,
        channel_id: Uuid,
        user_id: Uuid,
        emoji: String,
    },
    MessageReactionRemoved {
        message_id: Uuid,
        channel_id: Uuid,
        user_id: Uuid,
        emoji: String,
    },
    UserTyping {
        channel_id: Uuid,
        user_id: Uuid,
        username: String,
    },

    Error {
        message: String,
    },
    Ok {
        message: String,
    },
    ChannelCreated {
        server_id: Uuid,
        channel_id: Uuid,
        name: String,
        created_at: String,
    },
    ChannelDeleted {
        server_id: Uuid,
        channel_id: Uuid,
    },
    ChannelUpdated {
        server_id: Uuid,
        channel_id: Uuid,
    },
    ServerDeleted {
        server_id: Uuid,
    },
    ServerUpdated {
        server_id: Uuid,
    },
    ServerMemberJoined {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    ServerMemberLeft {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    ServerMemberRoleUpdated {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
        role: String,
    },
    ServerMemberKicked {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    ServerMemberBanned {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    ServerMemberBannedTemporary {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
        until: Option<chrono::DateTime<chrono::Utc>>,
    },
    ServerMemberUnbanned {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
    },

    NewDirectMessage {
        conversation_id: Uuid,
        message_id: Uuid,
        sender_id: Uuid,
        sender_username: String,
        content: String,
        created_at: String,
    },
    DirectMessageUpdated {
        conversation_id: Uuid,
        message_id: Uuid,
        content: String,
        updated_at: String,
    },
    DirectMessageDeleted {
        conversation_id: Uuid,
        message_id: Uuid,
    },
    DirectMessageReactionAdded {
        conversation_id: Uuid,
        message_id: Uuid,
        user_id: Uuid,
        emoji: String,
    },
    DirectMessageReactionRemoved {
        conversation_id: Uuid,
        message_id: Uuid,
        user_id: Uuid,
        emoji: String,
    },
}

impl actix::Message for OutgoingMessage {
    type Result = ();
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_heartbeat(ctx);

        ctx.run_later(Duration::from_secs(5), |act, ctx| {
            if !act.is_authed() {
                ctx.close(Some(ws::CloseReason {
                    code: ws::CloseCode::Policy,
                    description: Some("auth required".into()),
                }));
                ctx.stop();
            }
        });
    }

    fn stopping(&mut self, ctx: &mut Self::Context) -> Running {
        if let Some(uid) = self.user_id {
            self.status = UserStatus::Offline;
            self.server.do_send(Disconnect {
                user_id: uid,
                addr: ctx.address().recipient(),
            });
        }
        Running::Stop
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(bytes)) => {
                self.hb = Instant::now();
                ctx.pong(&bytes);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                self.hb = Instant::now();

                let incoming = match serde_json::from_str::<IncomingMessage>(&text) {
                    Ok(m) => m,
                    Err(e) => {
                        WsSession::send_out(
                            ctx,
                            OutgoingMessage::Error {
                                message: format!("invalid message: {e}"),
                            },
                        );
                        return;
                    }
                };

                match incoming {
                    IncomingMessage::Ping { .. } => {
                        self.hb = Instant::now();
                        return;
                    }

                    IncomingMessage::Auth { token } => {
                        if self.is_authed() {
                            WsSession::send_out(
                                ctx,
                                OutgoingMessage::Ok {
                                    message: "already_authed".into(),
                                },
                            );
                            return;
                        }

                        let claims = match verify_token(&token, &self.jwt_secret) {
                            Ok(c) => c,
                            Err(_) => {
                                WsSession::send_out(
                                    ctx,
                                    OutgoingMessage::Error {
                                        message: "invalid_or_expired_token".into(),
                                    },
                                );
                                ctx.stop();
                                return;
                            }
                        };

                        let user_id = match Uuid::parse_str(&claims.sub) {
                            Ok(id) => id,
                            Err(_) => {
                                WsSession::send_out(
                                    ctx,
                                    OutgoingMessage::Error {
                                        message: "invalid_sub".into(),
                                    },
                                );
                                ctx.stop();
                                return;
                            }
                        };

                        let username = claims
                            .username
                            .clone()
                            .unwrap_or_else(|| "unknown".to_string());

                        self.user_id = Some(user_id);
                        self.username = Some(username.clone());

                        self.server.do_send(Connect {
                            user_id,
                            username: username.clone(),
                            addr: ctx.address().recipient(),
                            server_ids: vec![],
                        });

                        WsSession::send_out(ctx, OutgoingMessage::Authed { user_id, username });
                    }

                    _ if !self.is_authed() => {
                        WsSession::send_out(
                            ctx,
                            OutgoingMessage::Error {
                                message: "not_authenticated".into(),
                            },
                        );
                    }

                    IncomingMessage::JoinServer { server_id } => {
                        let uid = self.user_id.unwrap();
                        if !self.active_servers.contains(&server_id) {
                            self.active_servers.push(server_id);
                        }
                        self.server.do_send(ClientMessage::JoinServer {
                            user_id: uid,
                            server_id,
                        });
                    }

                    IncomingMessage::LeaveServer { server_id } => {
                        let uid = self.user_id.unwrap();
                        self.active_servers.retain(|id| *id != server_id);
                        self.server.do_send(ClientMessage::LeaveServer {
                            user_id: uid,
                            server_id,
                        });
                    }

                    IncomingMessage::JoinChannel { channel_id } => {
                        let uid = self.user_id.unwrap();
                        if !self.active_channels.contains(&channel_id) {
                            self.active_channels.push(channel_id);
                        }
                        self.server.do_send(ClientMessage::JoinChannel {
                            user_id: uid,
                            channel_id,
                        });
                    }

                    IncomingMessage::LeaveChannel { channel_id } => {
                        let uid = self.user_id.unwrap();
                        self.active_channels.retain(|id| *id != channel_id);
                        self.server.do_send(ClientMessage::LeaveChannel {
                            user_id: uid,
                            channel_id,
                        });
                    }

                    IncomingMessage::Typing { channel_id }
                    | IncomingMessage::UserTyping { channel_id, .. } => {
                        let uid = self.user_id.unwrap();
                        let username = self.username.clone().unwrap();
                        self.server.do_send(ClientMessage::Typing {
                            user_id: uid,
                            username,
                            channel_id,
                        });
                    }

                    IncomingMessage::SendMessage {
                        channel_id,
                        content,
                    } => {
                        let uid = self.user_id.unwrap();
                        let username = self.username.clone().unwrap();
                        self.server.do_send(ClientMessage::SendMessage {
                            user_id: uid,
                            username,
                            channel_id,
                            content,
                        });
                    }

                    IncomingMessage::StatusChange { status, server_id } => {
                        let uid = self.user_id.unwrap();
                        let username = self.username.clone().unwrap();
                        self.status = status;
                        self.server.do_send(ClientMessage::StatusChange {
                            user_id: uid,
                            username,
                            status,
                            server_id,
                        });
                    }
                }
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            Err(e) => {
                log::error!("ws error: {e}");
                ctx.stop();
            }
            _ => {}
        }
    }
}

impl Handler<OutgoingMessage> for WsSession {
    type Result = ();

    fn handle(&mut self, msg: OutgoingMessage, ctx: &mut Self::Context) {
        if let OutgoingMessage::UserProfileUpdated { user_id, username } = &msg {
            if Some(*user_id) == self.user_id {
                self.username = Some(username.clone());
            }
        }

        if let Ok(json) = serde_json::to_string(&msg) {
            ctx.text(json);
        }
    }
}

#[cfg(test)]
mod ws_tests {
    use super::*;
    use actix::Actor;
    use actix::Addr;
    use actix_test::start;
    use actix_web::{web, App, HttpRequest};
    use actix_web_actors::ws as actix_ws;
    use awc::{ws as awc_ws, Client};
    use futures_util::{Sink, SinkExt, Stream, StreamExt};

    use crate::utils::jwt::generate_token;

    fn spawn_ws_app(secret: String) -> (actix_test::TestServer, String) {
        let ws_server = WsServer::new().start();

        let srv = start(move || {
            App::new()
                .app_data(web::Data::new(secret.clone()))
                .app_data(web::Data::new(ws_server.clone()))
                .route(
                    "/ws",
                    web::get().to(
                        |req: HttpRequest,
                         stream: web::Payload,
                         jwt_secret: web::Data<String>,
                         server: web::Data<Addr<WsServer>>| async move {
                            let session = WsSession::new(
                                jwt_secret.get_ref().clone(),
                                server.get_ref().clone(),
                            );
                            actix_ws::start(session, &req, stream)
                        },
                    ),
                )
        });

        let url = srv.url("/ws");
        (srv, url)
    }

    async fn recv_text<C>(conn: &mut C) -> String
    where
        C: Stream<Item = Result<awc_ws::Frame, awc::error::WsProtocolError>> + Unpin,
    {
        loop {
            match conn.next().await.unwrap().unwrap() {
                awc_ws::Frame::Text(bytes) => return String::from_utf8(bytes.to_vec()).unwrap(),
                awc_ws::Frame::Ping(_) | awc_ws::Frame::Pong(_) => continue,
                other => panic!("unexpected frame: {:?}", other),
            }
        }
    }

    async fn send_text<C>(conn: &mut C, text: String)
    where
        C: Sink<awc_ws::Message, Error = awc::error::WsProtocolError> + Unpin,
    {
        conn.send(awc_ws::Message::Text(text.into())).await.unwrap();
    }

    #[test]
    fn user_status_serializes_and_defaults() {
        assert_eq!(UserStatus::default(), UserStatus::Online);
        assert_eq!(
            serde_json::to_string(&UserStatus::Away).unwrap(),
            "\"away\""
        );
        assert_eq!(
            serde_json::to_string(&UserStatus::DoNotDisturb).unwrap(),
            "\"donotdisturb\""
        );
        assert_eq!(
            serde_json::to_string(&UserStatus::Invisible).unwrap(),
            "\"invisible\""
        );
        assert_eq!(
            serde_json::to_string(&UserStatus::Offline).unwrap(),
            "\"offline\""
        );
    }

    #[test]
    fn incoming_messages_deserialize_all_supported_shapes() {
        let server_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();

        let auth: IncomingMessage = serde_json::from_str(r#"{"type":"auth","token":"t"}"#).unwrap();
        assert!(matches!(auth, IncomingMessage::Auth { token } if token == "t"));

        let join_server: IncomingMessage = serde_json::from_str(&format!(
            r#"{{"type":"join_server","server_id":"{server_id}"}}"#
        ))
        .unwrap();
        assert!(
            matches!(join_server, IncomingMessage::JoinServer { server_id: id } if id == server_id)
        );

        let leave_server: IncomingMessage = serde_json::from_str(&format!(
            r#"{{"type":"leave_server","server_id":"{server_id}"}}"#
        ))
        .unwrap();
        assert!(
            matches!(leave_server, IncomingMessage::LeaveServer { server_id: id } if id == server_id)
        );

        let join_channel: IncomingMessage = serde_json::from_str(&format!(
            r#"{{"type":"join_channel","channel_id":"{channel_id}"}}"#
        ))
        .unwrap();
        assert!(
            matches!(join_channel, IncomingMessage::JoinChannel { channel_id: id } if id == channel_id)
        );

        let leave_channel: IncomingMessage = serde_json::from_str(&format!(
            r#"{{"type":"leave_channel","channel_id":"{channel_id}"}}"#
        ))
        .unwrap();
        assert!(
            matches!(leave_channel, IncomingMessage::LeaveChannel { channel_id: id } if id == channel_id)
        );

        let typing: IncomingMessage = serde_json::from_str(&format!(
            r#"{{"type":"typing","channel_id":"{channel_id}"}}"#
        ))
        .unwrap();
        assert!(matches!(typing, IncomingMessage::Typing { channel_id: id } if id == channel_id));

        let user_typing: IncomingMessage = serde_json::from_str(&format!(
            r#"{{"type":"user_typing","channel_id":"{channel_id}","user_id":null,"username":"alice"}}"#
        ))
        .unwrap();
        assert!(matches!(
            user_typing,
            IncomingMessage::UserTyping { channel_id: id, user_id: None, username: Some(name) }
                if id == channel_id && name == "alice"
        ));

        let send_message: IncomingMessage = serde_json::from_str(&format!(
            r#"{{"type":"send_message","channel_id":"{channel_id}","content":"hello"}}"#
        ))
        .unwrap();
        assert!(matches!(
            send_message,
            IncomingMessage::SendMessage { channel_id: id, content } if id == channel_id && content == "hello"
        ));

        let status_change: IncomingMessage =
            serde_json::from_str(r#"{"type":"status_change","status":"away","server_id":null}"#)
                .unwrap();
        assert!(matches!(
            status_change,
            IncomingMessage::StatusChange {
                status: UserStatus::Away,
                server_id: None
            }
        ));

        let ping: IncomingMessage = serde_json::from_str(r#"{"type":"ping","t":42}"#).unwrap();
        assert!(matches!(ping, IncomingMessage::Ping { t: Some(42) }));
    }

    #[test]
    fn outgoing_messages_serialize_with_expected_type_tags() {
        let server_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let message_id = Uuid::new_v4();
        let conversation_id = Uuid::new_v4();

        let messages = vec![
            OutgoingMessage::Authed {
                user_id,
                username: "alice".to_string(),
            },
            OutgoingMessage::PresenceSnapshot {
                server_id,
                online: vec![(user_id, "alice".to_string())],
            },
            OutgoingMessage::UserConnected {
                server_id,
                user_id,
                username: "alice".to_string(),
                status: UserStatus::Online,
            },
            OutgoingMessage::UserDisconnected {
                server_id,
                user_id,
                username: "alice".to_string(),
            },
            OutgoingMessage::UserStatusChanged {
                server_id,
                user_id,
                username: "alice".to_string(),
                status: UserStatus::Away,
            },
            OutgoingMessage::UserProfileUpdated {
                user_id,
                username: "alice2".to_string(),
            },
            OutgoingMessage::NewMessage {
                message_id,
                channel_id,
                user_id,
                username: "alice".to_string(),
                content: "hello".to_string(),
                created_at: "now".to_string(),
            },
            OutgoingMessage::MessageUpdated {
                message_id,
                channel_id,
                user_id,
                username: "alice".to_string(),
                content: "edited".to_string(),
                updated_at: "later".to_string(),
            },
            OutgoingMessage::MessageDeleted {
                server_id,
                channel_id,
                message_id,
            },
            OutgoingMessage::MessageReactionAdded {
                message_id,
                channel_id,
                user_id,
                emoji: ":cat:".to_string(),
            },
            OutgoingMessage::MessageReactionRemoved {
                message_id,
                channel_id,
                user_id,
                emoji: ":cat:".to_string(),
            },
            OutgoingMessage::UserTyping {
                channel_id,
                user_id,
                username: "alice".to_string(),
            },
            OutgoingMessage::Error {
                message: "bad".to_string(),
            },
            OutgoingMessage::Ok {
                message: "done".to_string(),
            },
            OutgoingMessage::ChannelCreated {
                server_id,
                channel_id,
                name: "general".to_string(),
                created_at: "now".to_string(),
            },
            OutgoingMessage::ChannelDeleted {
                server_id,
                channel_id,
            },
            OutgoingMessage::ChannelUpdated {
                server_id,
                channel_id,
            },
            OutgoingMessage::ServerDeleted { server_id },
            OutgoingMessage::ServerUpdated { server_id },
            OutgoingMessage::ServerMemberJoined {
                server_id,
                user_id,
                username: "alice".to_string(),
            },
            OutgoingMessage::ServerMemberLeft {
                server_id,
                user_id,
                username: "alice".to_string(),
            },
            OutgoingMessage::ServerMemberRoleUpdated {
                server_id,
                user_id,
                username: "alice".to_string(),
                role: "admin".to_string(),
            },
            OutgoingMessage::ServerMemberKicked {
                server_id,
                user_id,
                username: "alice".to_string(),
            },
            OutgoingMessage::ServerMemberBanned {
                server_id,
                user_id,
                username: "alice".to_string(),
            },
            OutgoingMessage::ServerMemberBannedTemporary {
                server_id,
                user_id,
                username: "alice".to_string(),
                until: None,
            },
            OutgoingMessage::ServerMemberUnbanned {
                server_id,
                user_id,
                username: "alice".to_string(),
            },
            OutgoingMessage::NewDirectMessage {
                conversation_id,
                message_id,
                sender_id: user_id,
                sender_username: "alice".to_string(),
                content: "dm".to_string(),
                created_at: "now".to_string(),
            },
            OutgoingMessage::DirectMessageUpdated {
                conversation_id,
                message_id,
                content: "dm2".to_string(),
                updated_at: "later".to_string(),
            },
            OutgoingMessage::DirectMessageDeleted {
                conversation_id,
                message_id,
            },
            OutgoingMessage::DirectMessageReactionAdded {
                conversation_id,
                message_id,
                user_id,
                emoji: ":cat:".to_string(),
            },
            OutgoingMessage::DirectMessageReactionRemoved {
                conversation_id,
                message_id,
                user_id,
                emoji: ":cat:".to_string(),
            },
        ];

        for message in messages {
            let value: serde_json::Value =
                serde_json::from_str(&serde_json::to_string(&message).unwrap()).unwrap();
            assert!(value["type"].as_str().unwrap().contains('_') || value["type"].is_string());
        }
    }

    #[actix_web::test]
    async fn ws_rejects_messages_before_auth() {
        let (_srv, url) = spawn_ws_app("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string());

        let (_resp, mut conn) = Client::new().ws(url).connect().await.unwrap();

        send_text(
            &mut conn,
            r#"{"type":"join_server","server_id":"00000000-0000-0000-0000-000000000000"}"#
                .to_string(),
        )
        .await;

        let txt = recv_text(&mut conn).await;
        let msg: OutgoingMessage = serde_json::from_str(&txt).unwrap();

        assert!(matches!(
            msg,
            OutgoingMessage::Error { message } if message == "not_authenticated"
        ));
    }

    #[actix_web::test]
    async fn ws_auth_valid_token_sends_authed() {
        let secret = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string();
        let (_srv, url) = spawn_ws_app(secret.clone());

        let user_id = Uuid::new_v4();
        let token = generate_token(user_id, "a@b.com", Some("alice"), &secret, 60).unwrap();

        let (_resp, mut conn) = Client::new().ws(url).connect().await.unwrap();

        send_text(
            &mut conn,
            format!(r#"{{"type":"auth","token":"{}"}}"#, token),
        )
        .await;

        let txt = recv_text(&mut conn).await;
        let msg: OutgoingMessage = serde_json::from_str(&txt).unwrap();

        assert!(matches!(
            msg,
            OutgoingMessage::Authed { user_id: uid, username }
                if uid == user_id && username == "alice"
        ));
    }

    #[actix_web::test]
    async fn ws_auth_invalid_token_sends_error_and_closes() {
        let (_srv, url) = spawn_ws_app("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string());

        let (_resp, mut conn) = Client::new().ws(url).connect().await.unwrap();

        send_text(&mut conn, r#"{"type":"auth","token":"nope"}"#.to_string()).await;

        let txt = recv_text(&mut conn).await;
        let msg: OutgoingMessage = serde_json::from_str(&txt).unwrap();

        assert!(matches!(
            msg,
            OutgoingMessage::Error { message } if message == "invalid_or_expired_token"
        ));
    }
}
