// 3D オフィス（AI Assistant）
// 執行役と部署のロボットが机で働く様子を three.js で描く。
// 画面側（index.html）とは window.Office3D.update(...) / window.onOfficeSelect(...) でやりとりする。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CHARACTERS, DEFAULTS, DEPT_KIT, NAME_MAX, buddyKitParts } from './characters.js';

const DEFAULT_BOARD_TITLE = 'My AI Assistant';
let boardTitle = DEFAULT_BOARD_TITLE;
const STATUS_COLOR = { working: '#19b77a', waiting: '#f0a020', done: '#3d7be0', idle: '#a3adbb' };
const STATUS_LABEL = { working: '作業中', waiting: '返答待ち', done: '完了', idle: '待機' };

// ---------- 素材 ----------
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, ...o });
const MAT = {
  shell: std('#f5f7fb', { roughness: 0.28 }),
  dark: std('#2a303c', { roughness: 0.55 }),
  joint: std('#1b1f27', { roughness: 0.4, metalness: 0.2 }),
  visor: std('#05070c', { roughness: 0.1, metalness: 0.4 }),
  eye: new THREE.MeshBasicMaterial({ color: '#7fe6ff' }),
  eyeDim: new THREE.MeshBasicMaterial({ color: '#2f7f99' }),
  glow: new THREE.MeshBasicMaterial({ color: '#5fd0ff' }),
  wood: std('#dcc6a6', { roughness: 0.6 }),
  woodDark: std('#8a6a4a', { roughness: 0.55 }),
  metal: std('#9aa3b0', { roughness: 0.35, metalness: 0.6 }),
  laptop: std('#c9ced6', { roughness: 0.3, metalness: 0.5 }),
  white: std('#ffffff', { roughness: 0.5 }),
};
const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };

// 役割ごとの服装と小物（参考画像のキャラクターに合わせる）
const OUTFIT = {
  executive:  { torso: '#1f2a44', kind: 'suit', tie: '#2f5bd6' },
  planning:   { torso: '#f5f7fb', kind: 'robot', glasses: true, beret: '#26324a', lanyard: true },
  sales:      { torso: '#2b303b', kind: 'suit', tie: '#2f5bd6' },
  marketing:  { torso: '#f6bfd0', kind: 'hoodie', antenna: true, megaphone: true },
  hr:         { torso: '#eef1f6', kind: 'shirt', bun: true, lanyard: true },
  accounting: { torso: '#f5f7fb', kind: 'robot', glasses: true },
  support:    { torso: '#f5f7fb', kind: 'robot', mic: true },
  designer:   { torso: '#f5f7fb', kind: 'robot', beret: '#26324a', pen: true },
  programmer: { torso: '#f5f7fb', kind: 'robot', mug: true },
  analyst:    { torso: '#2c3a55', kind: 'vest', holo: true },
};

// ---------- 画面（モニター）の絵 ----------
function makeScreen(w = 256, h = 160) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return { c, ctx: c.getContext('2d'), tex, w, h };
}
// 文字を幅に合わせて折り返す（日本語は1文字ずつ測る）。入りきらなければ最後の行を「…」で切る
function wrapText(ctx, text, maxW, maxLines) {
  const chars = Array.from(String(text || '').replace(/\s+/g, ' ').trim());
  const lines = []; let cur = ''; let i = 0;
  for (; i < chars.length; i++) {
    const next = cur + chars[i];
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur); cur = chars[i];
      if (lines.length === maxLines) { cur = ''; break; }
    } else cur = next;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (i < chars.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = last + '…';
  }
  return lines;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const JP = "'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif";

// 机の手前の画面：部署名・状態・いまの仕事・直近の動き・件数
function drawScreen(s, status, t, info = {}) {
  const { ctx, w, h } = s;
  const color = info.color || '#3b4a6b';
  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#111a2a'); bg.addColorStop(1, '#0a101b');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // 見出し帯（部署の色）
  const hh = Math.round(h * 0.2);
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, hh);
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `800 ${Math.round(hh * 0.5)}px ${JP}`; ctx.fillText(info.name || '', 30, hh / 2 + 2);
  // 状態のしるし
  const label = { working: '作業中', waiting: '返答待ち', done: '完了', idle: '待機' }[status];
  ctx.font = `700 ${Math.round(hh * 0.4)}px ${JP}`;
  const lw = ctx.measureText(label).width + 70, lh = hh * 0.66;
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; roundRect(ctx, w - lw - 24, (hh - lh) / 2, lw, lh, lh / 2); ctx.fill();
  ctx.fillStyle = STATUS_COLOR[status];
  const blink = status === 'working' ? 0.55 + 0.45 * Math.abs(Math.sin(t * 3)) : 1;
  ctx.globalAlpha = blink; ctx.beginPath(); ctx.arc(w - lw - 24 + 30, hh / 2, lh * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#1d2738'; ctx.fillText(label, w - lw - 24 + 52, hh / 2 + 2);
  // いまの仕事（件名）
  let y = hh + 26;
  ctx.textBaseline = 'top';
  const tSize = Math.round(h * 0.115);
  ctx.font = `700 ${tSize}px ${JP}`; ctx.fillStyle = info.title ? '#ffffff' : '#6c7a8f';
  for (const line of wrapText(ctx, info.title || 'いまは仕事がありません', w - 60, 2)) { ctx.fillText(line, 30, y); y += tSize * 1.22; }
  // 直近の動き
  y += 6;
  const sSize = Math.round(h * 0.075);
  ctx.font = `500 ${sSize}px ${JP}`; ctx.fillStyle = '#a9bdd3';
  for (const line of wrapText(ctx, info.sub || '', w - 60, 2)) { ctx.fillText(line, 30, y); y += sSize * 1.3; }
  // 件数
  const c = info.counts || {};
  const by = h - Math.round(h * 0.13);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, by - 10, w, h - by + 10);
  ctx.font = `700 ${Math.round(h * 0.07)}px ${JP}`; ctx.textBaseline = 'middle';
  let x = 30; const cy = by + (h - by) / 2 - 4;
  for (const k of ['working', 'waiting', 'done']) {
    ctx.fillStyle = STATUS_COLOR[k]; ctx.beginPath(); ctx.arc(x + 10, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9e3ef'; const txt = `${{ working: '作業中', waiting: '返答待ち', done: '完了' }[k]} ${c[k] || 0}`;
    ctx.fillText(txt, x + 28, cy); x += ctx.measureText(txt).width + 70;
  }
  // 作業中は下に流れる進行バー
  if (status === 'working') {
    const bw = w * 0.28, bx = ((t * 0.45) % 1.3) * w - bw;
    const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, 'rgba(25,183,122,0)'); gr.addColorStop(0.5, '#19b77a'); gr.addColorStop(1, 'rgba(25,183,122,0)');
    ctx.fillStyle = gr; ctx.fillRect(bx, h - 8, bw, 8);
  }
  s.tex.needsUpdate = true;
}

// ---------- 椅子（ロボットと人型の担当で共通。形は1つだけ作って使い回す） ----------
const CHAIR_GEO = {
  seat: new THREE.BoxGeometry(0.74, 0.1, 0.62), back: new THREE.BoxGeometry(0.76, 0.86, 0.1),
  post: new THREE.CylinderGeometry(0.04, 0.04, 0.45), base: new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20),
};
function makeChair() {
  const chair = new THREE.Group(); chair.userData.chair = true;
  const seat = mesh(CHAIR_GEO.seat, MAT.dark); seat.position.set(0, 0.52, 0);
  const back = mesh(CHAIR_GEO.back, MAT.dark); back.position.set(0, 1.0, -0.34);
  const post = mesh(CHAIR_GEO.post, MAT.metal); post.position.y = 0.27;
  const base = mesh(CHAIR_GEO.base, MAT.metal); base.position.y = 0.04;
  for (const m of [seat, back, post, base]) m.userData.sharedGeo = true;
  chair.add(seat, back, post, base);
  return chair;
}

