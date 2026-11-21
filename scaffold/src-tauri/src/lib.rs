//! Kinexa 内核入口。
//!
//! 前端只做界面与交互，所有像素都在这侧生成：
//! 笔迹光栅化、图层合成、工程读写全部在 Rust 完成。
//! 交互层通过原始字节（RGBA 脏矩形）拿到结果，再贴到画布上。

// Windows 发布版不弹控制台；调试版保留日志。
#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

mod doc;
mod paint;

use std::path::Path;
use std::sync::Mutex;

use serde::Serialize;
use tauri::ipc::Response;
use tauri::State;

use doc::{Doc, DocInfo};
use paint::{Stroke, packet};

/// 笔迹色值的解析上限：超过这个尺寸的工程直接拒绝，避免一开就吃掉几个 G。
const MAX_SIDE: u32 = 8192;
const MIN_SIDE: u32 = 64;

/// 撤销栈上限（M0 先按 200 步，M1 再换成差分存储）。
const UNDO_LIMIT: usize = 200;

/// 一次落笔的补丁：只记录被改到的矩形，前后各一份像素。
struct Patch {
    layer_id: u32,
    frame: usize,
    rect: doc::Rect,
    before: Vec<u8>,
    after: Vec<u8>,
}

/// 编辑器会话：一份工程 + 当前笔 + 撤销栈。
struct Editor {
    doc: Doc,
    stroke: Option<Stroke>,
    undo: Vec<Patch>,
    redo: Vec<Patch>,
    /// 洋葱皮开关：打开后，当前画格下面垫前一格（红）与后一格（蓝）。
    onion: bool,
}

impl Editor {
    fn new(doc: Doc) -> Self {
        Self {
            doc,
            stroke: None,
            undo: Vec::new(),
            redo: Vec::new(),
            onion: false,
        }
    }

    /// 把一段补丁写回指定状态（撤销用 before，重做用 after）。
    fn restore(&mut self, patch: &Patch, before: bool) -> doc::Rect {
        let w = self.doc.width;
        let Some(layer) = self.doc.layers.iter_mut().find(|l| l.id == patch.layer_id) else {
            return doc::Rect::default();
        };
        let Some(frame) = layer.frames.get_mut(patch.frame) else {
            return doc::Rect::default();
        };
        let src = if before { &patch.before } else { &patch.after };
        for row in 0..patch.rect.h {
            let dst_off = ((patch.rect.y + row) * w + patch.rect.x) * 4;
            let src_off = row * patch.rect.w * 4;
            frame[dst_off..dst_off + patch.rect.w * 4]
                .copy_from_slice(&src[src_off..src_off + patch.rect.w * 4]);
        }
        patch.rect
    }
}

struct AppState {
    inner: Mutex<Option<Editor>>,
}

fn with_editor<T>(
    state: &State<'_, AppState>,
    f: impl FnOnce(&mut Editor) -> Result<T, String>,
) -> Result<T, String> {
    let mut guard = state
        .inner
        .lock()
        .map_err(|_| "内部状态异常，请重启 Kinexa".to_string())?;
    let editor = guard
        .as_mut()
        .ok_or_else(|| "还没有打开的工程".to_string())?;
    f(editor)
}

/// 把 #rrggbb / #rgb 解析成 RGB。前端永远传合法色值，这里仍做兜底。
fn parse_hex_color(input: &str) -> Result<[u8; 3], String> {
    let s = input.trim().trim_start_matches('#');
    let expanded = if s.len() == 3 {
        format!(
            "{}{}{}{}{}{}",
            &s[0..1],
            &s[0..1],
            &s[1..2],
            &s[1..2],
            &s[2..3],
            &s[2..3]
        )
    } else {
        s.to_string()
    };
    if expanded.len() != 6 {
        return Err("颜色格式不认识，应形如 #17171c".to_string());
    }
    let r = u8::from_str_radix(&expanded[0..2], 16).map_err(|_| "颜色格式不认识".to_string())?;
    let g = u8::from_str_radix(&expanded[2..4], 16).map_err(|_| "颜色格式不认识".to_string())?;
    let b = u8::from_str_radix(&expanded[4..6], 16).map_err(|_| "颜色格式不认识".to_string())?;
    Ok([r, g, b])
}

