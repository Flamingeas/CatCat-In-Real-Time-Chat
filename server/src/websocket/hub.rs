use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Clone, Default)]
pub struct WsHub {
    inner: Arc<Mutex<HashMap<Uuid, usize>>>,
}

impl WsHub {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn connect(&self, user_id: Uuid) -> usize {
        let mut map = self.inner.lock().unwrap();
        let entry = map.entry(user_id).or_insert(0);
        *entry += 1;
        *entry
    }
    pub fn disconnect(&self, user_id: Uuid) -> usize {
        let mut map = self.inner.lock().unwrap();
        if let Some(v) = map.get_mut(&user_id) {
            *v = v.saturating_sub(1);
            if *v == 0 {
                map.remove(&user_id);
                return 0;
            }
            return *v;
        }
        0
    }
    pub fn online_users(&self) -> HashSet<Uuid> {
        let map = self.inner.lock().unwrap();
        map.keys().cloned().collect()
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connect_increments_counter_for_same_user() {
        let hub = WsHub::new();
        let uid = Uuid::new_v4();

        assert_eq!(hub.connect(uid), 1);
        assert_eq!(hub.connect(uid), 2);
        assert_eq!(hub.connect(uid), 3);

        let online = hub.online_users();
        assert!(online.contains(&uid));
        assert_eq!(online.len(), 1);
    }

    #[test]
    fn disconnect_decrements_and_removes_when_zero() {
        let hub = WsHub::new();
        let uid = Uuid::new_v4();

        hub.connect(uid);
        hub.connect(uid);

        assert_eq!(hub.disconnect(uid), 1);
        assert_eq!(hub.disconnect(uid), 0);

        let online = hub.online_users();
        assert!(!online.contains(&uid));
        assert_eq!(online.len(), 0);
    }

    #[test]
    fn disconnect_unknown_user_returns_zero_and_does_not_panic() {
        let hub = WsHub::new();
        let uid = Uuid::new_v4();

        assert_eq!(hub.disconnect(uid), 0);
        assert_eq!(hub.online_users().len(), 0);
    }

    #[test]
    fn online_users_returns_all_connected_users() {
        let hub = WsHub::new();
        let u1 = Uuid::new_v4();
        let u2 = Uuid::new_v4();
        let u3 = Uuid::new_v4();

        hub.connect(u1);
        hub.connect(u2);
        hub.connect(u3);

        let online = hub.online_users();
        assert_eq!(online.len(), 3);
        assert!(online.contains(&u1));
        assert!(online.contains(&u2));
        assert!(online.contains(&u3));
    }

    #[test]
    fn online_users_only_includes_users_with_positive_count() {
        let hub = WsHub::new();
        let u1 = Uuid::new_v4();
        let u2 = Uuid::new_v4();

        hub.connect(u1);
        hub.connect(u2);
        hub.connect(u2);

        assert_eq!(hub.disconnect(u2), 1);
        assert_eq!(hub.disconnect(u1), 0);

        let online = hub.online_users();
        assert_eq!(online.len(), 1);
        assert!(!online.contains(&u1));
        assert!(online.contains(&u2));
    }

    #[test]
    fn disconnect_is_saturating_and_never_goes_negative() {
        let hub = WsHub::new();
        let uid = Uuid::new_v4();

        assert_eq!(hub.disconnect(uid), 0);

        hub.connect(uid);
        assert_eq!(hub.disconnect(uid), 0);
        assert_eq!(hub.disconnect(uid), 0);

        assert!(hub.online_users().is_empty());
    }
}