// ---------- ロボット ----------
function makeRobot(role, scale = 1) {
  const o = OUTFIT[role] || OUTFIT.programmer;
  const root = new THREE.Group();
  const torsoMat = std(o.torso, { roughness: o.kind === 'robot' ? 0.28 : 0.6 });

  root.add(makeChair());

  // 胴体
  const body = new THREE.Group(); body.position.y = 0.58; root.add(body);
  const torso = mesh(new THREE.CapsuleGeometry(0.3, 0.34, 8, 20), torsoMat);
  torso.position.y = 0.44; torso.scale.set(1.05, 1, 0.82); body.add(torso);
  if (o.kind === 'suit') {
    const shirt = mesh(new THREE.BoxGeometry(0.16, 0.34, 0.02), MAT.white); shirt.position.set(0, 0.6, 0.255); body.add(shirt);
    const tie = mesh(new THREE.BoxGeometry(0.06, 0.28, 0.02), std(o.tie)); tie.position.set(0, 0.58, 0.27); body.add(tie);
  } else if (o.kind === 'hoodie') {
    const hood = mesh(new THREE.TorusGeometry(0.22, 0.07, 10, 24), torsoMat); hood.position.set(0, 0.78, -0.08); hood.rotation.x = Math.PI / 2.3; body.add(hood);
    const pocket = mesh(new THREE.BoxGeometry(0.3, 0.12, 0.03), std('#eaa6bb')); pocket.position.set(0, 0.3, 0.255); body.add(pocket);
  } else if (o.kind === 'vest') {
    const collar = mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), MAT.white); collar.position.set(0, 0.74, 0.25); body.add(collar);
    const tie = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), MAT.joint); tie.position.set(0, 0.6, 0.265); body.add(tie);
  } else if (o.kind === 'robot') {
    for (const sx of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(0.06, 0.4, 0.3), MAT.joint); p.position.set(sx * 0.29, 0.46, 0); body.add(p); }
    const light = mesh(new THREE.CircleGeometry(0.035, 16), MAT.glow); light.position.set(0, 0.62, 0.252); body.add(light);
  }
  if (o.lanyard) {
    const strap = mesh(new THREE.TorusGeometry(0.15, 0.01, 6, 24, Math.PI), std('#2f5bd6')); strap.position.set(0, 0.72, 0.2); strap.rotation.set(0.35, 0, Math.PI); body.add(strap);
    const card = mesh(new THREE.BoxGeometry(0.1, 0.13, 0.015), MAT.white); card.position.set(0, 0.5, 0.27); body.add(card);
  }

  // 頭
  const head = new THREE.Group(); head.position.y = 1.18; body.add(head);
  const neck = mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 12), MAT.joint); neck.position.y = 0.95; body.add(neck);
  head.add(mesh(new THREE.SphereGeometry(0.44, 40, 32), MAT.shell));
  // 黒いバイザー（頭の前面から少し出る楕円）。表面は z≈0.47
  const visor = mesh(new THREE.SphereGeometry(0.4, 48, 32), MAT.visor); visor.scale.set(1.0, 0.78, 0.55); visor.position.z = 0.27; head.add(visor);
  // 目（3種類を切り替える）
  const eyes = { round: [], happy: [], sleepy: [] };
  for (const sx of [-1, 1]) {
    const round = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.07, 8, 16), MAT.eye); round.position.set(sx * 0.14, 0.03, 0.48); round.scale.z = 0.4;
    const happy = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.026, 10, 20, Math.PI), MAT.eye); happy.position.set(sx * 0.14, -0.01, 0.485);
    const sleepy = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.01), MAT.eyeDim); sleepy.position.set(sx * 0.14, 0.0, 0.485);
    head.add(round, happy, sleepy); eyes.round.push(round); eyes.happy.push(happy); eyes.sleepy.push(sleepy);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 14, Math.PI), MAT.eye); mouth.position.set(0, -0.13, 0.475); mouth.rotation.z = Math.PI; head.add(mouth);
  // ヘッドホン
  for (const sx of [-1, 1]) {
    const cup = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.11, 24), MAT.dark); cup.rotation.z = Math.PI / 2; cup.position.x = sx * 0.43; head.add(cup);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 28), MAT.glow); ring.rotation.y = Math.PI / 2; ring.position.x = sx * 0.49; head.add(ring);
  }
  const band = mesh(new THREE.TorusGeometry(0.45, 0.035, 8, 32, Math.PI), MAT.dark); head.add(band);
  // 小物
  if (o.glasses) {
    const gm = std('#3a4150', { roughness: 0.3, metalness: 0.5 });
    for (const sx of [-1, 1]) { const g = mesh(new THREE.TorusGeometry(0.1, 0.016, 8, 24), gm); g.position.set(sx * 0.14, 0.03, 0.505); head.add(g); }
    const br = mesh(new THREE.BoxGeometry(0.07, 0.016, 0.016), gm); br.position.set(0, 0.05, 0.51); head.add(br);
  }
  if (o.beret) {
    const b = mesh(new THREE.SphereGeometry(0.34, 24, 16), std(o.beret, { roughness: 0.8 })); b.scale.set(1.15, 0.38, 1.1); b.position.set(-0.05, 0.36, -0.02); b.rotation.z = 0.18; head.add(b);
    const nub = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06), std(o.beret)); nub.position.set(-0.08, 0.5, 0); head.add(nub);
  }
  if (o.bun) {
    const bun = mesh(new THREE.SphereGeometry(0.15, 20, 16), std('#15181e', { roughness: 0.7 })); bun.position.set(0, 0.48, -0.12); head.add(bun);
    const cap = mesh(new THREE.SphereGeometry(0.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3.2), std('#15181e', { roughness: 0.7 })); cap.position.y = 0.02; head.add(cap);
  }
  if (o.antenna) {
    const a = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22), MAT.dark); a.position.set(0, 0.54, 0); head.add(a);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff5470' })); tip.position.set(0, 0.67, 0); head.add(tip);
  }
  if (o.mic) {
    const arm = mesh(new THREE.TorusGeometry(0.25, 0.012, 6, 16, Math.PI / 2.2), MAT.dark); arm.position.set(0.3, -0.1, 0.12); arm.rotation.set(0, -0.6, -1.9); head.add(arm);
    const tip = mesh(new THREE.SphereGeometry(0.035, 12, 12), MAT.joint); tip.position.set(0.12, -0.25, 0.36); head.add(tip);
  }

  // 腕（肩を支点に回す）
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.36, 0.7, 0.02); body.add(pivot);
    const upper = mesh(new THREE.CapsuleGeometry(0.085, 0.3, 6, 12), o.kind === 'robot' ? MAT.shell : torsoMat); upper.position.y = -0.22; pivot.add(upper);
    const hand = mesh(new THREE.SphereGeometry(0.095, 16, 12), o.kind === 'robot' ? MAT.joint : MAT.shell); hand.position.y = -0.44; pivot.add(hand);
    arms.push(pivot);
  }
  if (o.megaphone) {
    const m = mesh(new THREE.ConeGeometry(0.12, 0.28, 20, 1, true), std('#ffffff', { side: THREE.DoubleSide })); m.rotation.x = Math.PI / 2; m.position.set(0, -0.52, 0.12); arms[0].add(m);
  }
  if (o.pen) {
    const p = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26), MAT.joint); p.position.set(0, -0.5, 0.06); p.rotation.x = 0.6; arms[1].add(p);
  }

  root.scale.setScalar(scale);
  // 状態で目と口を切り替える
  const setStatus = (status) => {
    eyes.round.forEach((m) => (m.visible = status === 'working' || status === 'waiting'));
    eyes.happy.forEach((m) => (m.visible = status === 'done'));
    eyes.sleepy.forEach((m) => (m.visible = status === 'idle'));
    mouth.visible = status !== 'idle';
  };
  return { root, body, head, arms, eyes, mouth, kind: o, baseY: 0.58, glowMats: [], ownsGeo: true, setStatus };
}

// ---------- キャラクター（assets/characters.js のデータから組み立てる） ----------
// 形（ジオメトリ）と色（素材）は同じものを使い回す。光る素材だけは状態で明るさを変えるので1体ずつ持つ
const CHAR = new Map(CHARACTERS.map((c) => [c.id, c]));
const GEO = new Map();
function partGeo(shape, size) {
  const k = shape + ':' + size.join(',');
  let g = GEO.get(k); if (g) return g;
  const [a = 0.1, b = 0.1, c = 0.1] = size;
  const seg = (r) => (r > 0.15 ? [28, 20] : r > 0.1 ? [28, 20] : r > 0.05 ? [22, 16] : [12, 10]);
  switch (shape) {
    case 'sphere': g = new THREE.SphereGeometry(a, ...seg(a)); break;
    case 'dome': g = new THREE.SphereGeometry(a, seg(a)[0], Math.max(4, seg(a)[1] / 2 | 0), 0, Math.PI * 2, 0, Math.PI / 2); break;
    case 'capsule': g = new THREE.CapsuleGeometry(a, b, 6, seg(a)[0]); break;
    case 'box': g = new THREE.BoxGeometry(a, b, c); break;
    case 'cylinder': g = new THREE.CylinderGeometry(a, b, c, seg(Math.max(a, b))[0]); break;
    case 'disc': g = new THREE.CylinderGeometry(a, a, b, seg(a)[0]); break;
    case 'cone': g = new THREE.ConeGeometry(a, b, seg(a)[0]); break;
    case 'torus': g = new THREE.TorusGeometry(a, b, 8, seg(a)[0], size[2] || Math.PI * 2); break;
    case 'ring': g = new THREE.TorusGeometry(a, b, 8, seg(a)[0] + 8, size[2] || Math.PI * 2); g.rotateX(Math.PI / 2); break;
    default: g = new THREE.SphereGeometry(a, 12, 8);
  }
  GEO.set(k, g); return g;
}
const tmpColor = new THREE.Color();
function tone(c, dept, hair) {
  if (c === 'dept') return dept;
  if (c === 'hair') return hair || '#15181e';
  if (c === 'deptDark') return '#' + tmpColor.set(dept).multiplyScalar(0.45).getHexString();
  if (c === 'deptLight') return '#' + tmpColor.set(dept).lerp(new THREE.Color('#ffffff'), 0.5).getHexString();
  return c || '#cccccc';
}
const PART_MAT = new Map();
function partMat(p, color, fig) {
  if (p.glow) {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: p.glow, roughness: 0.4 });
    m.userData.glow = p.glow; fig.glowMats.push(m); return m;
  }
  const k = [color, p.flat ? 'f' : '', p.rough ?? '', p.metal ?? '', p.shape === 'dome' ? 'd' : ''].join('|');
  let m = PART_MAT.get(k); if (m) return m;
  m = p.flat ? new THREE.MeshBasicMaterial({ color })
    : std(color, { roughness: p.rough ?? 0.5, metalness: p.metal ?? 0.05, side: p.shape === 'dome' ? THREE.DoubleSide : THREE.FrontSide });
  PART_MAT.set(k, m); return m;
}
const UP = new THREE.Vector3(0, 1, 0);
function addParts(parts, joints, dept, fig, hair) {
  for (const p of parts || []) {
    const targets = p.at === 'arms' ? ['armL', 'armR'] : [p.at || 'body'];
    for (const t of targets) for (const sx of (p.mirror ? [1, -1] : [1])) {
      const m = new THREE.Mesh(partGeo(p.shape, p.size || [0.1]), partMat(p, tone(p.color, dept, hair), fig));
      const [x = 0, y = 0, z = 0] = p.pos || [];
      m.position.set(x * sx, y, z);
      if (p.face) {
        m.quaternion.setFromUnitVectors(UP, new THREE.Vector3(p.face[0] * sx, p.face[1], p.face[2]).normalize());
        if (p.spin) m.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, p.spin * sx));
      } else {
        const [rx = 0, ry = 0, rz = 0] = p.rot || [];
        m.rotation.set(rx, ry * sx, rz * sx);
        if (p.spin) m.rotateY(p.spin * sx);
      }
      if (p.scale) m.scale.set(...p.scale);
      // 影を落とすのは大きめの部品だけ（小さな目や模様まで影を描くと重くなる）
      if (!p.flat) { m.receiveShadow = true; m.castShadow = Math.max(...(p.size || [0.1]).slice(0, 3)) >= 0.06; }
      if (p.show) { m.userData.show = p.show; fig.showParts.push(m); }
      (joints[t] || joints.body).add(m);
    }
  }
}
function showFor(fig, status) { for (const m of fig.showParts) m.visible = m.userData.show.includes(status); }
// 部署の小物（characters.js の DEPT_KIT）を、キャラの頭の大きさ（rig.fit.head）に合わせる
function fitKit(parts, f) {
  if (!f || f === 1) return parts;
  return parts.map((p) => (p.at === 'head' ? { ...p, pos: (p.pos || [0, 0, 0]).map((v) => v * f), scale: (p.scale || [1, 1, 1]).map((v) => v * f) } : p));
}
// 担当（人型など）：ロボットと同じ椅子・同じ高さに座り、同じ動き（腕・頭・体の揺れ）をする。
// 体の形はキャラ（def.parts）、小物は部署（DEPT_KIT[role]）から付ける
function buildSeated(def, scale, dept, role) {
  const rig = def.rig || {};
  const root = new THREE.Group();
  const fig = { root, glowMats: [], showParts: [], baseY: 0.58 };
  if (rig.chair !== false) root.add(makeChair());
  const body = new THREE.Group(); body.position.y = fig.baseY; root.add(body);
  const head = new THREE.Group(); head.position.y = rig.headY ?? 1.12; body.add(head);
  const [shx, shy, shz] = rig.shoulders || [0.33, 0.68, 0.02];
  const armL = new THREE.Group(); armL.position.set(-shx, shy, shz); body.add(armL);
  const armR = new THREE.Group(); armR.position.set(shx, shy, shz); body.add(armR);
  const kit = DEPT_KIT[role] || {}, hides = new Set(kit.hides || []), fit = rig.fit || {};
  const parts = (def.parts || []).filter((p) => !(p.slot && hides.has(p.slot)))
    .map((p) => (kit.top && p.slot === 'top' && /^dept/.test(p.color || '') ? { ...p, color: tone(p.color, kit.top) } : p))
    .concat(fitKit(kit.staff || [], fit.head));
  addParts(parts, { root, body, head, armL, armR }, dept, fig, fit.hair);
  root.scale.setScalar(scale * (rig.scale ?? 1));
  return Object.assign(fig, { body, head, arms: [armL, armR], setStatus: (s) => showFor(fig, s) });
}
// 相棒：体（body）全体が弾む・傾く。rig.joints の部品は motion（flapL/flapR＝羽ばたき、wag＝ふりふり、tilt＝首かしげ、
// wave＝手をふる、nod＝うなずき、swish＝左右、spin＝回る）で動く。rot＝動く前の向き、amp＝動きの大きさ、phase＝ずらし。
// 首輪・部署の飾りは rig.neck / rig.top に自動で付く（characters.js の buddyKitParts）
function buildBuddy(def, dept, role) {
  const rig = def.rig || {};
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const fig = { root, body, glowMats: [], showParts: [], joints: [], buddy: true };
  const joints = { root, body };
  for (const [name, j] of Object.entries(rig.joints || {})) {
    const g = new THREE.Group(); g.position.set(...(j.pos || [0, 0, 0])); if (j.rot) g.rotation.set(...j.rot); body.add(g);
    joints[name] = g; fig.joints.push({ g, motion: j.motion || 'none', amp: j.amp ?? 1, phase: j.phase || 0, base: g.rotation.clone() });
  }
  addParts((def.parts || []).concat(buddyKitParts(role, rig)), joints, dept, fig);
  root.scale.setScalar(rig.scale ?? 1);
  fig.setStatus = (s) => showFor(fig, s);
  return fig;
}
const SHARED_MATS = new Set(Object.values(MAT));
function disposeFig(fig) {
  if (!fig) return;
  for (const m of fig.glowMats) m.dispose();
  if (fig.ownsGeo) fig.root.traverse((o) => {
    if (!o.isMesh || o.userData.sharedGeo) return;
    o.geometry.dispose(); if (!SHARED_MATS.has(o.material)) o.material.dispose();
  });
}