fn clamp_side(v: u32) -> u32 {
    v.clamp(MIN_SIDE, MAX_SIDE)
}

/// 新建一份空白工程，并把它设为当前工程。
#[tauri::command]
fn new_project(
    state: State<'_, AppState>,
    width: u32,
    height: u32,
    fps: u32,
    name: String,
    transparent: bool,
) -> Result<DocInfo, String> {
    let w = clamp_side(width);
    let h = clamp_side(height);
    let doc = Doc::blank(w as usize, h as usize, &name, fps.clamp(1, 60), transparent);
    let info = doc.info();
    *state
        .inner
        .lock()
        .map_err(|_| "内部状态异常".to_string())? = Some(Editor::new(doc));
    Ok(info)
}

/// 打开一份 .kin 工程。
#[tauri::command]
fn open_project(state: State<'_, AppState>, path: String) -> Result<DocInfo, String> {
    let doc = Doc::load(&path)?;
    let info = doc.info();
    *state
        .inner
        .lock()
        .map_err(|_| "内部状态异常".to_string())? = Some(Editor::new(doc));
    Ok(info)
}

/// 保存到指定路径；工程会记住这个路径，下次「保存」直接覆盖。
#[tauri::command]
fn save_project(state: State<'_, AppState>, path: String) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        ed.doc.save(&path)?;
        ed.doc.path = Some(path.clone());
        ed.doc.dirty = false;
        Ok(ed.doc.info())
    })
}

/// 重命名当前工程（另存为之后同步标题用）。
#[tauri::command]
fn rename_project(state: State<'_, AppState>, name: String) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        ed.doc.name = name;
        Ok(ed.doc.info())
    })
}

/// 整幅画面（当前画格），用于打开工程、切画格、切图层后的重绘。
#[tauri::command]
fn read_full(state: State<'_, AppState>) -> Result<Response, String> {
    with_editor(&state, |ed| {
        let rect = doc::Rect {
            x: 0,
            y: 0,
            w: ed.doc.width,
            h: ed.doc.height,
        };
        let pixels = ed.doc.composite_rect(ed.doc.current_frame, rect, None, ed.onion);
        Ok(packet(rect, pixels))
    })
}

/// 读取一块矩形。缩放与视口移动时按需取，不整幅重传。
#[tauri::command]
fn read_region(
    state: State<'_, AppState>,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
) -> Result<Response, String> {
    with_editor(&state, |ed| {
        let rect = clamp_rect(x as usize, y as usize, w as usize, h as usize, ed.doc.width, ed.doc.height);
        let pixels = ed.doc.composite_rect(ed.doc.current_frame, rect, None, ed.onion);
        Ok(packet(rect, pixels))
    })
}

fn clamp_rect(
    x: usize,
    y: usize,
    w: usize,
    h: usize,
    doc_w: usize,
    doc_h: usize,
) -> doc::Rect {
    let x = x.min(doc_w);
    let y = y.min(doc_h);
    let w = w.min(doc_w - x);
    let h = h.min(doc_h - y);
    doc::Rect { x, y, w, h }
}

/// 落笔。返回第一个笔尖点的脏矩形。
#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn begin_stroke(
    state: State<'_, AppState>,
    x: f32,
    y: f32,
    pressure: f32,
    color: String,
    size: f32,
    hardness: f32,
    opacity: f32,
    erase: bool,
) -> Result<Response, String> {
    with_editor(&state, |ed| {
        let rgb = parse_hex_color(&color)?;
        let Some(layer) = ed.doc.layers.iter().find(|l| l.id == ed.doc.active_layer_id) else {
            return Err("当前图层不存在".to_string());
        };
        if layer.locked {
            return Err("当前图层已锁定，先在右侧解锁".to_string());
        }
        if !layer.visible {
            return Err("当前图层已隐藏，先打开可见性".to_string());
        }
        let frame = ed.doc.current_frame;
        let mut stroke = Stroke::new(
            layer.id,
            frame,
            ed.doc.width,
            ed.doc.height,
            rgb,
            size,
            hardness,
            opacity,
            erase,
            x,
            y,
            pressure,
        );
        let rect = stroke.take_segment();
        ed.stroke = Some(stroke);
        let pixels = ed
            .doc
            .composite_rect(frame, rect, ed.stroke.as_ref(), ed.onion);
        Ok(packet(rect, pixels))
    })
}

