pub mod chat;
pub mod clipper;
pub mod job_queue;

/// Helper to create a synchronous command with Windows GUI console suppression
pub fn build_std_command<P: AsRef<std::ffi::OsStr>>(program: P) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd
}

/// Helper to create an asynchronous (Tokio) command with Windows GUI console suppression
pub fn build_tokio_command<P: AsRef<std::ffi::OsStr>>(program: P) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(program);
    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd
}
