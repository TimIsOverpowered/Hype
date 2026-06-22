use std::fs;
use std::path::Path;
use std::process::Command;

fn download_ffmpeg_windows(binaries_dir: &Path) {
    let exe_path = binaries_dir.join("ffmpeg-x86_64-pc-windows-msvc.exe");
    if exe_path.exists() {
        return;
    }

    println!("cargo:warning=Downloading FFmpeg Sidecar for Windows...");

    let script = format!(
        r#"$url = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
$out = 'ffmpeg.zip'
Invoke-WebRequest -Uri $url -OutFile $out
Expand-Archive -Path $out -DestinationPath 'temp_ffmpeg' -Force
$items = Get-ChildItem -Path 'temp_ffmpeg' -Directory | Sort-Object Name -Descending | Select-Object -First 1
Move-Item -Path ($items.FullName + '\bin\ffmpeg.exe') -Destination '{}'
Remove-Item -Recurse -Force $out, 'temp_ffmpeg'"#,
        exe_path.display()
    );

    let status = Command::new("powershell")
        .args(&["-Command", &script])
        .current_dir(std::env::current_dir().unwrap_or_default())
        .status();

    match status {
        Ok(s) if s.success() => println!("cargo:warning=FFmpeg download complete"),
        Ok(s) => {
            println!(
                "cargo:warning=FFmpeg download failed with exit code: {:?}",
                s.code()
            );
        }
        Err(e) => {
            println!("cargo:warning=FFmpeg download error: {}", e);
        }
    }
}

fn download_ffmpeg_mac(binaries_dir: &Path, triple: &str) {
    let mac_path = binaries_dir.join(format!("ffmpeg-{}", triple));
    if mac_path.exists() {
        return;
    }

    println!("cargo:warning=Downloading FFmpeg Sidecar for macOS ({})...", triple);

    let script = format!(
        "curl -L -o ffmpeg-mac.zip https://evermeet.cx/ffmpeg/get/zip && \
         unzip -o ffmpeg-mac.zip -d src-tauri/binaries/ && \
         mv src-tauri/binaries/ffmpeg src-tauri/binaries/ffmpeg-{} && \
         rm ffmpeg-mac.zip && chmod +x src-tauri/binaries/ffmpeg-{}",
        triple, triple
    );

    let status = Command::new("sh").args(&["-c", &script]).status();

    match status {
        Ok(s) if s.success() => println!("cargo:warning=FFmpeg macOS download complete"),
        Ok(s) => {
            println!(
                "cargo:warning=FFmpeg macOS download failed with exit code: {:?}",
                s.code()
            );
        }
        Err(e) => {
            println!("cargo:warning=FFmpeg macOS download error: {}", e);
        }
    }
}

fn download_ffmpeg_linux(binaries_dir: &Path) {
    let linux_path = binaries_dir.join("ffmpeg-x86_64-unknown-linux-gnu");
    if linux_path.exists() {
        return;
    }

    println!("cargo:warning=Downloading FFmpeg Sidecar for Linux...");

    let script = "curl -L -o ffmpeg-linux.tar.xz https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz && \
                  tar -xf ffmpeg-linux.tar.xz --strip-components=2 \"ffmpeg-master-latest-linux64-gpl/bin/ffmpeg\" && \
                  mv ffmpeg src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu && \
                  rm ffmpeg-linux.tar.xz && chmod +x src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu";

    let status = Command::new("sh").args(&["-c", script]).status();

    match status {
        Ok(s) if s.success() => println!("cargo:warning=FFmpeg Linux download complete"),
        Ok(s) => {
            println!(
                "cargo:warning=FFmpeg Linux download failed with exit code: {:?}",
                s.code()
            );
        }
        Err(e) => {
            println!("cargo:warning=FFmpeg Linux download error: {}", e);
        }
    }
}

fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();
    let out_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let binaries_dir = Path::new(&out_dir).join("binaries");

    if !binaries_dir.exists() {
        fs::create_dir_all(&binaries_dir).unwrap();
    }

    if target.contains("x86_64-pc-windows-msvc") {
        download_ffmpeg_windows(&binaries_dir);
    } else if target.contains("apple-darwin") {
        let triple = if target.contains("aarch64") {
            "aarch64-apple-darwin"
        } else {
            "x86_64-apple-darwin"
        };
        download_ffmpeg_mac(&binaries_dir, triple);
    } else if target.contains("x86_64-unknown-linux-gnu") {
        download_ffmpeg_linux(&binaries_dir);
    }

    tauri_build::build();
}