/// 拖动中：把这批采样点补成连续笔迹，返回新增脏矩形。
#[tauri::command]
fn stroke_to(
    state: State<'_, AppState>,
    x: f32,
    y: f32,
    pressure: f32,
) -> Result<Response, String> {
    with_editor(&state, |ed| {
        let Some(stroke) = ed.stroke.as_mut() else {
            return Ok(packet(doc::Rect::default(), Vec::new()));
        };
        stroke.add_point(x, y, pressure);
        let rect = stroke.take_segment();
        if rect.is_empty() {
            return Ok(packet(rect, Vec::new()));
        }
        let frame = stroke.frame;
        let pixels = ed.doc.composite_rect(frame, rect, ed.stroke.as_ref(), ed.onion);
        Ok(packet(rect, pixels))
    })
}

/// 抬笔：把笔迹合进图层，记一步撤销，返回最终脏矩形。
#[tauri::command]
fn end_stroke(state: State<'_, AppState>) -> Result<Response, String> {
    with_editor(&state, |ed| {
        let Some(stroke) = ed.stroke.take() else {
            return Ok(packet(doc::Rect::default(), Vec::new()));
        };
        let rect = stroke.bounds();
        if rect.is_empty() {
            return Ok(packet(rect, Vec::new()));
        }
        let width = ed.doc.width;
        let Some(layer) = ed.doc.layers.iter_mut().find(|l| l.id == stroke.layer_id) else {
            return Ok(packet(doc::Rect::default(), Vec::new()));
        };
        let Some(frame) = layer.frames.get_mut(stroke.frame) else {
            return Ok(packet(doc::Rect::default(), Vec::new()));
        };
        let before = doc::copy_rect(frame, width, rect);
        stroke.merge_into(frame, width);
        let after = doc::copy_rect(frame, width, rect);
        ed.undo.push(Patch {
            layer_id: stroke.layer_id,
            frame: stroke.frame,
            rect,
            before,
            after,
        });
        if ed.undo.len() > UNDO_LIMIT {
            ed.undo.remove(0);
        }
        ed.redo.clear();
        ed.doc.dirty = true;
        let pixels = ed
            .doc
            .composite_rect(stroke.frame, rect, None, ed.onion);
        Ok(packet(rect, pixels))
    })
}

/// Esc / 切工具时丢弃当前笔迹（笔迹只存在于笔缓冲，没写进图层）。
#[tauri::command]
fn cancel_stroke(state: State<'_, AppState>) -> Result<(), String> {
    with_editor(&state, |ed| {
        ed.stroke = None;
        Ok(())
    })
}

/// 撤销一步，返回被还原的矩形。
#[tauri::command]
fn undo(state: State<'_, AppState>) -> Result<Response, String> {
    with_editor(&state, |ed| {
        let Some(patch) = ed.undo.pop() else {
            return Ok(packet(doc::Rect::default(), Vec::new()));
        };
        let rect = ed.restore(&patch, true);
        // 补丁所属画格与当前画格不同时，前端看到的仍是当前画格：
        // 整幅重给当前画格，别把别的画格的像素贴进来。
        let (rect, pixels) = if patch.frame == ed.doc.current_frame {
            let pixels = ed.doc.composite_rect(patch.frame, rect, None, ed.onion);
            (rect, pixels)
        } else {
            let full = doc::Rect {
                x: 0,
                y: 0,
                w: ed.doc.width,
                h: ed.doc.height,
            };
            let pixels = ed.doc.composite_rect(ed.doc.current_frame, full, None, ed.onion);
            (full, pixels)
        };
        ed.redo.push(patch);
        ed.doc.dirty = true;
        Ok(packet(rect, pixels))
    })
}

