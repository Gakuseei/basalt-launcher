#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let arguments: Vec<String> = std::env::args().collect();
    if let Some(supervision) = basalt_launcher_lib::supervisor_args(&arguments) {
        basalt_launcher_lib::supervise(supervision)
    }

    #[cfg(target_os = "linux")]
    {
        webkit_render_env();
        leave_appimage_mount();
    }

    basalt_launcher_lib::run()
}

/**
 * The AppImage runtime starts us inside its mount, so every file dialog
 * opened in /tmp/.mount_xxx/usr. Move to the home directory instead.
 */
#[cfg(target_os = "linux")]
fn leave_appimage_mount() {
    let Some(appdir) = std::env::var_os("APPDIR") else {
        return;
    };
    let inside = std::env::current_dir().is_ok_and(|cwd| cwd.starts_with(&appdir));
    if let (true, Some(home)) = (inside, std::env::var_os("HOME")) {
        let _ = std::env::set_current_dir(home);
    }
}

/**
 * On nvidia the dmabuf handoff to the compositor breaks (blank window on X11,
 * syncobj protocol error on Wayland). Turning the renderer off entirely fell
 * back to CPU painting and scrolled at a few fps, so keep GPU painting and
 * only hand the frames over through shared memory. A caller's own setting wins.
 */
#[cfg(target_os = "linux")]
fn webkit_render_env() {
    let nvidia = std::path::Path::new("/sys/module/nvidia").exists();
    let configured = [
        "WEBKIT_DMABUF_RENDERER_FORCE_SHM",
        "WEBKIT_DISABLE_DMABUF_RENDERER",
    ]
    .iter()
    .any(|key| std::env::var_os(key).is_some());
    if nvidia && !configured {
        std::env::set_var("WEBKIT_DMABUF_RENDERER_FORCE_SHM", "1");
    }
}
