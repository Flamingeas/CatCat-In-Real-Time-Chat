use actix::{Actor, ActorContext, Addr, AsyncContext, Handler, Running, StreamHandler};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use uuid::Uuid;

use crate::utils::jwt::verify_token;
use super::server::{ClientMessage, Connect, Disconnect, WsServer};

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
    Auth { token: String },

    JoinServer { server_id: Uuid },
    LeaveServer { server_id: Uuid },

    JoinChannel { channel_id: Uuid },
    LeaveChannel { channel_id: Uuid },

    #[serde(rename = "typing")]
    Typing { channel_id: Uuid },

    #[serde(rename = "user_typing")]
    UserTyping {
        channel_id: Uuid,
        user_id: Option<Uuid>,
        username: Option<String>,
    },

    SendMessage { channel_id: Uuid, content: String },

    StatusChange { status: UserStatus, server_id: Option<Uuid> },

    Ping { t: Option<i64> },
}

#[derive(Serialize, Clone, Debug, actix::Message)]
#[rtype(result = "()")]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OutgoingMessage {
    Authed { user_id: Uuid, username: String },

    PresenceSnapshot { server_id: Uuid, online: Vec<(Uuid, String)> },

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
    NewMessage {
        message_id: Uuid,
        channel_id: Uuid,
        user_id: Uuid,
        username: String,
        content: String,
        created_at: String,
    },
    MessageDeleted {
        server_id: Uuid,
        channel_id: Uuid,
        message_id: Uuid,
    },
    UserTyping {
        channel_id: Uuid,
        user_id: Uuid,
        username: String,
    },

    Error { message: String },
    Ok { message: String },
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
    ServerDeleted { server_id: Uuid },
    ServerUpdated { server_id: Uuid },
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
    ServerMemberUnbanned {
        server_id: Uuid,
        user_id: Uuid,
        username: String,
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
                            WsSession::send_out(ctx, OutgoingMessage::Ok { message: "already_authed".into() });
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

                        let username = claims.username.clone().unwrap_or_else(|| "unknown".to_string());

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
                        self.server.do_send(ClientMessage::JoinServer { user_id: uid, server_id });
                    }

                    IncomingMessage::LeaveServer { server_id } => {
                        let uid = self.user_id.unwrap();
                        self.active_servers.retain(|id| *id != server_id);
                        self.server.do_send(ClientMessage::LeaveServer { user_id: uid, server_id });
                    }

                    IncomingMessage::JoinChannel { channel_id } => {
                        let uid = self.user_id.unwrap();
                        if !self.active_channels.contains(&channel_id) {
                            self.active_channels.push(channel_id);
                        }
                        self.server.do_send(ClientMessage::JoinChannel { user_id: uid, channel_id });
                    }

                    IncomingMessage::LeaveChannel { channel_id } => {
                        let uid = self.user_id.unwrap();
                        self.active_channels.retain(|id| *id != channel_id);
                        self.server.do_send(ClientMessage::LeaveChannel { user_id: uid, channel_id });
                    }

                    IncomingMessage::Typing { channel_id } | IncomingMessage::UserTyping { channel_id, .. } => {
                        let uid = self.user_id.unwrap();
                        let username = self.username.clone().unwrap();
                        self.server.do_send(ClientMessage::Typing { user_id: uid, username, channel_id });
                    }

                    IncomingMessage::SendMessage { channel_id, content } => {
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
                            let session = WsSession::new(jwt_secret.get_ref().clone(), server.get_ref().clone());
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

    #[actix_web::test]
    async fn ws_rejects_messages_before_auth() {
        let (_srv, url) = spawn_ws_app("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string());

        let (_resp, mut conn) = Client::new().ws(url).connect().await.unwrap();

        send_text(
            &mut conn,
            r#"{"type":"join_server","server_id":"00000000-0000-0000-0000-000000000000"}"#.to_string(),
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

        send_text(&mut conn, format!(r#"{{"type":"auth","token":"{}"}}"#, token)).await;

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
