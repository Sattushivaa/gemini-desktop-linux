// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // On Linux, WebKitGTK's DMABUF/gpu-accelerated compositing path is prone to
    // blurry (low-res, "image-like") text and rendering crashes on hybrid/multi-GPU
    // setups. These must be set before the first WebView is created.
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }

    gemini_desktop_lib::run()
}
