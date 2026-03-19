use actix::{Actor, Context, Handler, Message, Recipient};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use super::session::{OutgoingMessage, UserStatus};

#[derive(Message)]
#[rtype(result = "()")]
pub struct Connect {
    pub user_id: Uuid,
    pub username: String,
    pub addr: Recipient<OutgoingMessage>,
    pub server_ids: Vec<Uuid>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub user_id: Uuid,
    pub addr: Recipient<OutgoingMessage>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub enum ClientMessage {
    JoinServer { user_id: Uuid, server_id: Uuid },
    LeaveServer { user_id: Uuid, server_id: Uuid },

    ChannelCreated {
        server_id: Uuid,
        channel_id: Uuid,
        name: String,
        created_at: String,
    },
    JoinChannel { user_id: Uuid, channel_id: Uuid },
    LeaveChannel { user_id: Uuid, channel_id: Uuid },
    ChannelDeleted { server_id: Uuid, channel_id: Uuid },
    ChannelUpdated { server_id: Uuid, channel_id: Uuid },
    Typing { user_id: Uuid, username: String, channel_id: Uuid },

    SendMessage { user_id: Uuid, username: String, channel_id: Uuid, content: String },

    BroadcastNewMessage {
        server_id: Uuid,
        channel_id: Uuid,
        message_id: Uuid,
        user_id: Uuid,
        username: String,
        content: String,
        created_at: String,
    },

    BroadcastMessageDeleted {
        server_id: Uuid,
        channel_id: Uuid,
        message_id: Uuid,
    },

    StatusChange { user_id: Uuid, username: String, status: UserStatus, server_id: Option<Uuid> },
}

#[derive(Message)]
#[rtype(result = "()")]
pub enum ServerEvent {
    ServerDeleted { server_id: Uuid },
    ServerUpdated { server_id: Uuid },
    MemberJoined { server_id: Uuid, user_id: Uuid, username: String },
    MemberLeft { server_id: Uuid, user_id: Uuid, username: String },
    MemberRoleUpdated { server_id: Uuid, user_id: Uuid, username: String, role: String },
    MemberKicked { server_id: Uuid, user_id: Uuid, username: String },
    MemberBanned { server_id: Uuid, user_id: Uuid, username: String },
    MemberUnbanned { server_id: Uuid, user_id: Uuid, username: String }
}

pub struct WsServer {
    sessions: HashMap<Uuid, HashSet<Recipient<OutgoingMessage>>>,
    usernames: HashMap<Uuid, String>,

    server_rooms: HashMap<Uuid, HashSet<Uuid>>,
    channel_rooms: HashMap<Uuid, HashSet<Uuid>>,
}

impl WsServer {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            usernames: HashMap::new(),
            server_rooms: HashMap::new(),
            channel_rooms: HashMap::new(),
        }
    }

    fn send_to(&self, user_id: Uuid, msg: OutgoingMessage) {
        if let Some(addrs) = self.sessions.get(&user_id) {
            for addr in addrs {
                let _ = addr.do_send(msg.clone());
            }
        }
    }

    fn broadcast_to_server_except(&self, server_id: Uuid, except_user_id: Uuid, msg: OutgoingMessage) {
        if let Some(members) = self.server_rooms.get(&server_id) {
            for uid in members {
                if *uid == except_user_id {
                    continue;
                }
                self.send_to(*uid, msg.clone());
            }
        }
    }

    fn broadcast_to_channel(&self, channel_id: Uuid, msg: OutgoingMessage) {
        if let Some(members) = self.channel_rooms.get(&channel_id) {
            for uid in members {
                self.send_to(*uid, msg.clone());
            }
        }
    }

    fn broadcast_to_server(&self, server_id: Uuid, msg: OutgoingMessage) {
        if let Some(members) = self.server_rooms.get(&server_id) {
            for uid in members {
                self.send_to(*uid, msg.clone());
            }
        }
    }

    fn username_of(&self, user_id: Uuid) -> String {
        self.usernames
            .get(&user_id)
            .cloned()
            .unwrap_or_else(|| "unknown".into())
    }
}

impl Actor for WsServer {
    type Context = Context<Self>;
}