// ---------- 机 ----------
function makeDesk(o, big = false) {
  const g = new THREE.Group();
  const w = big ? 2.3 : 1.75, d = big ? 1.0 : 0.85;
  const top = mesh(new THREE.BoxGeometry(w, 0.07, d), big ? MAT.woodDark : MAT.wood); top.position.y = 0.8; g.add(top);
  for (const sx of [-1, 1]) {
    const leg = mesh(new THREE.BoxGeometry(0.06, 0.78, d * 0.9), MAT.metal); leg.position.set(sx * (w / 2 - 0.08), 0.4, 0); g.add(leg);
  }
  if (big) { const front = mesh(new THREE.BoxGeometry(w - 0.1, 0.55, 0.04), MAT.woodDark); front.position.set(0, 0.5, d / 2 - 0.05); g.add(front); }
  // ノートPC（ロボット側を向く。カメラからは背面のロゴが見える）
  const lap = new THREE.Group(); lap.position.set(0, 0.84, -0.05); g.add(lap);
  const baseL = mesh(new THREE.BoxGeometry(0.62, 0.025, 0.4), MAT.laptop); lap.add(baseL);
  const lid = new THREE.Group(); lid.position.set(0, 0.0, 0.2); lid.rotation.x = -0.28; lap.add(lid);
  const lidM = mesh(new THREE.BoxGeometry(0.62, 0.42, 0.02), MAT.laptop); lidM.position.y = 0.21; lid.add(lidM);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), new THREE.MeshBasicMaterial({ color: '#19b77a' })); logo.position.set(0, 0.22, 0.012); lid.add(logo);
  // 机の前面を覆う画面（こちら向き）。上の辺を天板の高さに合わせ、床の近くまで下がる。
  // 部署がいまやっている内容を表示する
  const pw = w - 0.04, ph = 0.7, bottom = 0.1;
  const screen = makeScreen(1024, Math.round(1024 * ph / pw));
  const mon = new THREE.Group(); mon.position.set(0, 0, d / 2 + 0.035); g.add(mon);
  const frame = mesh(new THREE.BoxGeometry(pw + 0.06, ph + 0.06, 0.05), MAT.joint); frame.position.y = bottom + ph / 2; mon.add(frame);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false })); scr.position.set(0, bottom + ph / 2, 0.027); mon.add(scr);
  // 机の上の小物
  if (o.mug !== false) { const mug = mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.12, 16), MAT.joint); mug.position.set(-w / 2 + 0.3, 0.9, 0.2); g.add(mug); }
  const papers = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.22), MAT.white); papers.position.set(-w / 2 + 0.35, 0.85, -0.18); papers.rotation.y = 0.2; g.add(papers);
  return { group: g, screen, logo };
}

