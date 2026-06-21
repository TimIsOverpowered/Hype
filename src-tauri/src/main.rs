// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let debug = std::env::args().any(|arg| arg == "--debug");
    hype_lib::run(debug)
}
