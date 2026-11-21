//! 笔迹光栅化。
//!
//! 画笔是一枚软边圆章：按采样点距离插值，沿路径连续盖章。
//! 同一笔内用「取最大值」合并覆盖度，避免来回涂时越涂越黑；
//! 抬笔时才把这层覆盖度合进图层，并留下撤销用的矩形快照。
//!
//! 这里不做矢量求值，也不碰界面——只收坐标与压力，吐像素。

use tauri::ipc::Response;

use crate::doc::Rect;

/// 统一的二进制包：4 个 u32 头（x / y / w / h）+ RGBA 像素。
/// 前端按小端读取，避免 base64 把延迟白白吃掉。
pub fn packet(rect: Rect, pixels: Vec<u8>) -> Response {
    let mut out = Vec::with_capacity(20 + pixels.len());
    out.extend_from_slice(&(rect.x as u32).to_le_bytes());
    out.extend_from_slice(&(rect.y as u32).to_le_bytes());
    out.extend_from_slice(&(rect.w as u32).to_le_bytes());
    out.extend_from_slice(&(rect.h as u32).to_le_bytes());
    out.extend_from_slice(&pixels);
    Response::new(out)
}

pub struct Stroke {
    pub layer_id: u32,
    pub frame: usize,
    width: usize,
    height: usize,
    /// 整幅画布大小的覆盖度缓冲（直通 RGBA，A 通道是覆盖度）
    buf: Vec<u8>,
    pub color: [u8; 3],
    size: f32,
    hardness: f32,
    opacity: f32,
    pub erase: bool,
    last_x: f32,
    last_y: f32,
    last_p: f32,
    segment: Rect,
    bounds: Rect,
}

