use std::collections::HashMap;
use std::sync::{mpsc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::State;

const LEASE_TIMEOUT: Duration = Duration::from_secs(60);
const WORKER_POLL: Duration = Duration::from_secs(10);

enum Message {
    Set {
        lease_id: String,
        active: bool,
        reply: mpsc::Sender<Result<(), String>>,
    },
    Shutdown,
}

struct Worker {
    sender: mpsc::Sender<Message>,
    handle: JoinHandle<()>,
}

#[derive(Default)]
pub struct DisplayAwakeState {
    worker: Mutex<Option<Worker>>,
}

impl DisplayAwakeState {
    fn set(&self, lease_id: String, active: bool) -> Result<(), String> {
        let sender = {
            let mut worker = self
                .worker
                .lock()
                .map_err(|_| "failed to lock display-awake worker".to_string())?;
            if worker.is_none() {
                let (sender, receiver) = mpsc::channel();
                let handle = thread::Builder::new()
                    .name("life-launcher-display-awake".to_string())
                    .spawn(move || run_worker(receiver))
                    .map_err(|error| format!("failed to start display-awake worker: {error}"))?;
                *worker = Some(Worker { sender, handle });
            }
            worker.as_ref().unwrap().sender.clone()
        };
        let (reply, result) = mpsc::channel();
        sender
            .send(Message::Set {
                lease_id,
                active,
                reply,
            })
            .map_err(|_| "display-awake worker stopped".to_string())?;
        result
            .recv()
            .map_err(|_| "display-awake worker did not respond".to_string())?
    }

    pub fn shutdown(&self) {
        if let Ok(mut worker) = self.worker.lock() {
            if let Some(worker) = worker.take() {
                let _ = worker.sender.send(Message::Shutdown);
                let _ = worker.handle.join();
            }
        }
    }
}

#[derive(Default)]
struct LeaseSet {
    leases: HashMap<String, Instant>,
    held: bool,
}

impl LeaseSet {
    fn set(
        &mut self,
        lease_id: String,
        active: bool,
        now: Instant,
        apply: &mut impl FnMut(bool) -> Result<(), String>,
    ) -> Result<(), String> {
        if active {
            self.leases.insert(lease_id.clone(), now);
            if !self.held {
                if let Err(error) = apply(true) {
                    self.leases.remove(&lease_id);
                    return Err(error);
                }
                self.held = true;
            }
        } else {
            self.leases.remove(&lease_id);
            self.release_if_idle(apply)?;
        }
        Ok(())
    }

    fn expire(
        &mut self,
        now: Instant,
        apply: &mut impl FnMut(bool) -> Result<(), String>,
    ) -> Result<(), String> {
        self.leases
            .retain(|_, last_seen| now.duration_since(*last_seen) < LEASE_TIMEOUT);
        self.release_if_idle(apply)
    }

    fn release_if_idle(
        &mut self,
        apply: &mut impl FnMut(bool) -> Result<(), String>,
    ) -> Result<(), String> {
        if self.held && self.leases.is_empty() {
            apply(false)?;
            self.held = false;
        }
        Ok(())
    }
}

fn run_worker(receiver: mpsc::Receiver<Message>) {
    let mut leases = LeaseSet::default();
    let mut apply = apply_display_awake;
    loop {
        match receiver.recv_timeout(WORKER_POLL) {
            Ok(Message::Set {
                lease_id,
                active,
                reply,
            }) => {
                let _ = reply.send(leases.set(lease_id, active, Instant::now(), &mut apply));
            }
            Ok(Message::Shutdown) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let _ = leases.expire(Instant::now(), &mut apply);
            }
        }
    }
    leases.leases.clear();
    let _ = leases.release_if_idle(&mut apply);
}

#[cfg(windows)]
fn apply_display_awake(active: bool) -> Result<(), String> {
    use windows::Win32::System::Power::{
        SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, EXECUTION_STATE,
    };
    let flags = if active {
        ES_CONTINUOUS | ES_DISPLAY_REQUIRED
    } else {
        ES_CONTINUOUS
    };
    let previous = unsafe { SetThreadExecutionState(flags) };
    if previous == EXECUTION_STATE(0) {
        return Err(format!(
            "failed to update display idle request: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
fn apply_display_awake(_active: bool) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn set_display_awake(
    state: State<'_, DisplayAwakeState>,
    lease_id: String,
    active: bool,
) -> Result<(), String> {
    if lease_id.is_empty() || lease_id.len() > 80 {
        return Err("invalid display-awake lease".to_string());
    }
    state.set(lease_id, active)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn leases_acquire_once_and_release_only_after_the_last_close() {
        let mut leases = LeaseSet::default();
        let mut calls = Vec::new();
        let mut apply = |active| {
            calls.push(active);
            Ok(())
        };
        let now = Instant::now();
        leases.set("first".into(), true, now, &mut apply).unwrap();
        leases.set("first".into(), true, now, &mut apply).unwrap();
        leases.set("second".into(), true, now, &mut apply).unwrap();
        leases.set("first".into(), false, now, &mut apply).unwrap();
        leases.set("second".into(), false, now, &mut apply).unwrap();
        leases.set("second".into(), false, now, &mut apply).unwrap();
        assert_eq!(calls, [true, false]);
    }

    #[test]
    fn abandoned_lease_expires_and_release_failure_can_retry() {
        let mut leases = LeaseSet::default();
        let now = Instant::now();
        let mut calls = Vec::new();
        leases
            .set("old".into(), true, now, &mut |active| {
                calls.push(active);
                Ok(())
            })
            .unwrap();
        let mut fail_once = true;
        let mut release = |active| {
            calls.push(active);
            if !active && fail_once {
                fail_once = false;
                Err("temporary failure".to_string())
            } else {
                Ok(())
            }
        };
        assert!(leases.expire(now + LEASE_TIMEOUT, &mut release).is_err());
        leases.expire(now + LEASE_TIMEOUT, &mut release).unwrap();
        assert_eq!(calls, [true, false, false]);
    }
}