function makePlant(scale = 1) {
  const g = new THREE.Group();
  const pot = mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.36, 20), MAT.white); pot.position.y = 0.18; g.add(pot);
  const leafMat = std('#5aa86a', { roughness: 0.8 });
  for (let i = 0; i < 7; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.2, 12, 10), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.17, 0.55 + (i % 3) * 0.14, Math.sin(a) * 0.17); leaf.scale.set(1, 1.3, 0.7);
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// ---------- 窓の外の景色（昼＝ライト／夜＝ダーク） ----------
// 画像は使わず canvas に描く。昼と夜は同じ乱数の種・同じ順番で乱数を引くので、ビルや塔の配置はまったく同じで、
// 色の塗り方だけが変わる（夜：雲のある紺の空・窓明かり・赤い航空灯・オレンジの塔／昼：青空・ガラスの反射・赤白の塔）。
// ※ 乱数を引く回数を昼夜で変えないこと（配置がずれる）
const NIGHT_SPAN = 50;                 // パノラマが受け持つ壁の長さ（左の壁 20 ＋ 奥の壁 30）
const NIGHT_W = 7168, NIGHT_H = 400;   // 縦横比を窓の見え方（長さ 50 : 高さ 2.8）に合わせる
function drawPanorama(ctx, W, H, night) {
  let seed = 20261019;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  // 空
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  if (night) { sky.addColorStop(0, '#070a12'); sky.addColorStop(0.35, '#0e1424'); sky.addColorStop(0.62, '#1b2236'); sky.addColorStop(0.8, '#2a2a3c'); sky.addColorStop(1, '#2a2a3c'); }
  else { sky.addColorStop(0, '#4f9be6'); sky.addColorStop(0.4, '#86bdf0'); sky.addColorStop(0.7, '#c4e0f8'); sky.addColorStop(1, '#e2eefa'); }
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // 雲：ぼかした楕円（昼は3つに1つだけ描いて「少しの雲」に）
  ctx.save(); ctx.filter = night ? 'blur(7px)' : 'blur(9px)';
  for (let i = 0; i < 140; i++) {
    const x = rnd() * W, y = rnd() * H * 0.42, rw = 120 + rnd() * 520, rh = 10 + rnd() * 34;
    const r = 70 + rnd() * 30 | 0, g = 78 + rnd() * 30 | 0, b = 100 + rnd() * 30 | 0, a = 0.1 + rnd() * 0.16;
    if (!night && i % 3) continue;
    ctx.fillStyle = night ? `rgba(${r},${g},${b},${a})` : `rgba(255,255,255,${a * 3.2})`;
    ctx.beginPath(); ctx.ellipse(x, y, rw / 2, rh / 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  const LIT = night
    ? { white: ['#f2f5fb', '#dfe7f5', '#ffffff'], warm: ['#ffd27a', '#ffc35c', '#ffe2a6'], blue: ['#8fc0ff', '#6fa8ff', '#b5d6ff'] }
    : { white: ['#dfe8f2', '#cfdbe8', '#eef3f8'], warm: ['#9fb0c2', '#8ea1b6', '#b3c1cf'], blue: ['#9cc4ec', '#8ab6e2', '#b8d5f2'] };  // 昼は窓明かりでなくガラスの映り込み
  const BODY = night ? ['#121826', '#151b2a', '#10151f', '#181e2d', '#1a2030'] : ['#8fa3b8', '#9fb1c4', '#8297ad', '#adbccb', '#97aabd'];
  const tint = () => { const r = rnd(); return r < 0.45 ? 'white' : r < 0.78 ? 'warm' : 'blue'; };
  const aviation = (x, y) => {
    if (night) { const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, 'rgba(255,60,50,.9)'); g.addColorStop(1, 'rgba(255,60,50,0)'); ctx.fillStyle = g; ctx.fillRect(x - 9, y - 9, 18, 18); }
    ctx.fillStyle = night ? '#ff4a3d' : '#d8392c'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  };
  // ビル1棟：本体と窓のマス目。tall のときは屋上に航空灯
  const tower = (x, top, w, base, o = {}) => {
    const body = o.body || pick(BODY);
    ctx.fillStyle = body; ctx.fillRect(x, top, w, base - top);
    if (!night) { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(0.45, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(40,60,90,.18)'); ctx.fillStyle = g; ctx.fillRect(x, top, w, base - top); }
    const t = o.tint || tint(), cw = o.cw || (5 + (rnd() * 3 | 0)), ch = o.ch || (5 + (rnd() * 2 | 0));
    const density = o.density ?? (0.35 + rnd() * 0.45);
    for (let y = top + 4; y < base - 2; y += ch) {
      const floorOn = rnd() < 0.9;
      for (let xx = x + 2; xx < x + w - 3; xx += cw) {
        if (!floorOn || rnd() > density) continue;
        const c = rnd() < 0.82 ? t : tint();
        const a = 0.55 + rnd() * 0.45; const col = pick(LIT[c]);
        ctx.globalAlpha = night ? a : a * 0.45; ctx.fillStyle = col; ctx.fillRect(xx, y, cw - 2, ch - 2);
      }
    }
    ctx.globalAlpha = 1;
    if (o.crown) { const col = pick(LIT[o.crown]); ctx.fillStyle = night ? col : '#e8eef5'; ctx.globalAlpha = 0.85; ctx.fillRect(x, top, w, 3); ctx.globalAlpha = 1; }
    if (o.tall) for (const ax of (w > 40 ? [x + 3, x + w - 4] : [x + w / 2])) aviation(ax, top - 2);
  };
  // 奥の低い街並み（地平線あたり）
  for (let x = 0; x < W; x += 6 + rnd() * 18) tower(x, H * (0.56 + rnd() * 0.12), 10 + rnd() * 26, H, { body: night ? '#0f141e' : '#a9b7c6', cw: 4, ch: 4, density: 0.3 });
  // 高層ビル：背の高い順に描く（低いビルが手前に重なる）
  const towers = [];
  for (let i = 0; i < 150; i++) {
    const cluster = rnd() < 0.7;
    const cx = cluster ? pick([0.08, 0.22, 0.37, 0.52, 0.6, 0.74, 0.86, 0.95]) * W + (rnd() - 0.5) * 520 : rnd() * W;
    const top = H * (cluster ? 0.14 + rnd() * 0.4 : 0.38 + rnd() * 0.22);
    towers.push({ x: cx, top, w: 34 + rnd() * 90 });
  }
  towers.sort((a, b) => a.top - b.top);
  for (const t of towers) { const crown = rnd() < 0.25 ? pick(['blue', 'white']) : null; tower(t.x, t.top, t.w, H, { tall: t.top < H * 0.42, crown }); }
  // 右寄りの塔（夜はオレンジに光る／昼は赤白の塗り分け）。奥の壁の右の窓に入る位置
  const tx = W * 0.905, tb = H * 0.9, tt = H * 0.1;
  const halfW = (y) => 4 + Math.pow((y - tt) / (tb - tt), 2.2) * 58;
  if (night) { const glow = ctx.createRadialGradient(tx, H * 0.5, 10, tx, H * 0.5, 230); glow.addColorStop(0, 'rgba(255,140,40,.28)'); glow.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = glow; ctx.fillRect(tx - 240, 0, 480, H); }
  const RED = '#e2462c', WHITE = '#f4f1ec';
  const bandCol = (y) => (night ? '#ff9a2e' : (Math.floor((y - tt) / ((tb - tt) / 7)) % 2 ? WHITE : RED));  // 昼は上から赤白7段
  ctx.lineWidth = 2.2;
  for (const side of [-1, 1]) for (let y = tt + 30; y < tb; y += 3) { ctx.strokeStyle = bandCol(y); ctx.beginPath(); ctx.moveTo(tx + side * halfW(y), y); ctx.lineTo(tx + side * halfW(y + 3), y + 3); ctx.stroke(); }
  ctx.lineWidth = 1.2;
  for (let y = tt + 40; y < tb; y += 12) {
    const y2 = Math.min(tb, y + 12); ctx.strokeStyle = night ? 'rgba(255,170,70,.9)' : bandCol(y);
    ctx.beginPath(); ctx.moveTo(tx - halfW(y), y); ctx.lineTo(tx + halfW(y2), y2); ctx.moveTo(tx + halfW(y), y); ctx.lineTo(tx - halfW(y2), y2); ctx.stroke();
  }
  ctx.fillStyle = night ? 'rgba(255,190,110,.55)' : 'rgba(226,70,44,.5)'; ctx.beginPath(); ctx.moveTo(tx - halfW(tt + 30), tt + 30); ctx.lineTo(tx + halfW(tt + 30), tt + 30); ctx.lineTo(tx + halfW(tb), tb); ctx.lineTo(tx - halfW(tb), tb); ctx.closePath();
  ctx.globalAlpha = night ? 0.35 : 0.22; ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = night ? '#ffd08a' : WHITE;
  for (const [y, hw] of [[H * 0.6, halfW(H * 0.6) + 6], [H * 0.36, halfW(H * 0.36) + 4]]) { ctx.fillRect(tx - hw, y, hw * 2, 6); if (!night) { ctx.fillStyle = '#9aa6b2'; ctx.fillRect(tx - hw, y + 4, hw * 2, 2); ctx.fillStyle = WHITE; } }
  ctx.strokeStyle = night ? '#ffb560' : RED; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, tt); ctx.lineTo(tx, tt + 32); ctx.stroke();
  aviation(tx, tt);
  // 手前の街並み：低い建物の帯に、細かい点（夜は街明かり／昼は屋根や窓の細かな明暗）
  ctx.fillStyle = night ? '#0b0e17' : '#8e9bab'; ctx.fillRect(0, H * 0.84, W, H * 0.16);
  const FG = night ? ['#0c1019', '#0e121c', '#10141f'] : ['#98a5b4', '#a7b2bf', '#8a97a7'];
  for (let x = 0; x < W; x += 8 + rnd() * 26) { ctx.fillStyle = pick(FG); ctx.fillRect(x, H * (0.78 + rnd() * 0.07), 14 + rnd() * 30, H); }
  const DOT = night ? LIT : { white: ['#eef2f6', '#dde4eb', '#ffffff'], warm: ['#c9b9a4', '#b9a891', '#d8cbb8'], blue: ['#6f7f92', '#7d8da0', '#62728a'] };
  for (let i = 0; i < 26000; i++) {
    const y = H * (0.8 + Math.pow(rnd(), 0.8) * 0.2), x = rnd() * W, c = pick(['white', 'warm', 'warm', 'blue']);
    const a = 0.35 + rnd() * 0.6, col = pick(DOT[c]), sz = 1.5 + rnd() * 1.5;
    ctx.globalAlpha = night ? a : a * 0.7; ctx.fillStyle = col; ctx.fillRect(x, y, sz, 1.5);
  }
  ctx.globalAlpha = 1;
  // 通りの筋（夜はオレンジの光／昼は明るい道路）
  ctx.strokeStyle = night ? 'rgba(255,170,80,.35)' : 'rgba(235,238,242,.45)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) { const x = rnd() * W, y = H * (0.88 + rnd() * 0.1); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 80 + rnd() * 260, y + (rnd() - 0.5) * 6); ctx.stroke(); }
  // 昼は地平線あたりを少しかすませて奥行きを出す（乱数は使わない）
  if (!night) { const hz = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.8); hz.addColorStop(0, 'rgba(226,238,250,0)'); hz.addColorStop(1, 'rgba(226,238,250,.28)'); ctx.fillStyle = hz; ctx.fillRect(0, H * 0.45, W, H * 0.35); }
}

// ---------- 床（明るい木目のフローリング） ----------
// 1枚のテクスチャ＝床 4m × 4m 分。板は幅 0.2m（20段）・長さ 1.0〜2.0m で、段ごとに継ぎ目をずらす。
// 横は端で折り返して描き、縦は段がちょうど割り切れるので、くり返しの継ぎ目が出ない
function drawWoodFloor(ctx, W, H) {
  let seed = 7310;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ROWS = 20, rh = H / ROWS, BASE = [[222, 190, 146], [214, 180, 136], [228, 198, 156], [218, 186, 140], [208, 174, 128]];
  const plank = (x, y, w, c) => {
    // 板の地色＋木目（ゆるく波打つ細い線）＋ときどき小さな節
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(x, y, w, rh);
    const lines = 7 + (rnd() * 6 | 0), ph = rnd() * 6.28, amp = 0.6 + rnd() * 1.8;
    for (let i = 0; i < lines; i++) {
      const yy = y + 2 + (i + rnd() * 0.6) * (rh - 4) / lines, dark = rnd() < 0.5;
      ctx.strokeStyle = dark ? `rgba(120,80,40,${0.08 + rnd() * 0.1})` : `rgba(255,240,215,${0.08 + rnd() * 0.08})`;
      ctx.lineWidth = 0.6 + rnd() * 1.1; ctx.beginPath();
      for (let xx = 0; xx <= w; xx += 8) ctx.lineTo(x + xx, yy + Math.sin(xx / (40 + i * 7) + ph + i) * amp);
      ctx.stroke();
    }
    if (rnd() < 0.18) { const kx = x + 20 + rnd() * Math.max(1, w - 40), ky = y + rh * (0.3 + rnd() * 0.4); ctx.fillStyle = 'rgba(130,85,40,.28)'; ctx.beginPath(); ctx.ellipse(kx, ky, 5 + rnd() * 5, 2 + rnd() * 2, 0, 0, 6.29); ctx.fill(); }
    ctx.fillStyle = 'rgba(95,62,30,.35)'; ctx.fillRect(x, y, 1.5, rh);           // 板の端の継ぎ目
  };
  for (let r = 0; r < ROWS; r++) {
    // 段ごとに、ずらした位置 x0 からちょうど1周分（幅 W）だけ板を並べる。左にはみ出した板は右端にも同じ絵で描く（折り返し）
    const y = r * rh, x0 = -rnd() * W * 0.4, end = x0 + W; let x = x0;
    while (x < end - 1) {
      let w = W * (0.25 + rnd() * 0.25); if (end - (x + w) < W * 0.12) w = end - x;
      const c = BASE[rnd() * BASE.length | 0].map((v) => v + (rnd() * 12 - 6 | 0));
      const s0 = seed; plank(x, y, w, c);
      if (x < 0) { const s1 = seed; seed = s0; plank(x + W, y, w, c); seed = s1; }
      x += w;
    }
    ctx.fillStyle = 'rgba(95,62,30,.3)'; ctx.fillRect(0, y, W, 1.5);               // 段の継ぎ目
  }
}

// ---------- 部屋 ----------
// ダークモードで色を変える物（buildRoom で入れる）。昼＝ライト、夜のオフィス＝ダーク
const ROOM = {};
function buildRoom(scene) {
  const floorTex = canvasTex(1024, 1024, drawWoodFloor);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(30 / 4, 20 / 4);
  floorTex.anisotropy = 8;  // 斜めから見ても木目がにじまないように
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 }));
  ROOM.floor = floor.material;
  floor.rotation.x = -Math.PI / 2; floor.position.z = -0.5; floor.receiveShadow = true; scene.add(floor);

  const wallMat = std('#f2f5f9', { roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(30, 4.8, 0.2), wallMat); back.position.set(0, 2.4, -10.5); back.receiveShadow = true; scene.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.8, 20), wallMat); left.position.set(-15, 2.4, -0.5); left.receiveShadow = true; scene.add(left);
  const skirting = std('#c9d2df');
  ROOM.wall = wallMat; ROOM.skirting = skirting;
  const sk1 = new THREE.Mesh(new THREE.BoxGeometry(30, 0.16, 0.24), skirting); sk1.position.set(0, 0.08, -10.38); scene.add(sk1);
  const sk2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 20), skirting); sk2.position.set(-14.88, 0.08, -0.5); scene.add(sk2);

  // 窓の外：昼と夜のパノラマ（同じ配置）。初めて使うときに描く（使わない方の分のメモリを取らない）
  const panoTex = {};
  const getPano = (night) => panoTex[night ? 'night' : 'day'] || (panoTex[night ? 'night' : 'day'] = canvasTex(NIGHT_W, NIGHT_H, (c, w, h) => drawPanorama(c, w, h, night)));
  const glassMat = new THREE.MeshBasicMaterial({ color: '#cfe3f7' });  // パノラマを描くまでの仮の色
  const frameMat = std('#cfd8e4');
  Object.assign(ROOM, { glass: glassMat, getPano, frame: frameMat, windows: [] });
  const addWindow = (x, y, z, w, h, rotY = 0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat); g.add(glass);
    // パノラマ上の位置：左の壁は手前(z=9.5)から奥へ 0〜20、奥の壁は左(x=-15)から右へ 20〜50
    const sMid = rotY ? (9.5 - z) : (20 + x + 15);
    ROOM.windows.push({ mesh: glass, u0: (sMid - w / 2) / NIGHT_SPAN, du: w / NIGHT_SPAN, mats: {} });
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.08, 0.08), frameMat); fr.position.y = -h / 2; g.add(fr);
    const fr2 = fr.clone(); fr2.position.y = h / 2; g.add(fr2);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), frameMat); g.add(mid);
    scene.add(g);
  };
  addWindow(-10.5, 2.6, -10.39, 5.2, 2.8); addWindow(-5.2, 2.6, -10.39, 3.2, 2.8);
  addWindow(5.2, 2.6, -10.39, 3.2, 2.8); addWindow(10.5, 2.6, -10.39, 5.2, 2.8);
  addWindow(-14.89, 2.6, -6.0, 5.0, 2.8, Math.PI / 2); addWindow(-14.89, 2.6, 0.0, 5.0, 2.8, Math.PI / 2); addWindow(-14.89, 2.6, 6.0, 5.0, 2.8, Math.PI / 2);

  // 執行役の後ろのホワイトボード。看板の文字は設定の表示名（window.Office3D.setTitle で替える。既定は boardTitle）
  const drawBoard = (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2f5bd6'; ctx.lineWidth = 8; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(40, 240); ctx.lineTo(150, 180); ctx.lineTo(240, 205); ctx.lineTo(360, 110); ctx.lineTo(460, 60); ctx.stroke();
    ctx.fillStyle = '#2f5bd6'; ctx.beginPath(); ctx.moveTo(470, 50); ctx.lineTo(440, 60); ctx.lineTo(460, 85); ctx.fill();
    ctx.fillStyle = '#19b77a'; [70, 150, 230, 310].forEach((x, i) => ctx.fillRect(x, 270 - (i + 1) * 22, 40, (i + 1) * 22));
    ctx.fillStyle = '#1d2738'; ctx.font = 'bold 30px sans-serif'; ctx.fillText(boardTitle, 40, 50, w - 80);
  };
  const boardTex = canvasTex(512, 300, drawBoard);
  ROOM.redrawBoard = () => { const c = boardTex.image; drawBoard(c.getContext('2d'), c.width, c.height); boardTex.needsUpdate = true; };
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1), new THREE.MeshBasicMaterial({ map: boardTex }));
  ROOM.board = board.material;
  board.position.set(0, 2.6, -10.39); scene.add(board);
  const bframe = new THREE.Mesh(new THREE.BoxGeometry(3.75, 2.25, 0.05), std('#b9c3d0')); bframe.position.set(0, 2.6, -10.42); scene.add(bframe);

  // 執行役のステージとラグ
  const stage = mesh(new THREE.BoxGeometry(6.4, 0.16, 3.6), std('#dfe6ef', { roughness: 0.7 })); stage.position.set(0, 0.08, -7.9); scene.add(stage);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), std('#c9dbf5', { roughness: 1 }));
  ROOM.stage = stage.material; ROOM.rug = rug.material; rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.165, -7.9); rug.receiveShadow = true; scene.add(rug);

  // 通路の床ライン（席と席の間を広く見せる）
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 15), std('#dde6f1', { roughness: 1 }));
  ROOM.aisle = aisle.material; aisle.rotation.x = -Math.PI / 2; aisle.position.set(0, 0.005, 2.0); aisle.receiveShadow = true; scene.add(aisle);

  // 手前右の休憩スペース（ソファとテーブル）
  const lounge = new THREE.Group(); lounge.position.set(11.2, 0, 7.0); lounge.rotation.y = -0.6; scene.add(lounge);
  const sofaMat = std('#8fb3e0', { roughness: 0.85 });
  const seatS = mesh(new THREE.BoxGeometry(3.0, 0.45, 1.0), sofaMat); seatS.position.y = 0.3; lounge.add(seatS);
  const backS = mesh(new THREE.BoxGeometry(3.0, 0.75, 0.25), sofaMat); backS.position.set(0, 0.7, -0.45); lounge.add(backS);
  for (const sx of [-1, 1]) { const arm = mesh(new THREE.BoxGeometry(0.25, 0.6, 1.0), sofaMat); arm.position.set(sx * 1.5, 0.45, 0); lounge.add(arm); }
  const table = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 32), MAT.wood); table.position.set(0, 0.42, 1.3); lounge.add(table);
  const tleg = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4), MAT.metal); tleg.position.set(0, 0.2, 1.3); lounge.add(tleg);
  const loungeRug = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), std('#e6dccb', { roughness: 1 })); loungeRug.rotation.x = -Math.PI / 2; loungeRug.position.set(0, 0.006, 0.8); loungeRug.receiveShadow = true; lounge.add(loungeRug);

  // 観葉植物
  [[-14.2, -9.8, 1.5], [14.2, -9.8, 1.5], [-14.2, 9.0, 1.3], [-3.8, -9.9, 1.0], [3.8, -9.9, 1.0], [-7.8, -9.9, 0.9], [7.8, -9.9, 0.9], [13.8, 4.2, 1.2], [9.0, 8.8, 1.0], [-14.2, 3.0, 1.0]]
    .forEach(([x, z, s]) => { const p = makePlant(s); p.position.set(x, 0, z); scene.add(p); });
}

