//! 工程数据与像素合成。
//!
//! 一份工程 = 一张画布 + 一叠图层，每个图层按画格各存一份 RGBA 缓冲。
//! 图层顺序约定：`layers[0]` 在最下面，越往后越靠上。
//! 像素一律直通 alpha（非预乘）：R/G/B 与 A 分开存，合成时现算。

use std::fs;
use std::io::{Read, Write};

use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};

use crate::paint::Stroke;

const MAGIC: &[u8; 8] = b"KINEXA01";
const VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, Default)]
pub struct Rect {
    pub x: usize,
    pub y: usize,
    pub w: usize,
    pub h: usize,
}

impl Rect {
    pub fn is_empty(&self) -> bool {
        self.w == 0 || self.h == 0
    }

    /// 把两块矩形并起来（用于整笔结束时的总脏区）。
    pub fn union(self, other: Rect) -> Rect {
        if self.is_empty() {
            return other;
        }
        if other.is_empty() {
            return self;
        }
        let x0 = self.x.min(other.x);
        let y0 = self.y.min(other.y);
        let x1 = (self.x + self.w).max(other.x + other.w);
        let y1 = (self.y + self.h).max(other.y + other.h);
        Rect {
            x: x0,
            y: y0,
            w: x1 - x0,
            h: y1 - y0,
        }
    }
}