impl Stroke {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        layer_id: u32,
        frame: usize,
        width: usize,
        height: usize,
        color: [u8; 3],
        size: f32,
        hardness: f32,
        opacity: f32,
        erase: bool,
        x: f32,
        y: f32,
        pressure: f32,
    ) -> Stroke {
        let mut s = Stroke {
            layer_id,
            frame,
            width,
            height,
            buf: vec![0u8; width * height * 4],
            color,
            size: size.clamp(1.0, 400.0),
            hardness: hardness.clamp(0.0, 1.0),
            opacity: opacity.clamp(0.0, 1.0),
            erase,
            last_x: x,
            last_y: y,
            last_p: pressure.clamp(0.0, 1.0),
            segment: Rect::default(),
            bounds: Rect::default(),
        };
        s.stamp(x, y, s.last_p);
        s
    }

    /// 当前这一段的脏矩形（每次取完即清空）。
    pub fn take_segment(&mut self) -> Rect {
        std::mem::replace(&mut self.segment, Rect::default())
    }

    /// 整笔的脏矩形。
    pub fn bounds(&self) -> Rect {
        self.bounds
    }

    /// 某像素上的覆盖度（已乘笔的不透明度）。
    pub fn coverage(&self, x: usize, y: usize) -> f32 {
        if x >= self.width || y >= self.height {
            return 0.0;
        }
        let a = self.buf[(y * self.width + x) * 4 + 3] as f32 / 255.0;
        a * self.opacity
    }

    /// 追一个采样点：按距离补中间章，压力线性过渡。
    pub fn add_point(&mut self, x: f32, y: f32, pressure: f32) {
        let p = pressure.clamp(0.0, 1.0);
        let dx = x - self.last_x;
        let dy = y - self.last_y;
        let dist = (dx * dx + dy * dy).sqrt();
        if dist < 0.05 && (p - self.last_p).abs() < 0.02 {
            return;
        }
        let radius = self.radius(self.last_p).max(self.radius(p));
        let step = (radius * 0.16).max(0.55);
        let count = (dist / step).ceil().max(1.0);
        let n = count as usize;
        for i in 1..=n {
            let t = i as f32 / n as f32;
            let cx = self.last_x + dx * t;
            let cy = self.last_y + dy * t;
            let cp = self.last_p + (p - self.last_p) * t;
            self.stamp(cx, cy, cp);
        }
        self.last_x = x;
        self.last_y = y;
        self.last_p = p;
    }

    fn radius(&self, pressure: f32) -> f32 {
        // 压力小则细，鼠标（恒定 1.0）就是完整直径
        (self.size * 0.5) * (0.35 + 0.65 * pressure)
    }

    fn stamp(&mut self, cx: f32, cy: f32, pressure: f32) {
        let r = self.radius(pressure).max(0.35);
        let edge = if self.hardness >= 0.995 {
            1.0
        } else {
            (r * (1.0 - self.hardness)).max(0.6)
        };
        let inner = (r - edge).max(0.0);
        let x0 = ((cx - r - 1.0).floor().max(0.0)) as usize;
        let y0 = ((cy - r - 1.0).floor().max(0.0)) as usize;
        let x1 = ((cx + r + 1.0).ceil()).min(self.width as f32) as usize;
        let y1 = ((cy + r + 1.0).ceil()).min(self.height as f32) as usize;
        if x0 >= x1 || y0 >= y1 {
            return;
        }

        for y in y0..y1 {
            for x in x0..x1 {
                let dx = x as f32 + 0.5 - cx;
                let dy = y as f32 + 0.5 - cy;
                let d = (dx * dx + dy * dy).sqrt();
                if d >= r {
                    continue;
                }
                let mut a = if d <= inner {
                    1.0
                } else {
                    (r - d) / (r - inner)
                };
                // 平滑边缘，避免出现硬台阶
                a = a * a * (3.0 - 2.0 * a);
                let alpha = (a * 255.0).round() as u8;
                if alpha == 0 {
                    continue;
                }
                let idx = (y * self.width + x) * 4;
                if alpha > self.buf[idx + 3] {
                    self.buf[idx + 3] = alpha;
                    self.buf[idx] = self.color[0];
                    self.buf[idx + 1] = self.color[1];
                    self.buf[idx + 2] = self.color[2];
                }
            }
        }

        let rect = Rect {
            x: x0,
            y: y0,
            w: x1 - x0,
            h: y1 - y0,
        };
        self.segment = self.segment.union(rect);
        self.bounds = self.bounds.union(rect);
    }

    /// 把覆盖度合进图层。矩形外不动。
    pub fn merge_into(&self, frame: &mut [u8], stride_w: usize) {
        let rect = self.bounds;
        if rect.is_empty() {
            return;
        }
        for y in rect.y..rect.y + rect.h {
            for x in rect.x..rect.x + rect.w {
                let cov = self.coverage(x, y);
                if cov <= 0.0 {
                    continue;
                }
                let idx = (y * stride_w + x) * 4;
                if self.erase {
                    let da = frame[idx + 3] as f32 / 255.0;
                    frame[idx + 3] = ((da * (1.0 - cov)) * 255.0).round() as u8;
                } else {
                    let da = frame[idx + 3] as f32 / 255.0;
                    let out_a = cov + da * (1.0 - cov);
                    if out_a > 0.0 {
                        let sr = self.color[0] as f32;
                        let sg = self.color[1] as f32;
                        let sb = self.color[2] as f32;
                        frame[idx] = ((sr * cov + frame[idx] as f32 * da * (1.0 - cov)) / out_a)
                            .round()
                            .clamp(0.0, 255.0) as u8;
                        frame[idx + 1] =
                            ((sg * cov + frame[idx + 1] as f32 * da * (1.0 - cov)) / out_a)
                                .round()
                                .clamp(0.0, 255.0) as u8;
                        frame[idx + 2] =
                            ((sb * cov + frame[idx + 2] as f32 * da * (1.0 - cov)) / out_a)
                                .round()
                                .clamp(0.0, 255.0) as u8;
                        frame[idx + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
                    }
                }
            }
        }
    }
}