// ---------- 吹き出しラベル ----------
const ICON = {
  executive: '<path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 11a2.5 2.5 0 1 0 0-5M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c2.8.3 5 2.6 5 5.5"/>',
  planning: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12l7-7M16 5h3v3"/>',
  sales: '<path d="M2 12l4-4 4 2 4-3 4 3 4 2M6 12l4 4c1 1 2.5 1 3.5 0L18 12M9 15l2 2"/>',
  marketing: '<path d="M3 10v4h3l7 4V6L6 10H3zM16 9a4 4 0 0 1 0 6M19 7a7 7 0 0 1 0 10"/>',
  hr: '<path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a2.5 2.5 0 1 0 0-5M16 14c2.8.3 5 2.6 5 5.5"/>',
  accounting: '<circle cx="12" cy="12" r="9"/><path d="M8 7l4 5 4-5M12 12v6M9 13h6M9 16h6"/>',
  support: '<path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1v-4zM20 14h-3v5h2a1 1 0 0 0 1-1v-4zM17 19c0 1.5-2 2-5 2"/>',
  designer: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1-.8-1.4-.8-2.2 0-.8.7-1.3 1.6-1.3H17a4 4 0 0 0 4-4c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  programmer: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  analyst: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  general: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
};
const iconSvg = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id] || ICON.programmer}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function makeLabel(entry) {
  const anchor = document.createElement('div'); anchor.className = 'o3-anchor';
  const box = document.createElement('div'); box.className = 'o3-lbl'; anchor.appendChild(box);
  const bub = document.createElement('div'); bub.className = 'o3-bub'; box.appendChild(bub);
  const tag = document.createElement('button'); tag.type = 'button'; tag.className = 'o3-tag'; box.appendChild(tag);
  tag.addEventListener('click', (e) => { e.stopPropagation(); select(entry.key); });
  return { anchor, box, bub, tag };
}

// ---------- 本体 ----------
const host = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'o3-labels';
host.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#dfe8f3');
scene.fog = new THREE.Fog('#dfe8f3', 45, 85);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
// 「全体を見る」と初期表示：注視点は部屋の中心。見下ろす角度は従来と同じ φ=0.98。向きは θ=0（部屋の正面の真ん中から、奥の壁を真正面に見る）。
// 距離は画面の縦横比に合わせて、部屋の床の四隅と壁の上端が余白つきで収まるように毎回計算する（fitHome）
const target = new THREE.Vector3(0, 1.2, -0.5);
const HOME_DIR = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, 0.98, 0));
const HOME = { target: target.clone(), pos: target.clone().addScaledVector(HOME_DIR, 31), dist: 31 };
const ROOM_PTS = [[-15, 0, -10.5], [15, 0, -10.5], [-15, 0, 9.5], [15, 0, 9.5], [-15, 4.8, -10.5], [15, 4.8, -10.5], [-15, 4.8, 9.5]].map((v) => new THREE.Vector3(...v));
let atHome = true; // 利用者がまだカメラを動かしていない（または「全体を見る」の後）。このときは幅が変わったら合わせ直す
camera.position.copy(HOME.pos);
let camGoal = null; // { target, pos } に向かってなめらかに動く
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target); controls.enableDamping = true;
// 上は真上から、下は地面すれすれ（床の少し上）まで。左右は一周できる
controls.minDistance = 1.5; controls.maxDistance = 44; controls.minPolarAngle = 0.02; controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
// 3D CAD と同じ操作：左ドラッグ＝画面の横・縦に移動、右ドラッグ／Shift+左ドラッグ＝回転
// （OrbitControls は LEFT が PAN のとき、Shift/Ctrl/⌘ を押しながらの左ドラッグを回転に切り替える）
controls.enablePan = true; controls.screenSpacePanning = true; controls.panSpeed = 1.0;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.rotateSpeed = 0.8;
renderer.domElement.addEventListener('contextmenu', (ev) => ev.preventDefault()); // 右ドラッグでメニューを出さない
// ホイールは自前で処理する（下の「ホイールで寄る」）。OrbitControls の zoomToCursor は
// 寄るたびに回転の中心がずれて進路が曲がるため使わない
controls.enableZoom = false;
controls.update();

scene.add(new THREE.HemisphereLight('#ffffff', '#b7c3d6', 1.0));
const sun = new THREE.DirectionalLight('#fff4e6', 1.6); sun.position.set(-7, 13, 9); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 15, bottom: -15, near: 1, far: 60 });
sun.shadow.bias = -0.0004; sun.shadow.radius = 4; scene.add(sun);
const fill = new THREE.DirectionalLight('#cfe3ff', 0.5); fill.position.set(8, 6, 4); scene.add(fill);
const hemi = scene.children.find((o) => o.isHemisphereLight);
// 天井の照明（ダークのときだけ点ける）。机の列の上に、少し暖かい白の明かりを並べる。影は落とさない（軽さ優先）
const ceilingLamps = [[-7, -3.5], [0, -3.5], [7, -3.5], [-7, 2.2], [0, 2.2], [7, 2.2], [0, -8.2]].map(([x, z]) => {
  const l = new THREE.PointLight('#fff0dc', 0, 0, 2); l.position.set(x, 4.6, z); l.visible = false; scene.add(l); return l;
});
buildRoom(scene);

// ライト＝昼のオフィス、ダーク＝夜のオフィス（窓の外は夜景。室内は天井の照明を点けて明るく。床・壁は画面と同じチャコール）
const THEMES = {
  light: { bg: '#dfe8f3', sky: '#ffffff', ground: '#b7c3d6', hemi: 1.0, sun: ['#fff4e6', 1.6], fill: ['#cfe3ff', 0.5], exposure: 1.05,
    floor: '#ffffff', wall: '#f2f5f9', skirting: '#c9d2df', frame: '#cfd8e4', board: '#ffffff', stage: '#ece6dc', rug: '#c9dbf5', aisle: '#e4ded4', night: false },
  dark: { bg: '#151515', sky: '#fff6ea', ground: '#3a3938', hemi: 1.1, sun: ['#fff4e4', 1.55], fill: ['#fff0dc', 0.45], exposure: 1.1, lamps: 22,
    floor: '#e2dcd4', wall: '#3a3a39', skirting: '#252524', frame: '#5a5a58', board: '#eceae4', stage: '#4a4a48', rug: '#5c5b58', aisle: '#6d6a65', night: true },
};
let lineBaseMat = null, isDarkTheme = false;
const LINE_BASE_DARK = '#4d4233', LINE_BASE_LIGHT = '#7b6a52';
function applyLineTheme(dark) { isDarkTheme = !!dark; if (lineBaseMat) lineBaseMat.color.set(dark ? LINE_BASE_DARK : LINE_BASE_LIGHT); }
function setTheme(dark) {
  applyLineTheme(dark);
  const t = THEMES[dark ? 'dark' : 'light'];
  scene.background.set(t.bg); scene.fog.color.set(t.bg);
  if (hemi) { hemi.color.set(t.sky); hemi.groundColor.set(t.ground); hemi.intensity = t.hemi; }
  sun.color.set(t.sun[0]); sun.intensity = t.sun[1]; fill.color.set(t.fill[0]); fill.intensity = t.fill[1];
  renderer.toneMappingExposure = t.exposure;
  for (const l of ceilingLamps) { l.visible = !!t.lamps; l.intensity = t.lamps || 0; }
  for (const k of ['floor', 'wall', 'skirting', 'frame', 'board', 'stage', 'rug', 'aisle']) if (ROOM[k]) ROOM[k].color.set(t[k]);
  // 窓ごとにパノラマの自分の区間を切り出す（壁に沿って景色がつながる）。テクスチャは昼夜それぞれ1枚を共有
  if (ROOM.windows) for (const w of ROOM.windows) {
    const k = t.night ? 'night' : 'day';
    if (!w.mats[k]) { const tx = ROOM.getPano(t.night).clone(); tx.offset.set(w.u0, 0); tx.repeat.set(w.du, 1); tx.needsUpdate = true; w.mats[k] = new THREE.MeshBasicMaterial({ map: tx }); }
    w.mesh.material = w.mats[k];
  }
}
setTheme(document.documentElement.dataset.theme === 'dark');

let actors = new Map();   // key → actor
let layoutSig = '';
let selectedKey = 'exec';
let hoverKey = null;
const pickables = [];

function select(key) {
  selectedKey = key;
  for (const a of actors.values()) applySelection(a);
  if (typeof window.onOfficeSelect === 'function') window.onOfficeSelect(key);
}
function applySelection(a) {
  a.ring.visible = a.key === selectedKey || a.key === hoverKey;
  a.ring.material.color.set(a.key === selectedKey ? '#3d7be0' : '#ffffff');
  a.ring.material.opacity = a.key === selectedKey ? 0.95 : 0.55;
  a.label.box.classList.toggle('sel', a.key === selectedKey);
}

function clearActors() {
  for (const a of actors.values()) { scene.remove(a.group); a.labelObj.element.remove(); }
  actors = new Map(); pickables.length = 0; disposeLinks();
}

