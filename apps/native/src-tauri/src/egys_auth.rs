use tauri::{AppHandle, Emitter, Manager};
use tauri::utils::config::WebviewUrl;
use tauri::webview::{PageLoadEvent, WebviewWindowBuilder};

const AUTH_WINDOW_LABEL: &str = "egys-login";

// e-GYS' mobile login page already speaks to Flutter through
// window.flutter_inappwebview.callHandler('mobile', payload). The Tauri auth
// window intentionally exposes no IPC capability. This compatibility shim only
// translates that narrow login protocol into a custom navigation intercepted by
// Rust, so remote content never receives access to the main Tauri API.
const AUTH_BRIDGE_SCRIPT: &str = r#"
(() => {
  if (window.location.origin !== 'https://e.gys.or.id') return;
  const handoff = (token) => {
    const value = String(token || '').trim();
    if (!value || value === 'null' || value === 'undefined') return;
    window.location.href = 'gysapp-auth://callback?token=' + encodeURIComponent(value);
  };
  const normalize = (value) => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch (_) { return value; }
  };
  const handle = (payload) => {
    const msg = normalize(payload);
    if (!msg || typeof msg !== 'object') return null;
    const cmd = String(msg.cmd || '').toLowerCase();
    if (cmd === 'googlelogin') {
      window.location.assign('https://e.gys.or.id/auth/google');
      return null;
    }
    if (cmd === 'applelogin') {
      window.location.assign('https://e.gys.or.id/auth/apple');
      return null;
    }
    if ((cmd === 'googlelogged' || cmd === 'applelogged') && msg.token) {
      handoff(msg.token);
    }
    return null;
  };

  window.flutter_inappwebview = window.flutter_inappwebview || {};
  window.flutter_inappwebview.callHandler = (name, ...args) => {
    if (name === 'mobile') handle(args[0]);
    return Promise.resolve(null);
  };

  // Some e-GYS revisions persist the application token after hosted OAuth
  // instead of immediately emitting googlelogged/applelogged. Probe only the
  // known token keys and hand off the first value found.
  const probeStoredToken = () => {
    try {
      for (const key of ['token', 'access_token', 'jwt', 'id_token']) {
        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (value) {
          handoff(value);
          return;
        }
      }
      if (window.__TOKEN__) handoff(window.__TOKEN__);
    } catch (_) {}
  };
  window.addEventListener('DOMContentLoaded', () => setTimeout(probeStoredToken, 0), { once: true });
  setTimeout(probeStoredToken, 500);
})();
"#;

fn allowed_auth_navigation(url: &tauri::Url) -> bool {
    if url.scheme() == "gysapp-auth" {
        return true;
    }
    if url.scheme() != "https" {
        return false;
    }
    let host = url.host_str().unwrap_or_default();
    host == "e.gys.or.id"
        || host == "accounts.google.com"
        || host.ends_with(".google.com")
        || host == "appleid.apple.com"
        || host.ends_with(".apple.com")
}

#[tauri::command]
pub async fn open_egys_login(app: AppHandle, theme: Option<String>) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(AUTH_WINDOW_LABEL) {
        existing.show().map_err(|error| error.to_string())?;
        existing.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let theme = match theme.as_deref() {
        Some("dark") => "dark",
        _ => "light",
    };
    let login_url = format!("https://e.gys.or.id/login?theme={theme}")
        .parse::<tauri::Url>()
        .map_err(|error| error.to_string())?;

    let navigation_app = app.clone();
    WebviewWindowBuilder::new(&app, AUTH_WINDOW_LABEL, WebviewUrl::External(login_url))
        .title("Masuk ke e-GYS")
        .inner_size(520.0, 720.0)
        .min_inner_size(360.0, 540.0)
        .center()
        .initialization_script(AUTH_BRIDGE_SCRIPT)
        .on_page_load(|window, payload| {
            let url = payload.url();
            if matches!(payload.event(), PageLoadEvent::Finished)
                && url.scheme() == "https"
                && url.host_str() == Some("e.gys.or.id")
            {
                // Android remote-document initialization can be late on older
                // WebView versions; re-applying after load makes the bridge
                // deterministic without granting remote IPC permissions.
                let _ = window.eval(AUTH_BRIDGE_SCRIPT);
            }
        })
        .on_navigation(move |url| {
            if url.scheme() == "gysapp-auth" {
                if url.host_str() == Some("callback") {
                    if let Some((_, token)) = url.query_pairs().find(|(key, _)| key == "token") {
                        let token = token.trim().to_string();
                        if !token.is_empty() {
                            let _ = navigation_app.emit_to("main", "egys-auth-token", token);
                        }
                    }
                }
                if let Some(window) = navigation_app.get_webview_window(AUTH_WINDOW_LABEL) {
                    let _ = window.close();
                }
                return false;
            }
            allowed_auth_navigation(url)
        })
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
}