impl Handler<Connect> for WsServer {
    type Result = ();

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) {
        self.sessions.entry(msg.user_id).or_default().insert(msg.addr);
        self.usernames.insert(msg.user_id, msg.username.clone());

        for server_id in msg.server_ids {
            self.server_rooms.entry(server_id).or_default().insert(msg.user_id);
        }

        self.send_to(
            msg.user_id,
            OutgoingMessage::Authed {
                user_id: msg.user_id,
                username: msg.username,
            },
        );
    }
}

impl Handler<Disconnect> for WsServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        let mut removed_last_session = false;

        if let Some(set) = self.sessions.get_mut(&msg.user_id) {
            set.remove(&msg.addr);
            if set.is_empty() {
                self.sessions.remove(&msg.user_id);
                removed_last_session = true;
            }
        }

        if removed_last_session {
            let username = self.usernames.get(&msg.user_id).cloned().unwrap_or_else(|| "unknown".into());

            let servers_to_notify: Vec<Uuid> = self
                .server_rooms
                .iter()
                .filter_map(|(sid, members)| if members.contains(&msg.user_id) { Some(*sid) } else { None })
                .collect();

            for sid in servers_to_notify {
                if let Some(members) = self.server_rooms.get_mut(&sid) {
                    members.remove(&msg.user_id);
                }

                self.broadcast_to_server(
                    sid,
                    OutgoingMessage::UserDisconnected {
                        server_id: sid,
                        user_id: msg.user_id,
                        username: username.clone(),
                    },
                );
            }

            for (_, members) in self.channel_rooms.iter_mut() {
                members.remove(&msg.user_id);
            }

            self.usernames.remove(&msg.user_id);
        }
    }
}

impl Handler<ClientMessage> for WsServer {
    type Result = ();

    fn handle(&mut self, msg: ClientMessage, _: &mut Context<Self>) {
        match msg {
            ClientMessage::JoinServer { user_id, server_id } => {
                self.server_rooms.entry(server_id).or_default().insert(user_id);

                let username = self.username_of(user_id);

                self.broadcast_to_server_except(
                    server_id,
                    user_id,
                    OutgoingMessage::UserConnected {
                        server_id,
                        user_id,
                        username: username.clone(),
                        status: UserStatus::Online,
                    },
                );

                let online: Vec<(Uuid, String)> = self
                    .server_rooms
                    .get(&server_id)
                    .into_iter()
                    .flat_map(|set| set.iter())
                    .map(|uid| (*uid, self.username_of(*uid)))
                    .collect();

                self.send_to(user_id, OutgoingMessage::PresenceSnapshot { server_id, online });
            }

            ClientMessage::LeaveServer { user_id, server_id } => {
                if let Some(set) = self.server_rooms.get_mut(&server_id) {
                    set.remove(&user_id);
                }

                let username = self.username_of(user_id);

                self.broadcast_to_server_except(
                    server_id,
                    user_id,
                    OutgoingMessage::UserDisconnected {
                        server_id,
                        user_id,
                        username,
                    },
                );
            }

            ClientMessage::JoinChannel { user_id, channel_id } => {
                self.channel_rooms.entry(channel_id).or_default().insert(user_id);
            }

            ClientMessage::LeaveChannel { user_id, channel_id } => {
                if let Some(set) = self.channel_rooms.get_mut(&channel_id) {
                    set.remove(&user_id);
                }
            }
            ClientMessage::ChannelDeleted {
                server_id,
                channel_id,
            } => {
                self.broadcast_to_server(
                    server_id,
                    OutgoingMessage::ChannelDeleted {
                        server_id,
                        channel_id,
                    },
                );
            }
            ClientMessage::ChannelUpdated {
                server_id,
                channel_id,
            } => {
                self.broadcast_to_server(
                    server_id,
                    OutgoingMessage::ChannelUpdated {
                        server_id,
                        channel_id,
                    },
                );
            }
            ClientMessage::Typing { user_id, username, channel_id } => {
                self.broadcast_to_channel(
                    channel_id,
                    OutgoingMessage::UserTyping {
                        channel_id,
                        user_id,
                        username,
                    },
                );
            }

            ClientMessage::SendMessage { user_id, username, channel_id, content } => {
                let message_id = Uuid::new_v4();
                let created_at = chrono::Utc::now().to_rfc3339();

                self.broadcast_to_channel(
                    channel_id,
                    OutgoingMessage::NewMessage {
                        message_id,
                        channel_id,
                        user_id,
                        username,
                        content,
                        created_at,
                    },
                );
            }

            ClientMessage::BroadcastNewMessage {
                server_id: _,
                channel_id,
                message_id,
                user_id,
                username,
                content,
                created_at,
            } => {
                self.broadcast_to_channel(
                    channel_id,
                    OutgoingMessage::NewMessage {
                        message_id,
                        channel_id,
                        user_id,
                        username,
                        content,
                        created_at,
                    },
                );
            }
            ClientMessage::ChannelCreated {
                server_id,
                channel_id,
                name,
                created_at,
            } => {
                self.broadcast_to_server(
                    server_id,
                    OutgoingMessage::ChannelCreated {
                        server_id,
                        channel_id,
                        name,
                        created_at,
                    },
                );
            }
            ClientMessage::BroadcastMessageDeleted {
                server_id,
                channel_id,
                message_id,
            } => {
                self.broadcast_to_channel(
                    channel_id,
                    OutgoingMessage::MessageDeleted {
                        server_id,
                        channel_id,
                        message_id,
                    },
                );
            }

            ClientMessage::StatusChange { user_id, username, status, server_id } => {
                if let Some(server_id) = server_id {
                    self.broadcast_to_server(
                        server_id,
                        OutgoingMessage::UserStatusChanged {
                            server_id,
                            user_id,
                            username,
                            status,
                        },
                    );
                }
            }
        }
    }
}