// ---------- 配置：執行役を奥の中央に固定し、左右に先頭と最後の部署、手前に残りの部署を左右対称に並べる ----------
// 部署の並び順（org.json の順）が 左の脇 → 手前（左→右）→ 右の脇。6 部署なら 営業 | 経理・デザイナー・プログラマー・データ分析 | 総務。
// 手前の列は中央から等間隔で、両端がわずかに奥へ寄る浅い弧。脇の机は中央へ少し向け、手前の机は正面を向く（向きはこの 2 種類だけ）。
const EXEC_Z = -8.2;
const SIDE_X = 9.6, SIDE_Z = -4.2, SIDE_YAW = 0.3, FRONT_Z = 4.4, FRONT_DX = 6.4, FRONT_CAP = 6, ROW_GAP = 3.8;
function layoutSlots(n) {
  const out = new Array(n);
  if (n <= 0) return out;
  const sides = n >= 3 ? 2 : 0;
  if (sides) {
    out[0] = { kind: 'side', x: -SIDE_X, z: SIDE_Z, yaw: SIDE_YAW };
    out[n - 1] = { kind: 'side', x: SIDE_X, z: SIDE_Z, yaw: -SIDE_YAW };
  }
  const fronts = []; for (let i = sides ? 1 : 0; i < (sides ? n - 1 : n); i++) fronts.push(i);
  for (let r = 0, at = 0; at < fronts.length; r++) {
    const m = Math.min(FRONT_CAP, fronts.length - at);
    const dx = m > 1 ? Math.min(FRONT_DX, 24 / (m - 1)) : 0;
    for (let k = 0; k < m; k++) {
      const x = (k - (m - 1) / 2) * dx;
      out[fronts[at + k]] = { kind: 'front', x, z: FRONT_Z + r * ROW_GAP - 0.02 * x * x, yaw: 0 };
    }
    at += m;
  }
  return out;
}

// ---------- 通信線：執行役の机の前から中央の通路に沿って幹を 1 本通し、部署ごとに直角に枝分かれする ----------
// 平常時は床になじむ細い線だけ。動いている部署の枝（と幹の必要な部分）だけが 1 色で明るくなり、小さな光の点が流れる。
// 向き：out＝幹から部署へ、in＝部署から幹へ。見出し（仕事名）は枝の途中に出し、名札と重ならない位置に置く。
const linkGroup = new THREE.Group(); scene.add(linkGroup);
let links = new Map(); // 部署key → link
function disposeLinks() {
  for (const l of links.values()) l.label.element.remove();
  linkGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  while (linkGroup.children.length) linkGroup.remove(linkGroup.children[0]);
  links = new Map();
}
let glowTex = null;
function getGlowTex() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); return glowTex;
}
const LINE_W = 0.09, LINE_ON_W = 0.17, LINE_Y = 0.03, LINE_BASE = '#7b6a52', LINE_ACCENT = '#27a7ff';
function addRibbon(group, p, q, w, y, mat) { // 床に置く細い直線（軸に平行）
  const dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz) + w;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(dx) > Math.abs(dz) ? len : w, Math.abs(dx) > Math.abs(dz) ? w : len), mat);
  m.rotation.x = -Math.PI / 2; m.position.set((p.x + q.x) / 2, y, (p.z + q.z) / 2); m.renderOrder = 1; group.add(m); return m;
}
function addDisc(group, p, r, y, mat) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat); m.rotation.x = -Math.PI / 2; m.position.set(p.x, y, p.z); m.renderOrder = 1; group.add(m); return m;
}
function buildLinks() {
  disposeLinks();
  const ex = actors.get('exec'); if (!ex) return;
  const deps = [...actors.values()].filter((a) => !a.isExec);
  const z0 = ex.group.position.z + 2.4;
  const frontZs = deps.filter((a) => a.slot?.kind === 'front').map((a) => a.group.position.z);
  const busZ = frontZs.length ? SIDE_Z + 1.2 : SIDE_Z + 3;
  const baseMat = lineBaseMat = new THREE.MeshBasicMaterial({ color: isDarkTheme ? LINE_BASE_DARK : LINE_BASE_LIGHT, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const seen = new Set(); const V = (x, z) => new THREE.Vector3(x, 0, z);
  const baseSeg = (p, q) => { const k = [p.x, p.z, q.x, q.z].map((v) => v.toFixed(2)).join(); if (seen.has(k)) return; seen.add(k); addRibbon(linkGroup, p, q, LINE_W, LINE_Y, baseMat); };
  addDisc(linkGroup, V(0, z0), 0.14, LINE_Y, baseMat);
  for (const a of deps) {
    const ax = a.group.position.x, az = a.group.position.z, side = a.slot?.kind === 'side';
    const pts = side
      ? [V(0, z0), V(0, az - 0.4), V(ax + (ax < 0 ? 1.9 : -1.9), az - 0.4)]
      : [V(0, z0), V(0, busZ), V(ax, busZ), V(ax, az - 1.3)];
    for (let i = 0; i < pts.length - 1; i++) baseSeg(pts[i], pts[i + 1]);
    for (let i = 1; i < pts.length - 1; i++) addDisc(linkGroup, pts[i], 0.1, LINE_Y, baseMat);
    addDisc(linkGroup, pts[pts.length - 1], 0.17, LINE_Y, baseMat);
    // 動いている間だけ見える明るい線
    const onGroup = new THREE.Group(); onGroup.visible = false; linkGroup.add(onGroup);
    const onMat = new THREE.MeshBasicMaterial({ color: LINE_ACCENT, toneMapped: false, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < pts.length - 1; i++) addRibbon(onGroup, pts[i], pts[i + 1], LINE_ON_W, LINE_Y + 0.012, onMat);
    addDisc(onGroup, pts[pts.length - 1], 0.22, LINE_Y + 0.012, onMat);
    const segLen = []; let total = 0; for (let i = 0; i < pts.length - 1; i++) { const d = pts[i].distanceTo(pts[i + 1]); segLen.push(d); total += d; }
    const dots = [], glows = [];
    for (let k = 0; k < 3; k++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1, depthWrite: false }));
      d.renderOrder = 3; d.visible = false; linkGroup.add(d); dots.push(d);
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color: LINE_ACCENT, transparent: true, opacity: 0.55, depthWrite: false }));
      g.scale.set(0.5, 0.5, 1); g.renderOrder = 2; g.visible = false; linkGroup.add(g); glows.push(g);
    }
    const el = document.createElement('div'); el.className = 'o3-flow'; el.style.display = 'none';
    // 見出しは枝の上。脇の部署は幹と机の間、手前の部署は母線の上で自分の名札の真上（隣と横に並ばない間隔）に置き、名札・見出し同士が重ならない
    const lp = side ? new THREE.Vector3(ax * 0.45, 0.12, az - 0.4) : (Math.abs(ax) < 5 ? new THREE.Vector3(ax, 0.12, busZ) : new THREE.Vector3(ax, 0.12, busZ - 1.0));
    const label = new CSS2DObject(el); label.position.copy(lp); linkGroup.add(label);
    links.set(a.key, { key: a.key, pts, segLen, total, onGroup, onMat, dots, glows, label, el, dir: null, title: '', level: 0 });
  }
}
function syncLinks(entries) {
  for (const e of entries) {
    const l = links.get(e.key); if (!l) continue;
    const f = e.flow || {};
    l.dir = f.dir || null;
    const title = f.title || '';
    if (title !== l.title || l.shownDir !== l.dir) {
      l.title = title; l.shownDir = l.dir;
      l.el.textContent = l.dir ? (l.dir === 'out' ? '▶ ' : '◀ ') + title : '';
      l.el.title = l.dir === 'out' ? '執行役が任せた仕事：' + title : l.dir === 'in' ? '部署から執行役への報告：' + title : '';
    }
    l.el.dataset.dir = l.dir || '';
  }
}
const _lp = new THREE.Vector3();
function linkPoint(l, s, out) { // 折れ線の始点から距離 s の位置
  let r = Math.max(0, Math.min(l.total, s));
  for (let i = 0; i < l.segLen.length; i++) {
    if (r <= l.segLen[i] || i === l.segLen.length - 1) { const t = l.segLen[i] ? r / l.segLen[i] : 0; return out.lerpVectors(l.pts[i], l.pts[i + 1], t); }
    r -= l.segLen[i];
  }
  return out;
}
function animateLinks(t, dt) {
  for (const l of links.values()) {
    const on = !!l.dir;
    l.level += ((on ? 1 : 0) - l.level) * Math.min(1, dt * 6);
    l.onGroup.visible = l.level > 0.02; l.onMat.opacity = l.level * 0.95;
    l.el.style.display = on ? '' : 'none';
    l.dots.forEach((d, i) => {
      d.visible = on; l.glows[i].visible = on;
      if (!on) return;
      let s = (((t * 3.0 + i * l.total / l.dots.length) % l.total) + l.total) % l.total;
      if (l.dir === 'in') s = l.total - s;
      linkPoint(l, s, _lp); _lp.y = 0.12; d.position.copy(_lp); l.glows[i].position.copy(_lp);
    });
  }
}

