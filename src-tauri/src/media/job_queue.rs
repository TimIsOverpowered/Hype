use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::{Arc, Mutex, RwLock};

use tokio::process::Child;

use serde::Serialize;
use tauri::AppHandle;
use tauri::Emitter;

lazy_static::lazy_static! {
    static ref JOB_QUEUE: JobQueue = JobQueue::new();
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum JobType {
    Clip,
    Download,
    ChatRender,
}

impl JobType {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobType::Clip => "clip",
            JobType::Download => "download",
            JobType::ChatRender => "chat-render",
        }
    }

}

#[derive(Clone, PartialEq, Eq, Serialize)]
pub enum JobStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl JobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobStatus::Running => "running",
            JobStatus::Completed => "completed",
            JobStatus::Failed => "failed",
            JobStatus::Cancelled => "cancelled",
        }
    }
}

#[derive(Serialize, Clone)]
pub struct JobSummary {
    pub id: String,
    pub job_type: String,
    pub name: String,
    pub status: String,
    pub progress: f32,
    pub error: Option<String>,
}

pub struct Job {
    pub id: String,
    pub job_type: JobType,
    pub name: String,
    pub status: Mutex<JobStatus>,
    pub progress: Arc<AtomicU8>,
    pub error: Mutex<Option<String>>,
    pub cancel_flag: Arc<AtomicBool>,
    pub child_handle: Mutex<Option<Child>>,
}

pub struct JobQueue {
    jobs: RwLock<HashMap<String, Arc<Job>>>,
}

impl JobQueue {
    pub fn new() -> Self {
        JobQueue {
            jobs: RwLock::new(HashMap::new()),
        }
    }

    pub fn submit(&self, job_type: JobType, name: String) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let progress = Arc::new(AtomicU8::new(0));

        let job = Arc::new(Job {
            id: id.clone(),
            job_type,
            name,
            status: Mutex::new(JobStatus::Running),
            progress,
            error: Mutex::new(None),
            cancel_flag,
            child_handle: Mutex::new(None),
        });

        self.jobs.write().unwrap().insert(id.clone(), job);
        id
    }

    pub async fn cancel(&self, id: &str, app: &AppHandle) -> bool {
        // Step 1: Check if job exists and is running, clone job Arc
        let job = {
            let jobs = self.jobs.read().unwrap();
            jobs.get(id).cloned()
        };

        let job = match job {
            Some(j) => j,
            None => return false,
        };

        // Step 2: Check and update status
        let was_running = {
            let mut status = job.status.lock().unwrap();
            if *status == JobStatus::Running {
                *status = JobStatus::Cancelled;
                true
            } else {
                false
            }
        };

        if !was_running {
            return false;
        }

        // Step 3: Set cancel flag (atomic, no lock needed)
        job.cancel_flag.store(true, Ordering::SeqCst);

        // Step 4: Kill child process tree cleanly across platforms
        let maybe_child = {
            if let Ok(mut child_opt) = job.child_handle.lock() {
                child_opt.take()
            } else {
                None
            }
        };

        if let Some(mut child) = maybe_child {
            #[cfg(windows)]
            {
                if let Some(pid) = child.id() {
                    let _ = crate::media::build_std_command("taskkill")
                        .args(&["/F", "/T", "/PID", &pid.to_string()])
                        .output();
                }
            }

            #[cfg(not(windows))]
            {
                if let Some(pid) = child.id() {
                    let _ = std::process::Command::new("kill")
                        .args(&["-9", &pid.to_string()])
                        .output();
                }
            }

            let _ = child.kill().await;
        }

        // Step 5: Emit events (acquires locks independently)
        let summary = self.get_summary(id);
        if let Some(s) = summary {
            let _ = app.emit("job-state-changed", &s);
            let _ = app.emit(&format!("{}-cancelled", job.job_type.as_str()), s);
        }

        true
    }

    pub fn list(&self) -> Vec<JobSummary> {
        self.jobs
            .read()
            .unwrap()
            .values()
            .map(|job| {
                let status = job.status.lock().unwrap();
                let error = job.error.lock().unwrap();
                JobSummary {
                    id: job.id.clone(),
                    job_type: job.job_type.as_str().to_string(),
                    name: job.name.clone(),
                    status: status.as_str().to_string(),
                    progress: job.progress.load(Ordering::SeqCst) as f32,
                    error: error.clone(),
                }
            })
            .collect()
    }

    pub fn update_progress(&self, id: &str, percent: u8, app: &AppHandle) {
        let jobs = self.jobs.read().unwrap();
        if let Some(job) = jobs.get(id) {
            let status = job.status.lock().unwrap();
            if *status == JobStatus::Running {
                job.progress.store(percent.min(100), Ordering::SeqCst);
            }
        }
        let summary = self.get_summary(id);
        if let Some(s) = summary {
            let _ = app.emit("job-state-changed", &s);
        }
    }

    pub fn get_job(&self, id: &str) -> Option<Arc<Job>> {
        self.jobs.read().unwrap().get(id).cloned()
    }

    pub fn get_summary(&self, id: &str) -> Option<JobSummary> {
        let jobs = self.jobs.read().unwrap();
        let job = jobs.get(id)?;
        let status = job.status.lock().unwrap();
        let error = job.error.lock().unwrap();
        Some(JobSummary {
            id: job.id.clone(),
            job_type: job.job_type.as_str().to_string(),
            name: job.name.clone(),
            status: status.as_str().to_string(),
            progress: job.progress.load(Ordering::SeqCst) as f32,
            error: error.clone(),
        })
    }

    pub fn complete(&self, id: &str, success: bool, app: &AppHandle, event_prefix: &str) {
        {
            let mut jobs = self.jobs.write().unwrap();
            if let Some(job) = jobs.get_mut(id) {
                let mut status = job.status.lock().unwrap();
                *status = if success {
                    JobStatus::Completed
                } else {
                    JobStatus::Failed
                };
                job.progress.store(100, Ordering::SeqCst);

                if !success {
                    let mut error = job.error.lock().unwrap();
                    if error.is_none() {
                        *error = Some("FFmpeg exited with error".to_string());
                    }
                }
            }
        }

        let summary = self.get_summary(id);
        if let Some(s) = summary {
            let _ = app.emit("job-state-changed", &s);
            if success {
                let _ = app.emit(&format!("{}-completed", event_prefix), s);
            } else {
                let _ = app.emit(&format!("{}-failed", event_prefix), s);
            }
        }
    }

    pub fn fail(&self, id: &str, error: String, app: &AppHandle, event_prefix: &str) {
        {
            let mut jobs = self.jobs.write().unwrap();
            if let Some(job) = jobs.get_mut(id) {
                let mut status = job.status.lock().unwrap();
                *status = JobStatus::Failed;
                let mut err = job.error.lock().unwrap();
                *err = Some(error);
            }
        }

        let summary = self.get_summary(id);
        if let Some(s) = summary {
            let _ = app.emit("job-state-changed", &s);
            let _ = app.emit(&format!("{}-failed", event_prefix), s);
        }
    }

    pub fn remove(&self, id: &str) {
        self.jobs.write().unwrap().remove(id);
    }
}

pub fn get_queue() -> &'static JobQueue {
    &JOB_QUEUE
}
