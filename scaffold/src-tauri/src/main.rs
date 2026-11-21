// Windows 发布版不弹控制台；调试版保留日志。
#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

fn main() {
    kinexa_lib::run()
}