function buildActors(entries) {
  clearActors();
  const sel = loadChars();
  const deps = entries.filter((e) => e.key !== 'exec');
  const slots = layoutSlots(deps.length);
  entries.forEach((e) => {
    const isExec = e.key === 'exec';
    let x = 0, z = EXEC_Z, y = 0.16, slot = null;
    if (!isExec) { slot = slots[deps.indexOf(e)]; x = slot.x; z = slot.z; y = 0; }
    const group = new THREE.Group(); group.position.set(x, y, z);
    group.rotation.y = isExec ? 0 : slot.yaw;
    const desk = makeDesk(OUTFIT[e.role] || {}, isExec);
    desk.group.position.z = isExec ? 0.82 : 0.74; group.add(desk.group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.4, 56), new THREE.MeshBasicMaterial({ color: '#3d7be0', transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, 0.35); ring.visible = false; group.add(ring);
    // 実行中の目印：床で回る緑の弧（3本）
    const workRing = new THREE.Group(); workRing.position.set(0, 0.03, 0.35); workRing.visible = false; group.add(workRing);
    const arcMat = new THREE.MeshBasicMaterial({ color: '#19b77a', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
    for (let k = 0; k < 3; k++) {
      const arc = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.66, 40, 1, k * (Math.PI * 2 / 3), Math.PI / 2.4), arcMat);
      arc.rotation.x = -Math.PI / 2; workRing.add(arc);
    }
    if (OUTFIT[e.role]?.holo) {
      const holo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ color: '#6fd3ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      holo.position.set(-0.75, 1.75, 0.6); holo.rotation.y = 0.5; group.add(holo);
    }
    const label = makeLabel(e);
    const labelObj = new CSS2DObject(label.anchor); labelObj.position.set(0, 3.2, 0); group.add(labelObj);
    scene.add(group); pickables.push(group);
    const a = { key: e.key, isExec, slot, entry: e, group, robot: null, buddy: null, desk, ring, workRing, label, labelObj, status: null, phase: Math.random() * 10, lastDraw: -1 };
    dressActor(a, choiceOf(sel, e.key));
    actors.set(e.key, a);
  });
  buildLinks();
}

// ---------- 部署ごとのキャラの選択（localStorage 'myai.characters'） ----------
// 形：{ v:1, sel:{ <部署id か 'exec'>: { staff:'robot'|'explorer'|…, buddy:'none'|'charimo'|… } } }。書いていない部署はロボット・相棒なし
const CHAR_KEY = 'myai.characters';
function loadChars() {
  try { const v = JSON.parse(localStorage.getItem(CHAR_KEY) || 'null'); return v && v.sel && typeof v.sel === 'object' ? v.sel : {}; } catch (e) { return {}; }
}
function choiceOf(sel, key) {
  const c = sel[key] || {};
  return {
    staff: CHAR.get(c.staff)?.slot === 'staff' ? c.staff : DEFAULTS.staff,
    buddy: CHAR.get(c.buddy)?.slot === 'buddy' ? c.buddy : 'none',
  };
}
const charSig = (a, c) => `${c.staff}+${c.buddy}|${a.entry.color || ''}|${a.entry.role || ''}`;
// 担当と相棒を（作り直して）机に置く。名札・輪・机・画面はそのまま
function dressActor(a, choice) {
  const e = a.entry, dept = e.color || '#5b6677';
  if (a.robot) { a.group.remove(a.robot.root); disposeFig(a.robot); }
  if (a.buddy) { a.group.remove(a.buddy.holder); disposeFig(a.buddy); a.buddy = null; }
  const sdef = CHAR.get(choice.staff), scale = a.isExec ? 1.32 : 1.18;
  a.robot = !sdef || sdef.builtin === 'robot' ? makeRobot(e.role, scale) : buildSeated(sdef, scale, dept, e.role);
  a.group.add(a.robot.root);
  const bdef = CHAR.get(choice.buddy);
  if (bdef) {
    const b = buildBuddy(bdef, dept, e.role);
    // 机の上（右側の空いている所）か、机の右の床。少しだけ担当の方を向く
    const holder = new THREE.Group(); holder.add(b.root);
    if (bdef.rig?.seat === 'floor') { holder.position.set(a.isExec ? 1.6 : 1.3, 0, a.isExec ? 1.0 : 0.9); holder.scale.setScalar(1.25); }
    else { holder.position.set(a.isExec ? 0.8 : 0.6, 0.835, a.isExec ? 0.97 : 0.9); holder.scale.setScalar(a.isExec ? 1.0 : 0.9); }
    holder.rotation.y = -0.35;
    b.holder = holder; a.buddy = b; a.group.add(holder);
  }
  a.group.traverse((o) => { o.userData.key = a.key; });
  a.charSig = charSig(a, choice); a.choice = choice;
  if (a.status) { const s = a.status; a.status = null; setStatus(a, s); }
}
function applyCharacters() {
  const sel = loadChars();
  for (const a of actors.values()) { const c = choiceOf(sel, a.key); if (charSig(a, c) !== a.charSig) dressActor(a, c); }
  refreshLabels();
}
window.addEventListener('storage', (ev) => { if (ev.key === CHAR_KEY) applyCharacters(); else if (ev.key === NAME_KEY) refreshLabels(); });

// ---------- 名札に添える名前（localStorage 'myai.charNames'） ----------
// 形：{ v:1, names:{ <部署id か 'exec'>: { staff?:'名前', buddy?:'名前' } } }。書いていなければキャラの nick（ミトロ・チャリモなど）。空文字は「名前なし」
const NAME_KEY = 'myai.charNames';
function loadNames() {
  try { const v = JSON.parse(localStorage.getItem(NAME_KEY) || 'null'); return v && v.names && typeof v.names === 'object' ? v.names : {}; } catch (e) { return {}; }
}
function nickOf(names, key, slot, charId) {
  const n = names[key];
  const s = n && typeof n[slot] === 'string' ? n[slot] : (CHAR.get(charId)?.nick ?? CHAR.get(charId)?.name ?? '');
  return Array.from(String(s).trim()).slice(0, NAME_MAX).join('');
}
function refreshLabels() { for (const a of actors.values()) if (a.entry && a.status) updateLabel(a, a.entry); }

// 設定画面のカードに出す小さな見本（PNG の data URL）。小さな描画面を一時的に作り、しばらく使わなければ片付ける
let thumbR = null, thumbTimer = 0;
const thumbCache = new Map();
function thumbnail(id, opt = {}) {
  const def = CHAR.get(id); if (!def) return null;
  const color = opt.color || '#5b6677', role = opt.role || 'programmer', size = opt.size || 256;
  const k = [id, color, role, size, opt.rotY ?? ''].join('|');
  if (thumbCache.has(k)) return thumbCache.get(k);
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbR.setPixelRatio(1);
    thumbR.outputColorSpace = THREE.SRGBColorSpace; thumbR.toneMapping = THREE.ACESFilmicToneMapping; thumbR.toneMappingExposure = 1.1;
  }
  thumbR.setSize(size, size, false);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#b7c3d6', 1.2));
  const dl = new THREE.DirectionalLight('#fff4e6', 1.8); dl.position.set(-2, 4, 5); sc.add(dl);
  const fig = def.slot === 'buddy' ? buildBuddy(def, color, role) : def.builtin === 'robot' ? makeRobot(role, 1) : buildSeated(def, 1, color, role);
  fig.setStatus('working');
  if (fig.arms) { fig.arms[0].rotation.set(-0.35, 0, -0.12); fig.arms[1].rotation.set(-0.35, 0, 0.12); }
  const chairs = []; fig.root.traverse((o) => { if (o.userData.chair) chairs.push(o); }); chairs.forEach((o) => o.removeFromParent());
  fig.root.rotation.y = opt.rotY ?? 0.45; sc.add(fig.root); fig.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fig.root);
  const ctr = box.getCenter(new THREE.Vector3()), rad = box.getSize(new THREE.Vector3()).length() / 2;
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
  cam.position.copy(ctr).addScaledVector(new THREE.Vector3(0, 0.22, 1).normalize(), rad / Math.sin(THREE.MathUtils.degToRad(14)) * 0.9);
  cam.lookAt(ctr);
  thumbR.render(sc, cam);
  const url = thumbR.domElement.toDataURL('image/png');
  disposeFig(fig);
  thumbCache.set(k, url);
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => { if (thumbR) { thumbR.dispose(); thumbR.forceContextLoss(); thumbR = null; } }, 8000);
  return url;
}

function setStatus(a, status) {
  if (a.status === status) return;
  a.status = status;
  a.robot.setStatus(status);
  if (a.buddy) a.buddy.setStatus(status);
  a.workRing.visible = status === 'working';
  a.desk.logo.material.color.set(STATUS_COLOR[status]);
}

// 机の手前の画面に描く中身
function panelInfo(e) {
  const s = e.screen || {};
  return { name: e.name, color: e.color, title: s.title, sub: s.sub, counts: s.counts };
}
function redrawPanel(a) { drawScreen(a.desk.screen, a.status || 'idle', clock.getElapsedTime(), a.panel || {}); }

function updateLabel(a, e) {
  const { tag, bub } = a.label;
  a.label.box.classList.toggle('working', e.status === 'working');
  a.label.box.style.setProperty('--tag', e.color || '#5b6677');
  const names = loadNames(), c = a.choice || {};
  const nick = nickOf(names, a.key, 'staff', c.staff), bnick = c.buddy && c.buddy !== 'none' ? nickOf(names, a.key, 'buddy', c.buddy) : '';
  tag.innerHTML = `${iconSvg(e.icon)}<span>${esc(e.name)}</span>${nick ? `<small class="nk">${esc(nick)}</small>` : ''}<i style="background:${STATUS_COLOR[e.status]}" title="${STATUS_LABEL[e.status]}"></i>${e.count ? `<b>${e.count}</b>` : ''}`;
  tag.setAttribute('aria-label', `${e.name}${nick ? ' ' + nick : ''}${bnick ? '・相棒 ' + bnick : ''} ${STATUS_LABEL[e.status]}`);
  tag.title = `${e.name}${nick ? ' ' + nick : ''}${bnick ? '（相棒：' + bnick + '）' : ''}`;
  if (e.bubble) { bub.textContent = e.bubble; bub.style.display = ''; bub.dataset.status = e.status; }
  else bub.style.display = 'none';
}

// 画面からのデータ
window.Office3D = {
  setTheme,
  // 壁の看板の文字（設定の表示名）。同じ名前なら何もしない
  setTitle(name) {
    const n = String(name || '').trim() || DEFAULT_BOARD_TITLE;
    if (n === boardTitle) return;
    boardTitle = n;
    if (ROOM.redrawBoard) ROOM.redrawBoard();
  },
  focus: (key) => focusOn(key),
  // そのロボットの頭が画面のどこに映っているか（ページ座標）。動作確認用
  screenOf(key) {
    const a = actors.get(key); if (!a) return null;
    const p = new THREE.Vector3(); a.robot.head.getWorldPosition(p); p.project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    return { x: Math.round(r.left + (p.x + 1) / 2 * r.width), y: Math.round(r.top + (1 - p.y) / 2 * r.height), dist: +camera.position.distanceTo(a.group.position).toFixed(2) };
  },
  reset: () => resetView(),
  // キャラの設定（index.html の「設定」画面から使う）
  characters: CHARACTERS,
  defaults: DEFAULTS,
  applyCharacters,
  applyNames: () => refreshLabels(),
  deptKit: DEPT_KIT,
  thumbnail,
  // 「この見え方を既定にする」：今のカメラ位置と注視点を localStorage に保存する。以後、初期表示と「全体を見る」はこの見え方に戻る
  saveView() {
    camGoal = null;
    const v = { v: 1, pos: camera.position.toArray().map((n) => +n.toFixed(4)), target: controls.target.toArray().map((n) => +n.toFixed(4)), aspect: +camera.aspect.toFixed(4), savedAt: new Date().toISOString() };
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(v)); } catch (e) { return false; }
    atHome = true; applyDistLimits(Math.max(HOME.dist, camera.position.distanceTo(controls.target)));
    return true;
  },
  // 「初期に戻す」：保存した見え方を消し、画面の縦横比からの自動計算に戻す
  clearView() { try { localStorage.removeItem(VIEW_KEY); } catch (e) { /* 消せなくても表示は自動計算に戻す */ } resetView(); },
  hasSavedView: () => !!loadSavedView(),
  update(entries, selKey) {
    const sig = entries.map((e) => e.key + ':' + e.role).join('|');
    if (sig !== layoutSig) { layoutSig = sig; buildActors(entries); }
    const sel = loadChars();
    for (const e of entries) {
      const a = actors.get(e.key); if (!a) continue;
      a.entry = e;
      if (charSig(a, choiceOf(sel, e.key)) !== a.charSig) dressActor(a, choiceOf(sel, e.key));
      const before = a.status;
      setStatus(a, e.status); updateLabel(a, e);
      const p = panelInfo(e); const ps = JSON.stringify(p);
      if (ps !== a.panelSig || before !== e.status) { a.panel = p; a.panelSig = ps; redrawPanel(a); }
    }
    if (selKey && selKey !== selectedKey) selectedKey = selKey;
    for (const a of actors.values()) applySelection(a);
    syncLinks(entries);
  },
};