/// 按行从整幅缓冲里拷出一块矩形。
pub fn copy_rect(buf: &[u8], stride_w: usize, rect: Rect) -> Vec<u8> {
    let mut out = Vec::with_capacity(rect.w * rect.h * 4);
    for row in 0..rect.h {
        let off = ((rect.y + row) * stride_w + rect.x) * 4;
        out.extend_from_slice(&buf[off..off + rect.w * 4]);
    }
    out
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerInfo {
    pub id: u32,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub opacity: f32,
}

#[derive(Clone)]
pub struct Layer {
    pub id: u32,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub opacity: f32,
    /// 每个画格一份 RGBA 缓冲，长度 = width * height * 4
    pub frames: Vec<Vec<u8>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocInfo {
    pub name: String,
    pub path: Option<String>,
    pub width: usize,
    pub height: usize,
    pub fps: u32,
    pub frame_count: usize,
    pub current_frame: usize,
    pub active_layer_id: u32,
    pub layers: Vec<LayerInfo>,
}

pub struct Doc {
    pub name: String,
    pub path: Option<String>,
    pub width: usize,
    pub height: usize,
    pub fps: u32,
    pub frame_count: usize,
    pub current_frame: usize,
    pub active_layer_id: u32,
    /// 纸面底色。白纸工程是 [255,255,255,255]，透明工程是 [0,0,0,0]。
    /// 底色不烘进图层，这样橡皮擦掉的是笔迹，露出来的是纸面。
    pub bg: [u8; 4],
    pub layers: Vec<Layer>,
    pub next_layer_id: u32,
    pub dirty: bool,
}

impl Doc {
    pub fn blank(width: usize, height: usize, name: &str, fps: u32, transparent: bool) -> Doc {
        let bg = if transparent {
            [0u8, 0, 0, 0]
        } else {
            [255u8, 255, 255, 255]
        };
        Doc {
            name: name.to_string(),
            path: None,
            width,
            height,
            fps,
            frame_count: 1,
            current_frame: 0,
            active_layer_id: 1,
            bg,
            layers: vec![Layer {
                id: 1,
                name: "图层 1".to_string(),
                visible: true,
                locked: false,
                opacity: 1.0,
                frames: vec![vec![0u8; width * height * 4]],
            }],
            next_layer_id: 2,
            dirty: false,
        }
    }

    pub fn info(&self) -> DocInfo {
        DocInfo {
            name: self.name.clone(),
            path: self.path.clone(),
            width: self.width,
            height: self.height,
            fps: self.fps,
            frame_count: self.frame_count,
            current_frame: self.current_frame,
            active_layer_id: self.active_layer_id,
            layers: self
                .layers
                .iter()
                .map(|l| LayerInfo {
                    id: l.id,
                    name: l.name.clone(),
                    visible: l.visible,
                    locked: l.locked,
                    opacity: l.opacity,
                })
                .collect(),
        }
    }

    fn blank_frame(&self) -> Vec<u8> {
        vec![0u8; self.width * self.height * 4]
    }

    pub fn add_layer(&mut self, name: &str) {
        let id = self.next_layer_id;
        self.next_layer_id += 1;
        let frames = vec![self.blank_frame(); self.frame_count];
        self.layers.push(Layer {
            id,
            name: if name.trim().is_empty() {
                format!("图层 {}", id)
            } else {
                name.to_string()
            },
            visible: true,
            locked: false,
            opacity: 1.0,
            frames,
        });
        self.active_layer_id = id;
        self.dirty = true;
    }

    pub fn delete_layer(&mut self, id: u32) -> Result<(), String> {
        if self.layers.len() <= 1 {
            return Err("至少要保留一个图层".to_string());
        }
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return Err("图层不存在".to_string());
        };
        self.layers.remove(idx);
        if self.active_layer_id == id {
            let fallback = idx.min(self.layers.len() - 1);
            self.active_layer_id = self.layers[fallback].id;
        }
        self.dirty = true;
        Ok(())
    }

    pub fn move_layer(&mut self, id: u32, dir: i32) {
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return;
        };
        let target = idx as i32 + dir;
        if target < 0 || target >= self.layers.len() as i32 {
            return;
        }
        self.layers.swap(idx, target as usize);
        self.dirty = true;
    }

    /// 在当前画格之后插入一张新画格；`duplicate` 为真时复制当前画格。
    pub fn add_frame(&mut self, duplicate: bool) {
        let at = self.current_frame + 1;
        for layer in &mut self.layers {
            let buf = if duplicate {
                layer.frames[self.current_frame].clone()
            } else {
                vec![0u8; self.width * self.height * 4]
            };
            layer.frames.insert(at, buf);
        }
        self.frame_count += 1;
        self.current_frame = at;
        self.dirty = true;
    }

    /// 合成一块矩形。`stroke` 存在时先把笔迹（画笔或橡皮）作用在它所属图层上。
    /// `onion` 为真时，把前一画格染红、后一画格染蓝，垫在当前画格下面。
    pub fn composite_rect(
        &self,
        frame: usize,
        rect: Rect,
        stroke: Option<&Stroke>,
        onion: bool,
    ) -> Vec<u8> {
        let mut out = vec![0u8; rect.w * rect.h * 4];
        if rect.is_empty() {
            return out;
        }
        let frame = frame.min(self.frame_count.saturating_sub(1));
        for row in 0..rect.h {
            for col in 0..rect.w {
                let gx = rect.x + col;
                let gy = rect.y + row;
                let mut acc_r = self.bg[0] as f32;
                let mut acc_g = self.bg[1] as f32;
                let mut acc_b = self.bg[2] as f32;
                let mut acc_a = self.bg[3] as f32 / 255.0;

                if onion {
                    // 前一格红、后一格蓝：只取轮廓，不叠细节，避免抢当前画格。
                    let marks = [
                        (frame.checked_sub(1), [255.0f32, 92.0, 104.0], 0.30f32),
                        (
                            if frame + 1 < self.frame_count {
                                Some(frame + 1)
                            } else {
                                None
                            },
                            [72.0f32, 168.0, 255.0],
                            0.22f32,
                        ),
                    ];
                    for (mark, tint, strength) in marks {
                        let Some(mark) = mark else { continue };
                        let mut mark_a = 0.0f32;
                        for layer in &self.layers {
                            if !layer.visible || layer.opacity <= 0.0 {
                                continue;
                            }
                            let off = (gy * self.width + gx) * 4;
                            if let Some(px) =
                                layer.frames.get(mark).and_then(|f| f.get(off..off + 4))
                            {
                                mark_a = mark_a.max(px[3] as f32 / 255.0 * layer.opacity);
                            }
                        }
                        if mark_a <= 0.0 {
                            continue;
                        }
                        let sa = mark_a * strength;
                        let out_a = sa + acc_a * (1.0 - sa);
                        if out_a > 0.0 {
                            acc_r = (tint[0] * sa + acc_r * acc_a * (1.0 - sa)) / out_a;
                            acc_g = (tint[1] * sa + acc_g * acc_a * (1.0 - sa)) / out_a;
                            acc_b = (tint[2] * sa + acc_b * acc_a * (1.0 - sa)) / out_a;
                        }
                        acc_a = out_a;
                    }
                }

                for layer in &self.layers {
                    if !layer.visible || layer.opacity <= 0.0 {
                        continue;
                    }
                    let off = (gy * self.width + gx) * 4;
                    let Some(px) = layer.frames.get(frame).and_then(|f| f.get(off..off + 4)) else {
                        continue;
                    };
                    let mut sr = px[0] as f32;
                    let mut sg = px[1] as f32;
                    let mut sb = px[2] as f32;
                    let mut sa = px[3] as f32 / 255.0;

                    if let Some(st) = stroke {
                        if st.layer_id == layer.id {
                            let cov = st.coverage(gx, gy);
                            if cov > 0.0 {
                                if st.erase {
                                    sa *= 1.0 - cov;
                                } else {
                                    let out_a = cov + sa * (1.0 - cov);
                                    if out_a > 0.0 {
                                        sr = (st.color[0] as f32 * cov
                                            + sr * sa * (1.0 - cov))
                                            / out_a;
                                        sg = (st.color[1] as f32 * cov
                                            + sg * sa * (1.0 - cov))
                                            / out_a;
                                        sb = (st.color[2] as f32 * cov
                                            + sb * sa * (1.0 - cov))
                                            / out_a;
                                    }
                                    sa = out_a;
                                }
                            }
                        }
                    }

                    let sa = sa * layer.opacity;
                    if sa <= 0.0 {
                        continue;
                    }
                    let out_a = sa + acc_a * (1.0 - sa);
                    if out_a > 0.0 {
                        acc_r = (sr * sa + acc_r * acc_a * (1.0 - sa)) / out_a;
                        acc_g = (sg * sa + acc_g * acc_a * (1.0 - sa)) / out_a;
                        acc_b = (sb * sa + acc_b * acc_a * (1.0 - sa)) / out_a;
                    }
                    acc_a = out_a;
                }
                let i = (row * rect.w + col) * 4;
                out[i] = acc_r.round().clamp(0.0, 255.0) as u8;
                out[i + 1] = acc_g.round().clamp(0.0, 255.0) as u8;
                out[i + 2] = acc_b.round().clamp(0.0, 255.0) as u8;
                out[i + 3] = (acc_a * 255.0).round().clamp(0.0, 255.0) as u8;
            }
        }
        out
    }

    /// 单个图层的缩略图（等比缩到 max 见方），返回尺寸与像素。
    pub fn layer_thumb(&self, id: u32, frame: usize, max: usize) -> (Rect, Vec<u8>) {
        let max = max.max(8);
        let scale = (max as f32 / self.width as f32)
            .min(max as f32 / self.height as f32)
            .min(1.0);
        let w = (self.width as f32 * scale).round().max(1.0) as usize;
        let h = (self.height as f32 * scale).round().max(1.0) as usize;
        let rect = Rect { x: 0, y: 0, w, h };
        let Some(layer) = self.layers.iter().find(|l| l.id == id) else {
            return (rect, vec![0u8; w * h * 4]);
        };
        let Some(src) = layer.frames.get(frame.min(self.frame_count - 1)) else {
            return (rect, vec![0u8; w * h * 4]);
        };
        let mut out = vec![0u8; w * h * 4];
        for y in 0..h {
            let sy = ((y as f32 + 0.5) / scale) as usize;
            for x in 0..w {
                let sx = ((x as f32 + 0.5) / scale) as usize;
                if sx >= self.width || sy >= self.height {
                    continue;
                }
                let s = (sy * self.width + sx) * 4;
                let d = (y * w + x) * 4;
                out[d] = src[s];
                out[d + 1] = src[s + 1];
                out[d + 2] = src[s + 2];
                out[d + 3] = src[s + 3];
            }
        }
        (rect, out)
    }

    /// 保存 .kin：magic + JSON 头 + 逐画格逐图层的 zlib 缓冲。
    pub fn save(&self, path: &str) -> Result<(), String> {
        let header = HeaderV1 {
            version: VERSION,
            name: self.name.clone(),
            width: self.width,
            height: self.height,
            fps: self.fps,
            frame_count: self.frame_count,
            current_frame: self.current_frame,
            active_layer: self.active_layer_id,
            background: self.bg,
            layers: self
                .layers
                .iter()
                .map(|l| LayerMeta {
                    id: l.id,
                    name: l.name.clone(),
                    visible: l.visible,
                    locked: l.locked,
                    opacity: l.opacity,
                })
                .collect(),
        };
        let header_bytes =
            serde_json::to_vec(&header).map_err(|e| format!("工程头序列化失败：{e}"))?;

        let mut out = Vec::new();
        out.extend_from_slice(MAGIC);
        out.extend_from_slice(&(header_bytes.len() as u32).to_le_bytes());
        out.extend_from_slice(&header_bytes);

        for layer in &self.layers {
            for frame in &layer.frames {
                let mut enc =
                    ZlibEncoder::new(Vec::new(), Compression::new(4));
                enc.write_all(frame)
                    .map_err(|e| format!("画格压缩失败：{e}"))?;
                let comp = enc
                    .finish()
                    .map_err(|e| format!("画格压缩失败：{e}"))?;
                out.extend_from_slice(&(frame.len() as u32).to_le_bytes());
                out.extend_from_slice(&(comp.len() as u32).to_le_bytes());
                out.extend_from_slice(&comp);
            }
        }

        if let Some(parent) = std::path::Path::new(path).parent() {
            if !parent.as_os_str().is_empty() && !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("保存失败：建不了目录（{e}）"))?;
            }
        }
        fs::write(path, &out).map_err(|e| format!("保存失败：{e}"))?;
        Ok(())
    }

    pub fn load(path: &str) -> Result<Doc, String> {
        let mut f = fs::File::open(path).map_err(|e| format!("打不开工程文件：{e}"))?;
        let mut bytes = Vec::new();
        f.read_to_end(&mut bytes)
            .map_err(|e| format!("读取工程失败：{e}"))?;
        if bytes.len() < 12 || &bytes[0..8] != MAGIC {
            return Err("这不是 Kinexa 工程文件（缺少 .kin 标识）".to_string());
        }
        let header_len = u32::from_le_bytes(bytes[8..12].try_into().unwrap()) as usize;
        if bytes.len() < 12 + header_len {
            return Err("工程文件已损坏：头部长度不合法".to_string());
        }
        let header: HeaderV1 = serde_json::from_slice(&bytes[12..12 + header_len])
            .map_err(|e| format!("工程头解析失败：{e}"))?;
        if header.version != VERSION {
            return Err(format!(
                "工程版本 {} 暂不支持（当前只认 {}）",
                header.version, VERSION
            ));
        }
        if header.width == 0 || header.height == 0 || header.width > 8192 || header.height > 8192 {
            return Err("工程尺寸不合法".to_string());
        }
        if header.frame_count == 0 || header.layers.is_empty() {
            return Err("工程里没有图层或画格".to_string());
        }

        let mut cursor = 12 + header_len;
        let mut layers = Vec::with_capacity(header.layers.len());
        for meta in &header.layers {
            let mut frames = Vec::with_capacity(header.frame_count);
            for _ in 0..header.frame_count {
                if cursor + 8 > bytes.len() {
                    return Err("工程文件已损坏：画格数据不完整".to_string());
                }
                let raw_len =
                    u32::from_le_bytes(bytes[cursor..cursor + 4].try_into().unwrap()) as usize;
                let comp_len = u32::from_le_bytes(
                    bytes[cursor + 4..cursor + 8].try_into().unwrap(),
                ) as usize;
                cursor += 8;
                if cursor + comp_len > bytes.len() {
                    return Err("工程文件已损坏：画格数据越界".to_string());
                }
                let mut dec = ZlibDecoder::new(&bytes[cursor..cursor + comp_len]);
                let mut raw = Vec::with_capacity(raw_len);
                dec.read_to_end(&mut raw)
                    .map_err(|e| format!("画格解压失败：{e}"))?;
                if raw.len() != header.width * header.height * 4 {
                    return Err("画格尺寸与工程尺寸对不上".to_string());
                }
                frames.push(raw);
                cursor += comp_len;
            }
            layers.push(Layer {
                id: meta.id,
                name: meta.name.clone(),
                visible: meta.visible,
                locked: meta.locked,
                opacity: meta.opacity,
                frames,
            });
        }

        let next_layer_id = layers.iter().map(|l| l.id).max().unwrap_or(0) + 1;
        Ok(Doc {
            name: header.name,
            path: Some(path.to_string()),
            width: header.width,
            height: header.height,
            fps: header.fps,
            frame_count: header.frame_count,
            current_frame: header.current_frame.min(header.frame_count - 1),
            bg: header.background,
            active_layer_id: layers
                .iter()
                .find(|l| l.id == header.active_layer)
                .map(|l| l.id)
                .unwrap_or(layers[layers.len() - 1].id),
            layers,
            next_layer_id,
            dirty: false,
        })
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeaderV1 {
    version: u32,
    name: String,
    width: usize,
    height: usize,
    fps: u32,
    frame_count: usize,
    current_frame: usize,
    active_layer: u32,
    /// 旧工程没有这一项，按白纸处理。
    #[serde(default = "default_bg")]
    background: [u8; 4],
    layers: Vec<LayerMeta>,
}

fn default_bg() -> [u8; 4] {
    [255, 255, 255, 255]
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LayerMeta {
    id: u32,
    name: String,
    visible: bool,
    locked: bool,
    opacity: f32,
}