impl Handler<ServerEvent> for WsServer {
    type Result = ();

    fn handle(&mut self, msg: ServerEvent, _: &mut Context<Self>) {
        match msg {
            ServerEvent::ServerDeleted { server_id } => {
                self.broadcast_to_server(server_id, OutgoingMessage::ServerDeleted { server_id });
                self.server_rooms.remove(&server_id);
            }
            ServerEvent::ServerUpdated { server_id } => {
                self.broadcast_to_server(
                    server_id,
                    OutgoingMessage::ServerUpdated { server_id }
                );
            }
            ServerEvent::MemberJoined { server_id, user_id, username } => {
                self.broadcast_to_server(
                    server_id,
                    OutgoingMessage::ServerMemberJoined {
                        server_id,
                        user_id,
                        username,
                    },
                );
            }
            ServerEvent::MemberLeft { server_id, user_id, username } => {
                self.broadcast_to_server(
                    server_id,
                    OutgoingMessage::ServerMemberLeft {
                        server_id,
                        user_id,
                        username,
                    },
                );
            }
            ServerEvent::MemberRoleUpdated { server_id, user_id, username, role } => {
                self.broadcast_to_server(
                    server_id,
                    OutgoingMessage::ServerMemberRoleUpdated {
                        server_id,
                        user_id,
                        username,
                        role,
                    },
                );
            }
            ServerEvent::MemberKicked { server_id, user_id, username } => {
                if let Some(set) = self.server_rooms.get_mut(&server_id) {
                    set.remove(&user_id);
                }

                self.broadcast_to_server(
                    server_id,
                    OutgoingMessage::ServerMemberKicked {
                        server_id,
                        user_id,
                        username,
                    },
                );
            }
            ServerEvent::MemberBanned { server_id, user_id, username } => {
                self.send_to(
                    user_id,
                    OutgoingMessage::ServerMemberBanned {
                        server_id,
                        user_id,
                        username: username.clone(),
                    },
                );

                if let Some(set) = self.server_rooms.get_mut(&server_id) {
                    set.remove(&user_id);
                }

                self.broadcast_to_server(
                    server_id,
                    OutgoingMessage::ServerMemberBanned {
                        server_id,
                        user_id,
                        username,
                    },
                );
            }
            ServerEvent::MemberUnbanned { server_id, user_id, username } => {
                self.broadcast_to_server(
                    server_id,
                    OutgoingMessage::ServerMemberUnbanned {
                        server_id,
                        user_id,
                        username,
                    },
                );
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use actix::{Actor, System};
    use std::sync::{Arc, Mutex};

    struct TestClient {
        inbox: Arc<Mutex<Vec<OutgoingMessage>>>,
    }

    impl Actor for TestClient {
        type Context = Context<Self>;
    }

    impl Handler<OutgoingMessage> for TestClient {
        type Result = ();

        fn handle(&mut self, msg: OutgoingMessage, _: &mut Context<Self>) {
            self.inbox.lock().unwrap().push(msg);
        }
    }

    fn client() -> (Recipient<OutgoingMessage>, Arc<Mutex<Vec<OutgoingMessage>>>) {
        let inbox = Arc::new(Mutex::new(Vec::<OutgoingMessage>::new()));
        let addr = TestClient { inbox: inbox.clone() }.start();
        (addr.recipient(), inbox)
    }

    fn take(inbox: &Arc<Mutex<Vec<OutgoingMessage>>>) -> Vec<OutgoingMessage> {
        std::mem::take(&mut *inbox.lock().unwrap())
    }

    #[actix::test]
    async fn test_connect_sends_authed() {
        let ws = WsServer::new().start();

        let user_id = Uuid::new_v4();
        let (addr, inbox) = client();

        ws.do_send(Connect {
            user_id,
            username: "alice".to_string(),
            addr,
            server_ids: vec![],
        });

        actix::clock::sleep(std::time::Duration::from_millis(20)).await;

        let msgs = take(&inbox);
        assert!(msgs.iter().any(|m| matches!(m, OutgoingMessage::Authed { user_id: uid, username } if *uid == user_id && username == "alice")));
    }

    #[actix::test]
    async fn test_join_server_presence_snapshot_and_broadcast_user_connected() {
        let ws = WsServer::new().start();

        let server_id = Uuid::new_v4();
        let alice_id = Uuid::new_v4();
        let bob_id = Uuid::new_v4();

        let (alice_addr, alice_inbox) = client();
        let (bob_addr, bob_inbox) = client();

        ws.do_send(Connect {
            user_id: alice_id,
            username: "alice".to_string(),
            addr: alice_addr,
            server_ids: vec![server_id],
        });

        ws.do_send(Connect {
            user_id: bob_id,
            username: "bob".to_string(),
            addr: bob_addr,
            server_ids: vec![server_id],
        });

        actix::clock::sleep(std::time::Duration::from_millis(20)).await;
        let _ = take(&alice_inbox);
        let _ = take(&bob_inbox);

        ws.do_send(ClientMessage::JoinServer {
            user_id: alice_id,
            server_id,
        });

        actix::clock::sleep(std::time::Duration::from_millis(20)).await;

        let alice_msgs = take(&alice_inbox);
        assert!(
            alice_msgs.iter().any(|m| matches!(m, OutgoingMessage::PresenceSnapshot { server_id: sid, online } if *sid == server_id && online.iter().any(|(uid, _)| *uid == alice_id)))
        );
        let bob_msgs = take(&bob_inbox);
        assert!(
            bob_msgs.iter().any(|m| matches!(m, OutgoingMessage::UserConnected { server_id: sid, user_id: uid, username, status } if *sid == server_id && *uid == alice_id && username == "alice" && *status == UserStatus::Online))
        );
    }
    #[actix::test]
    async fn test_disconnect_last_session_broadcasts_user_disconnected_and_removes_from_rooms() {
        let ws = WsServer::new().start();

        let server_id = Uuid::new_v4();

        let alice_id = Uuid::new_v4();
        let bob_id = Uuid::new_v4();

        let (alice_addr, alice_inbox) = client();
        let (bob_addr, bob_inbox) = client();

        ws.do_send(Connect {
            user_id: alice_id,
            username: "alice".to_string(),
            addr: alice_addr.clone(),
            server_ids: vec![server_id],
        });

        ws.do_send(Connect {
            user_id: bob_id,
            username: "bob".to_string(),
            addr: bob_addr,
            server_ids: vec![server_id],
        });
        actix::clock::sleep(std::time::Duration::from_millis(20)).await;
        let _ = take(&alice_inbox);
        let _ = take(&bob_inbox);

        ws.do_send(Disconnect {
            user_id: alice_id,
            addr: alice_addr,
        });
        actix::clock::sleep(std::time::Duration::from_millis(30)).await;
        let bob_msgs = take(&bob_inbox);
        assert!(
            bob_msgs.iter().any(|m| matches!(m, OutgoingMessage::UserDisconnected { server_id: sid, user_id: uid, username } if *sid == server_id && *uid == alice_id && username == "alice"))
        );
    }

    #[actix::test]
    async fn test_broadcast_new_message_goes_to_channel_room() {
        let ws = WsServer::new().start();

        let channel_id = Uuid::new_v4();

        let alice_id = Uuid::new_v4();
        let bob_id = Uuid::new_v4();

        let (alice_addr, alice_inbox) = client();
        let (bob_addr, bob_inbox) = client();

        ws.do_send(Connect {
            user_id: alice_id,
            username: "alice".to_string(),
            addr: alice_addr,
            server_ids: vec![],
        });

        ws.do_send(Connect {
            user_id: bob_id,
            username: "bob".to_string(),
            addr: bob_addr,
            server_ids: vec![],
        });

        actix::clock::sleep(std::time::Duration::from_millis(20)).await;
        let _ = take(&alice_inbox);
        let _ = take(&bob_inbox);

        ws.do_send(ClientMessage::JoinChannel { user_id: alice_id, channel_id });
        ws.do_send(ClientMessage::JoinChannel { user_id: bob_id, channel_id });

        actix::clock::sleep(std::time::Duration::from_millis(20)).await;

        let message_id = Uuid::new_v4();
        ws.do_send(ClientMessage::BroadcastNewMessage {
            server_id: Uuid::new_v4(),
            channel_id,
            message_id,
            user_id: alice_id,
            username: "alice".to_string(),
            content: "hello".to_string(),
            created_at: "now".to_string(),
        });

        actix::clock::sleep(std::time::Duration::from_millis(20)).await;

        let alice_msgs = take(&alice_inbox);
        let bob_msgs = take(&bob_inbox);

        let assert_new = |msgs: &[OutgoingMessage]| {
            assert!(msgs.iter().any(|m| matches!(m,
                OutgoingMessage::NewMessage { message_id: mid, channel_id: cid, user_id: uid, username, content, created_at }
                if *mid == message_id && *cid == channel_id && *uid == alice_id && username == "alice" && content == "hello" && created_at == "now"
            )));
        };

        assert_new(&alice_msgs);
        assert_new(&bob_msgs);
    }

    #[actix::test]
    async fn test_broadcast_message_deleted_goes_to_channel_room() {
        let ws = WsServer::new().start();

        let server_id = Uuid::new_v4();
        let channel_id = Uuid::new_v4();
        let message_id = Uuid::new_v4();

        let user_id = Uuid::new_v4();
        let (addr, inbox) = client();

        ws.do_send(Connect {
            user_id,
            username: "alice".to_string(),
            addr,
            server_ids: vec![server_id],
        });

        actix::clock::sleep(std::time::Duration::from_millis(20)).await;
        let _ = take(&inbox);

        ws.do_send(ClientMessage::JoinChannel { user_id, channel_id });
        actix::clock::sleep(std::time::Duration::from_millis(10)).await;

        ws.do_send(ClientMessage::BroadcastMessageDeleted {
            server_id,
            channel_id,
            message_id,
        });

        actix::clock::sleep(std::time::Duration::from_millis(20)).await;

        let msgs = take(&inbox);
        assert!(msgs.iter().any(|m| matches!(m,
            OutgoingMessage::MessageDeleted { server_id: sid, channel_id: cid, message_id: mid }
            if *sid == server_id && *cid == channel_id && *mid == message_id
        )));
    }
    #[actix::test]
    async fn test_server_deleted_broadcasts_and_removes_room() {
        let ws = WsServer::new().start();

        let server_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let (addr, inbox) = client();

        ws.do_send(Connect {
            user_id,
            username: "alice".to_string(),
            addr,
            server_ids: vec![server_id],
        });

        actix::clock::sleep(std::time::Duration::from_millis(20)).await;
        let _ = take(&inbox);

        ws.do_send(ServerEvent::ServerDeleted { server_id });

        actix::clock::sleep(std::time::Duration::from_millis(20)).await;

        let msgs = take(&inbox);
        assert!(msgs.iter().any(|m| matches!(m, OutgoingMessage::ServerDeleted { server_id: sid } if *sid == server_id)));
    }
}