// クリック・ホバーでロボットを選ぶ
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
let downAt = null;
function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, true)[0];
  return hit ? hit.object.userData.key : null;
}
renderer.domElement.addEventListener('pointerdown', (ev) => { downAt = [ev.clientX, ev.clientY]; });
renderer.domElement.addEventListener('pointerup', (ev) => {
  if (!downAt) return; const moved = Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]); downAt = null;
  if (moved > 6) return; const k = pick(ev); if (k) select(k);
});
// ダブルクリックでそのロボットに寄る
function focusOn(key) {
  const a = actors.get(key); if (!a) return;
  const p = new THREE.Vector3(); a.group.getWorldPosition(p);
  // ロボットの顔と、机の前面の画面が両方収まる位置
  const t = p.clone().add(new THREE.Vector3(0, 1.05, 0.7));
  atHome = false; camGoal = { target: t, pos: t.clone().add(new THREE.Vector3(1.5, 1.5, 5.6)) };
}
function resetView() { fitHome(); atHome = true; camGoal = homeView(); }
// 利用者が「この見え方を既定にする」で保存した見え方（localStorage 'myai.view3d'）。
// 形：{ v:1, pos:[x,y,z], target:[x,y,z], aspect: 保存した時の画面の横/縦, savedAt: ISO日時 }
const VIEW_KEY = 'myai.view3d';
function loadSavedView() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null'); } catch (e) { return null; }
  const ok3 = (a) => Array.isArray(a) && a.length === 3 && a.every((n) => Number.isFinite(n));
  if (!v || !ok3(v.pos) || !ok3(v.target) || !(v.aspect > 0)) return null;
  const pos = new THREE.Vector3(...v.pos), tgt = new THREE.Vector3(...v.target);
  if (pos.distanceTo(tgt) < 0.5) return null;
  return { pos, target: tgt, aspect: v.aspect };
}
// 初期表示と「全体を見る」の戻り先。保存した見え方があればそれ、無ければ自動計算（HOME）。
// 保存した見え方は、向き・見下ろす角度・注視点・距離をそのまま使う。
// ただし保存した時より画面が細長く（横が狭く）なったときだけ、部屋が切れないように距離を伸ばす：
// 同じ向き・同じ注視点で「部屋が収まる距離」を、保存時の縦横比と今の縦横比で求め、その比を掛ける（縮める方向には補正しない）
function homeView() {
  const sv = loadSavedView();
  if (!sv) return { target: HOME.target.clone(), pos: HOME.pos.clone() };
  const off = sv.pos.clone().sub(sv.target);
  let d = off.length(); const dir = off.divideScalar(d);
  if (camera.aspect < sv.aspect - 1e-3) {
    const k = fitDist(sv.target, dir, camera.aspect) / fitDist(sv.target, dir, sv.aspect);
    if (k > 1) d *= Math.min(k, 3);
  }
  applyDistLimits(Math.max(HOME.dist, d));
  return { target: sv.target.clone(), pos: sv.target.clone().addScaledVector(dir, d) };
}
const fitCam = new THREE.PerspectiveCamera();
// 注視点 tgt から向き dir の方へ下がったとき、部屋の床の四隅と壁の上端が余白つきで収まる最短の距離
function fitDist(tgt, dir, aspect) {
  fitCam.fov = camera.fov; fitCam.aspect = aspect; fitCam.near = 0.1; fitCam.far = 500; fitCam.updateProjectionMatrix();
  const q = new THREE.Vector3();
  const fits = (r) => {
    fitCam.position.copy(tgt).addScaledVector(dir, r); fitCam.lookAt(tgt); fitCam.updateMatrixWorld();
    // 上は操作の説明、下は凡例とボタンが重なるので、縦は少し多めに余白を取る
    return ROOM_PTS.every((p) => { q.copy(p).project(fitCam); return q.z < 1 && Math.abs(q.x) <= 0.92 && Math.abs(q.y) <= 0.84; });
  };
  let lo = 8, hi = 200;
  for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
  return hi;
}
// 距離 d から見ても部屋が霞まない・切れないように、離れられる上限と霧・描画距離を合わせる
function applyDistLimits(d) {
  controls.maxDistance = Math.max(44, d + 6);
  scene.fog.near = Math.max(45, d + 12); scene.fog.far = Math.max(85, d + 60);
  camera.far = Math.max(200, d + 120); camera.updateProjectionMatrix();
}
function fitHome() {
  const hi = fitDist(HOME.target, HOME_DIR, camera.aspect);
  HOME.dist = hi; HOME.pos.copy(HOME.target).addScaledVector(HOME_DIR, hi);
  applyDistLimits(hi);
}
renderer.domElement.addEventListener('dblclick', (ev) => { const k = pick(ev); if (k) { select(k); focusOn(k); } else resetView(); });
renderer.domElement.addEventListener('pointerdown', () => { camGoal = null; atHome = false; });
// ホイールで寄る：カメラの向きは変えずに、カーソルの下の点 P へ向かって平行に進む。
// 向きが変わらず P への直線上を動くので、P は画面上のカーソル位置から動かない（進路が曲がらない）。
// 回転の中心は視線の上に置き直す（近づいた物のあたりを中心に回れるように）
const zoomRay = new THREE.Raycaster();
function cursorPoint(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  const v = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  zoomRay.setFromCamera(v, camera);
  const hit = zoomRay.intersectObjects(scene.children, true).find((h) => h.object.visible && h.object.isMesh);
  if (hit) return hit.point;
  // 何も無いところは、今の注視点と同じ距離の点
  return zoomRay.ray.at(camera.position.distanceTo(controls.target), new THREE.Vector3());
}
renderer.domElement.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  camGoal = null; atHome = false;
  const P = cursorPoint(ev);
  const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;          // 行単位ならピクセルに直す
  const k = 1 - Math.exp(-Math.abs(dy) * 0.0018);                       // 1回で寄る割合
  const toP = P.clone().sub(camera.position);
  const dist = toP.length();
  const dir = controls.target.clone().sub(camera.position).normalize();  // 今の視線の向き
  const oldTD = camera.position.distanceTo(controls.target);
  let newTD;
  if (dy < 0) {                                                          // 寄る
    if (dist < 2.3) return;                                              // 顔全体が見える距離で止める
    const step = Math.min(k, 1 - 2.2 / dist);
    camera.position.addScaledVector(toP, step);
    newTD = Math.max(1.6, Math.min(oldTD, dist * (1 - step)));
  } else {                                                               // 離れる
    if (camera.position.distanceTo(HOME.target) > Math.max(46, HOME.dist + 8)) return;
    camera.position.addScaledVector(toP, -k);
    newTD = Math.min(Math.max(40, HOME.dist + 4), oldTD * (1 + k));
  }
  controls.target.copy(camera.position).addScaledVector(dir, newTD);
}, { passive: false });
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (downAt) return; const k = pick(ev);
  if (k !== hoverKey) { hoverKey = k; renderer.domElement.style.cursor = k ? 'pointer' : 'grab'; for (const a of actors.values()) applySelection(a); }
});

// 動き
const clock = new THREE.Clock();
// 相棒の動き：作業中＝小刻みに弾む・返答待ち＝首をかしげる・完了＝ぴょんと跳ねる・待機＝ゆっくり息をする
function animBuddy(f, s, p) {
  const b = f.body;
  let y = 0, ry = 0, rz = 0, sy = 1, amp = 0.12, spd = 1.5, glow = 0.85;
  if (s === 'working') { y = Math.abs(Math.sin(p * 6)) * 0.025; ry = Math.sin(p * 1.3) * 0.15; amp = 0.5; spd = 12; glow = 0.75 + 0.5 * Math.abs(Math.sin(p * 3)); }
  else if (s === 'waiting') { rz = Math.sin(p * 2.5) * 0.18; amp = 0.35; spd = 6; }
  else if (s === 'done') { y = Math.max(0, Math.sin(p * 3.2)) * 0.09; ry = Math.sin(p * 1.6) * 0.3; amp = 0.7; spd = 10; }
  else { sy = 1 + Math.sin(p * 1.8) * 0.025; glow = 0.45; }
  b.position.y = y; b.rotation.set(0, ry, rz); b.scale.set(1, sy, 1);
  for (const j of f.joints) {
    const w = Math.sin(p * spd + j.phase) * amp * j.amp, r = j.base, g = j.g.rotation;
    if (j.motion === 'flapL') g.z = r.z - Math.abs(w) * 1.2;
    else if (j.motion === 'flapR') g.z = r.z + Math.abs(w) * 1.2;
    else if (j.motion === 'wag') g.z = r.z + w * 0.6;
    else if (j.motion === 'tilt') g.z = r.z + w * 0.25;
    else if (j.motion === 'wave') g.z = r.z + w * 0.5;
    else if (j.motion === 'nod') g.x = r.x + w * 0.3;
    else if (j.motion === 'swish') g.y = r.y + w * 0.6;
    else if (j.motion === 'spin') g.y = r.y + p * spd * 0.3;
  }
  for (const m of f.glowMats) m.emissiveIntensity = m.userData.glow * glow;
}
let _lastT = 0;
function animate() {
  const t = clock.getElapsedTime(); animateLinks(t, Math.min(0.1, t - _lastT)); _lastT = t;
  for (const a of actors.values()) {
    if (a.workRing.visible) a.workRing.rotation.y = -t * 1.6;
    const { body, head, arms } = a.robot; const p = t + a.phase; const s = a.status; const by = a.robot.baseY ?? 0.58;
    if (a.buddy) animBuddy(a.buddy, s, p);
    const [L, R] = arms;
    if (s === 'working') {
      L.rotation.set(-1.2 + Math.sin(p * 14) * 0.09, 0, -0.12);
      R.rotation.set(-1.2 + Math.sin(p * 14 + 1.7) * 0.09, 0, 0.12);
      head.rotation.set(0.16 + Math.sin(p * 2.2) * 0.03, Math.sin(p * 0.7) * 0.12, 0);
      body.position.y = by + Math.abs(Math.sin(p * 7)) * 0.008;
      if (t - a.lastDraw > 0.1) { redrawPanel(a); a.lastDraw = t; }
    } else if (s === 'waiting') {
      L.rotation.set(-1.1, 0, -0.12);
      R.rotation.set(0.1, 0, 2.55 + Math.sin(p * 6) * 0.28);
      head.rotation.set(-0.08, 0.15, Math.sin(p * 2) * 0.1);
      body.position.y = by;
    } else if (s === 'done') {
      L.rotation.set(-0.85, 0, -0.2); R.rotation.set(-0.85, 0, 0.2);
      head.rotation.set(-0.05, Math.sin(p * 1.1) * 0.25, Math.sin(p * 1.6) * 0.06);
      body.position.y = by + Math.abs(Math.sin(p * 2.4)) * 0.03;
    } else {
      L.rotation.set(-0.5, 0, -0.1); R.rotation.set(-0.5, 0, 0.1);
      head.rotation.set(0.38 + Math.sin(p * 0.8) * 0.04, 0, 0.12);
      body.position.y = by + Math.sin(p * 0.9) * 0.01;
    }
  }
  if (camGoal) {
    controls.target.lerp(camGoal.target, 0.08); camera.position.lerp(camGoal.pos, 0.08);
    if (camera.position.distanceTo(camGoal.pos) < 0.02) camGoal = null;
  }
  // 移動しても部屋から大きく外れない・床に潜らない。
  // 注視点の高さは触らない（寄った先の点を持ち上げると進路が曲がるため）
  const tg = controls.target;
  const before = tg.clone();
  tg.x = THREE.MathUtils.clamp(tg.x, -17, 17); tg.z = THREE.MathUtils.clamp(tg.z, -12, 12); tg.y = THREE.MathUtils.clamp(tg.y, 0, 6);
  if (!tg.equals(before)) camera.position.add(tg.clone().sub(before));
  if (camera.position.y < 0.25) camera.position.y = 0.25;
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  for (const l of links.values()) l.el.style.zIndex = 99999; // 線の見出しは名札より手前
  requestAnimationFrame(animate);
}

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  labelRenderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (w > 0 && h > 0) {
    fitHome();
    if (atHome) { camGoal = null; const h = homeView(); controls.target.copy(h.target); camera.position.copy(h.pos); }
  }
}
new ResizeObserver(resize).observe(host);
// 日本語フォントの読み込みが終わったら画面の文字を描き直す
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const a of actors.values()) redrawPanel(a); });
resize();
animate();
host.classList.add('ready');
if (typeof window.onOfficeReady === 'function') window.onOfficeReady();