/// 重做一步，返回被还原的矩形。
#[tauri::command]
fn redo(state: State<'_, AppState>) -> Result<Response, String> {
    with_editor(&state, |ed| {
        let Some(patch) = ed.redo.pop() else {
            return Ok(packet(doc::Rect::default(), Vec::new()));
        };
        let rect = ed.restore(&patch, false);
        let (rect, pixels) = if patch.frame == ed.doc.current_frame {
            let pixels = ed.doc.composite_rect(patch.frame, rect, None, ed.onion);
            (rect, pixels)
        } else {
            let full = doc::Rect {
                x: 0,
                y: 0,
                w: ed.doc.width,
                h: ed.doc.height,
            };
            let pixels = ed.doc.composite_rect(ed.doc.current_frame, full, None, ed.onion);
            (full, pixels)
        };
        ed.undo.push(patch);
        ed.doc.dirty = true;
        Ok(packet(rect, pixels))
    })
}

/// 当前画格指定矩形（撤销后如果需要整块刷新，前端可调用）。
#[tauri::command]
fn layer_thumb(
    state: State<'_, AppState>,
    layer_id: u32,
    max: u32,
) -> Result<Response, String> {
    with_editor(&state, |ed| {
        let frame = ed.doc.current_frame;
        let (rect, pixels) = ed.doc.layer_thumb(layer_id, frame, max as usize);
        Ok(packet(rect, pixels))
    })
}

#[tauri::command]
fn add_layer(state: State<'_, AppState>, name: String) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        ed.doc.add_layer(&name);
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn delete_layer(state: State<'_, AppState>, layer_id: u32) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        ed.doc.delete_layer(layer_id)?;
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn move_layer(state: State<'_, AppState>, layer_id: u32, dir: i32) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        ed.doc.move_layer(layer_id, dir);
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn set_active_layer(state: State<'_, AppState>, layer_id: u32) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        ed.doc.active_layer_id = layer_id;
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn set_layer_visible(
    state: State<'_, AppState>,
    layer_id: u32,
    visible: bool,
) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        if let Some(l) = ed.doc.layers.iter_mut().find(|l| l.id == layer_id) {
            l.visible = visible;
        }
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn set_layer_locked(
    state: State<'_, AppState>,
    layer_id: u32,
    locked: bool,
) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        if let Some(l) = ed.doc.layers.iter_mut().find(|l| l.id == layer_id) {
            l.locked = locked;
        }
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn set_layer_opacity(
    state: State<'_, AppState>,
    layer_id: u32,
    opacity: f32,
) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        if let Some(l) = ed.doc.layers.iter_mut().find(|l| l.id == layer_id) {
            l.opacity = opacity.clamp(0.0, 1.0);
        }
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn rename_layer(
    state: State<'_, AppState>,
    layer_id: u32,
    name: String,
) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        if let Some(l) = ed.doc.layers.iter_mut().find(|l| l.id == layer_id) {
            l.name = name;
        }
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn add_frame(state: State<'_, AppState>, duplicate: bool) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        ed.doc.add_frame(duplicate);
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn set_frame(state: State<'_, AppState>, index: u32) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        ed.doc.current_frame = (index as usize).min(ed.doc.frame_count.saturating_sub(1));
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn set_onion(state: State<'_, AppState>, enabled: bool) -> Result<DocInfo, String> {
    with_editor(&state, |ed| {
        ed.onion = enabled;
        Ok(ed.doc.info())
    })
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).is_file()
}

/// 退出应用。欢迎页与编辑壳的「退出」都走这一条，关窗后不留进程。
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: &'static str,
    version: &'static str,
    platform: &'static str,
    license: &'static str,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "Kinexa",
        version: env!("CARGO_PKG_VERSION"),
        platform: std::env::consts::OS,
        license: "MIT",
    }
}

/// 启动应用。
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            inner: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            new_project,
            open_project,
            save_project,
            rename_project,
            read_full,
            read_region,
            begin_stroke,
            stroke_to,
            end_stroke,
            cancel_stroke,
            undo,
            redo,
            layer_thumb,
            add_layer,
            delete_layer,
            move_layer,
            set_active_layer,
            set_layer_visible,
            set_layer_locked,
            set_layer_opacity,
            rename_layer,
            add_frame,
            set_frame,
            set_onion,
            file_exists,
            exit_app,
            app_info
        ])
        .run(tauri::generate_context!())
        .expect("Kinexa 启动失败");
}

