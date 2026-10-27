// キャラクターの一覧（3D オフィスの「設定」で部署ごとに選ぶ）
//
// ■ 作りの考え方：キャラ側＝体の形、部署側＝小物と色
//   - CHARACTERS（下）は体の形だけを書く。服の色は 'dept'（部署の色）で書いておくと部署ごとに変わる。
//   - DEPT_KIT（下）は部署ごとの小物（ネクタイ・メガネ・ベレー帽・メガホン…）。キャラを選ぶと自動で付く。
//     元の白いロボット（office3d.js の OUTFIT）が部署ごとに持っている小物と同じものを、人型にも付ける。
//   - 相棒には、部署の色の首輪と、部署ごとの飾り（ネクタイ・リボン・名札・ベレー帽など）が自動で付く。
//   → 新しいキャラを足しても、部署の特徴は書かなくてよい。
//
// ■ 新しいキャラの足し方（このファイルに1件足すだけ。office3d.js と index.html は触らない）
//   1. 下の CHARACTERS に { id, slot, name, nick, desc, rig, parts } を1件足す。似たキャラを丸ごと写して直すのが早い。
//      - id    : 英数字の重複しない名前（保存に使う。あとで変えると選択が外れる）
//      - slot  : 'staff'＝机に座る担当（ロボットの代わり）／'buddy'＝机の横にいる相棒
//      - name / desc : 設定画面のカードに出る名前とひとこと
//      - nick  : 名札に添える名前の初期値（利用者が設定で変えられる。空なら部署名だけ）
//      - recommend : （任意）おすすめの部署の id の並び。その部署を選んだときカードに「おすすめ」と出る
//      - rig   : staff は { type:'seated', chair:true, fit:{ head:1, hair:'#色' } }
//                  fit.head は頭の大きさの倍率（標準＝半径 0.42）。部署の小物（メガネ・帽子など）がこの倍率で合わせて付く
//                  fit.hair は髪の色（人事のおだんごに使う）
//               buddy は { type:'buddy', seat:'desk'（机の上）か 'floor'（床）, joints, neck, top }
//                  neck = { pos:[x,y,z], r:首まわりの半径, sz:前後のつぶれ（省略 1）} … 部署の首輪をここに付ける
//                  top  = { at:'head', pos:[x,y,z] } … 頭のてっぺん。ベレー帽・アンテナをここに付ける
//                  joints の motion：flapL/flapR＝羽ばたき wag＝ふりふり tilt＝首かしげ wave＝手をふる nod＝うなずき
//                                    swish＝左右にふる spin＝回る（rot＝動く前の向き、amp＝動きの大きさ、phase＝ずらし）
//               ※ scale（大きさの倍率）は任意
//      - parts : 形の部品の並び。1件＝1つの形
//   2. 画面を読み込み直す → 「設定」に新しいカードが出る。
//
// ■ 部品（parts の1件）の書き方
//   shape : 'sphere'[半径] 'dome'[半径]（上半分の球） 'capsule'[半径,長さ] 'box'[幅,高さ,奥行]
//           'cylinder'[上の半径,下の半径,高さ] 'disc'[半径,厚み]（上を向いた円盤） 'cone'[半径,高さ]
//           'torus'[半径,太さ,弧]（正面を向いた輪。弧は省略で一周。Math.PI で半円＝目や口に使う）
//           'ring'[半径,太さ,弧]（水平に寝た輪）
//   size  : 上の［］の数字
//   at    : どこに付けるか。staff は 'root'（動かない：脚など）'body' 'head' 'armL' 'armR' 'arms'（両腕）
//           buddy は 'body'（全体）と、rig.joints に書いた名前
//   pos / rot / scale : 位置 [x,y,z]・回転（ラジアン）[x,y,z]・伸び縮み [x,y,z]。正面（カメラ側）が +z、上が +y
//   color : '#rrggbb' か 'dept'（部署の色）'deptDark'（部署の色を濃く）'deptLight'（部署の色を淡く）'hair'（rig.fit.hair）
//   glow  : 数字を書くとその色でほのかに光る（0.3〜1.2）。flat:true は影なしの単色（目の光など）
//   rough / metal : つや（0〜1）。省略で 0.5 / 0.05
//   show  : その状態のときだけ見せる。['working','waiting','done','idle'] の一部（目の切り替えに使う）
//   mirror: true で左右対称にもう1つ置く（x を反転）
//   face  : [nx,ny,nz] 部品の上（+y）を、この向きに向ける（体の表面に貼る模様に便利）。spin でその向きの周りに回す
//   slot  : staff の部品に 'hat'（帽子）'neck'（首まわり）と書くと、部署の小物がそこを置きかえるときに隠れる
//           （例：デザイナーはベレー帽なので、キャップを隠してベレー帽をかぶる）
//           'top'（上着）と書いた部品は、スーツの部署ではスーツの色になる（ロボットと同じ。'dept' の代わりに DEPT_KIT の top の色）
//
// ■ 決まり
//   - 既存のアニメ・ゲームのキャラクターの形や名前は使わない（オリジナルだけ）。
//     相棒は「黄色いネズミ型で赤いほっぺ・ギザギザしっぽ」「背中に球根や花の四足」「しっぽの先に炎のトカゲ」
//     「甲羅のカメ」「翼のある橙のドラゴン」に寄せない。ネズミ・カエル・トカゲ・カメ・ドラゴンの種も使わない。
//   - 部品は多くても 60 個くらいまで（オフィスには 10 人いるので、重くしない）。
//   - staff の体の高さ：腰（椅子の座面）が y=0、頭の中心が body から +1.12 くらい。ロボットと同じ椅子に座る。

export const DEFAULTS = { staff: 'robot', buddy: 'none' };
export const NAME_MAX = 6; // 名札に添える名前の最大文字数

const SKIN = '#ffd8bd', HAIR = '#4a2f22', INK = '#2b2320', WHITE = '#ffffff';
const SHOW_OPEN = ['working', 'waiting'];

// ---------- 形を作る小道具 ----------
// 球（中心 c・半径 r）の表面の、向き (nx, ny) の点。d だけ外へ出す。rot はその点で正面（+z）が外を向く回転
function onSphere(c, r, nx, ny, d = 0) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), R = r + d;
  const ry = Math.asin(nx), rx = -Math.asin(ny / Math.max(1e-6, Math.cos(ry)));
  return { pos: [c[0] + R * nx, c[1] + R * ny, c[2] + R * nz], rot: [rx, ry, 0] };
}
// 相棒の大きな目（黒目・色の入った瞳・ハイライト2つ）。完了は笑った目、待機は細い目に切り替わる
function bigEyes({ at = 'head', c, r, nx = 0.36, ny = 0, size = 0.042, len = 0.034, iris, d0 = 0.002, sclera = false }) {
  const e = (d, dx = 0, dy = 0) => onSphere(c, r, nx + dx, ny + dy, d0 + d);
  const parts = [];
  if (sclera) parts.push({ shape: 'capsule', size: [size * 1.14, len * 1.02], at, ...e(-0.004), scale: [1, 1, 0.28], color: WHITE, flat: true, show: SHOW_OPEN, mirror: true });
  parts.push(
    { shape: 'capsule', size: [size, len], at, ...e(0), scale: [1, 1, 0.4], color: INK, flat: true, show: SHOW_OPEN, mirror: true },
    { shape: 'capsule', size: [size * 0.74, len * 0.62], at, ...e(0.007, 0, -0.045), scale: [1, 1, 0.4], color: iris, flat: true, show: SHOW_OPEN, mirror: true },
    { shape: 'sphere', size: [size * 0.38], at, pos: e(0.02, 0.055, 0.11).pos, color: WHITE, flat: true, show: SHOW_OPEN, mirror: true },
    { shape: 'sphere', size: [size * 0.19], at, pos: e(0.02, -0.05, -0.13).pos, color: WHITE, flat: true, show: SHOW_OPEN, mirror: true },
    { shape: 'torus', size: [size * 0.85, size * 0.27, Math.PI], at, ...e(0.004, 0, -0.03), color: INK, flat: true, show: ['done'], mirror: true },
    { shape: 'box', size: [size * 1.6, size * 0.3, 0.01], at, ...e(0.004, 0, -0.03), color: INK, flat: true, show: ['idle'], mirror: true },
  );
  return parts;
}
// 光のきらめき（十字）
const sparkle = (at, pos, s = 0.06, color = '#ffd84a', rz = 0) => [
  { shape: 'box', size: [s, s * 0.2, s * 0.2], at, pos, rot: [0, 0, rz], color, glow: 0.9 },
  { shape: 'box', size: [s * 0.2, s, s * 0.2], at, pos, rot: [0, 0, rz], color, glow: 0.9 },
];

export const CHARACTERS = [
  // ───────── 担当（机に座る） ─────────
  {
    id: 'robot', slot: 'staff', name: 'ロボット（初期）', nick: '', desc: 'いつもの白いロボット。部署ごとに服や小物が少し違う',
    builtin: 'robot',
  },
  {
    id: 'explorer', slot: 'staff', name: '冒険家ミトロ', nick: 'ミトロ', desc: 'キャップとショート丈ジャケットの冒険家。上着は部署の色、小物は部署ごとに変わる',
    rig: { type: 'seated', chair: true, fit: { head: 1, hair: HAIR } },
    parts: [
      // 脚（座った形）：ショートパンツ・すね・くつ下・スニーカー
      { shape: 'capsule', size: [0.105, 0.26], at: 'root', pos: [0.13, 0.64, 0.17], rot: [Math.PI / 2, 0, 0], color: '#c9a46a', mirror: true },
      { shape: 'capsule', size: [0.08, 0.3], at: 'root', pos: [0.13, 0.38, 0.36], color: SKIN, mirror: true },
      { shape: 'cylinder', size: [0.085, 0.085, 0.07], at: 'root', pos: [0.13, 0.2, 0.36], color: '#ffffff', mirror: true },
      { shape: 'capsule', size: [0.09, 0.14], at: 'root', pos: [0.13, 0.1, 0.42], rot: [Math.PI / 2, 0, 0], color: '#ffffff', mirror: true },
      { shape: 'box', size: [0.19, 0.04, 0.34], at: 'root', pos: [0.13, 0.025, 0.42], color: 'dept', mirror: true },
      { shape: 'box', size: [0.12, 0.03, 0.1], at: 'root', pos: [0.13, 0.17, 0.46], rot: [0.5, 0, 0], color: 'deptDark', mirror: true },
      // 胴：シャツ（下）＋ショート丈のジャケット（上）
      { shape: 'capsule', size: [0.24, 0.28], at: 'body', pos: [0, 0.4, 0], scale: [1.05, 1, 0.85], color: '#c9a46a' },
      { shape: 'cylinder', size: [0.262, 0.262, 0.09], at: 'body', pos: [0, 0.37, 0], scale: [1.05, 1, 0.86], color: '#fff6e3' },
      { shape: 'ring', size: [0.255, 0.024], at: 'body', pos: [0, 0.3, 0], scale: [1.05, 1, 0.86], color: '#6b4a2b' },
      { shape: 'cylinder', size: [0.27, 0.29, 0.32], at: 'body', pos: [0, 0.57, 0], scale: [1.05, 1, 0.86], color: 'dept', slot: 'top' },
      { shape: 'sphere', size: [0.27], at: 'body', pos: [0, 0.73, 0], scale: [1.08, 0.5, 0.88], color: 'dept', slot: 'top' },
      { shape: 'ring', size: [0.29, 0.028], at: 'body', pos: [0, 0.41, 0], scale: [1.05, 1, 0.86], color: 'deptDark', slot: 'top' },
      { shape: 'box', size: [0.1, 0.3, 0.02], at: 'body', pos: [0, 0.56, 0.252], color: '#fff6e3' },
      { shape: 'box', size: [0.1, 0.035, 0.02], at: 'body', pos: [0.15, 0.5, 0.245], color: 'deptDark', mirror: true, slot: 'top' },
      // 首のスカーフ（スーツの部署ではネクタイに置きかわる）
      { shape: 'cylinder', size: [0.08, 0.08, 0.12], at: 'body', pos: [0, 0.86, 0], color: SKIN },
      { shape: 'ring', size: [0.13, 0.05], at: 'body', pos: [0, 0.8, 0.01], color: '#ffc94a', slot: 'neck' },
      { shape: 'cone', size: [0.07, 0.13], at: 'body', pos: [0.05, 0.71, 0.2], rot: [Math.PI + 0.3, 0, 0.25], color: '#ffc94a', slot: 'neck' },
      // 頭：顔・耳・髪
      { shape: 'sphere', size: [0.42], at: 'head', pos: [0, 0, 0], color: SKIN },
      { shape: 'sphere', size: [0.07], at: 'head', pos: [0.41, -0.03, 0], scale: [0.6, 1, 1], color: SKIN, mirror: true },
      { shape: 'sphere', size: [0.435], at: 'head', pos: [0, 0.03, -0.045], color: HAIR, rough: 0.8 },
      { shape: 'sphere', size: [0.09], at: 'head', pos: [0.17, 0.08, 0.35], scale: [1.1, 0.7, 0.55], color: HAIR, rough: 0.8, mirror: true },
      { shape: 'sphere', size: [0.09], at: 'head', pos: [0, 0.09, 0.375], scale: [1.2, 0.7, 0.55], color: HAIR, rough: 0.8 },
      // キャップ（無地。つばは前）。ベレー帽の部署では隠れる
      { shape: 'dome', size: [0.45], at: 'head', pos: [0, 0.09, -0.01], scale: [1.02, 0.86, 1.02], color: 'deptDark', rough: 0.7, slot: 'hat' },
      { shape: 'cylinder', size: [0.29, 0.29, 0.035], at: 'head', pos: [0, 0.13, 0.4], rot: [0.12, 0, 0], scale: [1, 1, 0.8], color: 'deptDark', rough: 0.7, slot: 'hat' },
      { shape: 'sphere', size: [0.04], at: 'head', pos: [0, 0.48, -0.01], color: 'dept', slot: 'hat' },
      { shape: 'ring', size: [0.455, 0.02], at: 'head', pos: [0, 0.1, -0.01], color: 'dept', slot: 'hat' },
      // 目（状態で切り替え）・口
      { shape: 'capsule', size: [0.066, 0.07], at: 'head', pos: [0.145, -0.02, 0.378], rot: [0, 0.33, 0], scale: [1, 1, 0.45], color: INK, flat: true, show: ['working', 'waiting'], mirror: true },
      { shape: 'sphere', size: [0.024], at: 'head', pos: [0.165, 0.03, 0.405], color: '#ffffff', flat: true, show: ['working', 'waiting'], mirror: true },
      { shape: 'torus', size: [0.058, 0.017, Math.PI], at: 'head', pos: [0.145, -0.04, 0.39], rot: [0, 0.33, 0], color: INK, flat: true, show: ['done'], mirror: true },
      { shape: 'box', size: [0.11, 0.02, 0.01], at: 'head', pos: [0.145, -0.04, 0.393], rot: [0, 0.33, 0], color: INK, flat: true, show: ['idle'], mirror: true },
      { shape: 'torus', size: [0.045, 0.012, Math.PI], at: 'head', pos: [0, -0.16, 0.385], rot: [0, 0, Math.PI], color: '#8a3b2e', flat: true, show: ['working', 'waiting', 'done'] },
      // 腕：袖・袖口・手
      { shape: 'capsule', size: [0.085, 0.28], at: 'arms', pos: [0, -0.2, 0], color: 'dept', slot: 'top' },
      { shape: 'ring', size: [0.085, 0.022], at: 'arms', pos: [0, -0.36, 0], color: 'deptDark', slot: 'top' },
      { shape: 'sphere', size: [0.085], at: 'arms', pos: [0, -0.44, 0], color: SKIN },
    ],
  },

  // ───────── 相棒（机の上に立つ小さな生き物） ─────────
  // どの相棒も同じ骨組み：足・脚・胴（腹の色ちがい）・大きな頭（耳・目・口）・腕（片方を上げて動きを出す）・しっぽ・属性の飾り
  (() => {
    const M = '#7fd8bd', MD = '#3c9e86', MK = '#2e6a5e', CR = '#fff4dc', G = '#ffcb3d', GD = '#d99a00';
    const hc = [0, 0.03, 0], R = 0.17;
    return {
      id: 'charimo', slot: 'buddy', name: 'チャリモ', nick: 'チャリモ', recommend: ['accounting'],
      desc: 'ミントの子ダヌキ。金のコインを高く掲げ、まわりがきらめく（光の属性・経理向け）',
      rig: {
        type: 'buddy', seat: 'desk',
        neck: { pos: [0, 0.275, 0], r: 0.142, sz: 0.92 }, top: { at: 'head', pos: [0, 0.2, 0] },
        joints: {
          head: { pos: [0, 0.4, 0.01], motion: 'tilt', amp: 0.5 },
          armR: { pos: [0.13, 0.3, 0.02], rot: [0, 0, 2.5], motion: 'wave', amp: 0.6 },
          armL: { pos: [-0.13, 0.29, 0.03], rot: [-0.5, 0, -0.35], motion: 'nod', amp: 0.4, phase: 1.2 },
          tail: { pos: [0, 0.12, -0.13], motion: 'wag', amp: 0.8 },
        },
      },
      parts: [
        // 足・脚
        { shape: 'sphere', size: [0.052], pos: [0.072, 0.028, 0.035], scale: [1, 0.6, 1.35], color: MD, mirror: true },
        { shape: 'capsule', size: [0.045, 0.035], pos: [0.072, 0.07, 0], color: M, mirror: true },
        // 胴・腹・背中の模様・わきのコイン
        { shape: 'sphere', size: [0.15], pos: [0, 0.2, 0], scale: [1.05, 1.1, 0.95], color: M },
        { shape: 'sphere', size: [0.115], pos: [0, 0.185, 0.07], scale: [1, 1.08, 0.75], color: CR },
        { shape: 'sphere', size: [0.11], pos: [0, 0.25, -0.07], scale: [0.95, 0.9, 0.6], color: MD },
        { shape: 'disc', size: [0.03, 0.012], pos: [0.152, 0.2, -0.03], face: [1, 0.05, -0.2], color: G, rough: 0.3, metal: 0.5, mirror: true },
        // 頭：顔・鼻まわり・タヌキの目のまわりの模様・耳・おでこのコイン
        { shape: 'sphere', size: [R], at: 'head', pos: hc, color: M },
        { shape: 'sphere', size: [0.075], at: 'head', pos: onSphere(hc, R, 0, -0.38, -0.045).pos, scale: [1.25, 0.8, 0.85], color: CR },
        { shape: 'sphere', size: [0.022], at: 'head', pos: [0, 0.0, 0.178], scale: [1.3, 0.9, 1], color: '#2f4a44' },
        { shape: 'torus', size: [0.02, 0.006, Math.PI], at: 'head', pos: [0, -0.042, 0.172], rot: [0, 0, Math.PI], color: '#2f4a44', flat: true },
        { shape: 'sphere', size: [0.072], at: 'head', pos: onSphere(hc, R, 0.37, -0.01, -0.014).pos, rot: [onSphere(hc, R, 0.37, -0.01).rot[0], onSphere(hc, R, 0.37, -0.01).rot[1], -0.4], scale: [1.15, 0.85, 0.4], color: MK, mirror: true },
        ...bigEyes({ c: hc, r: R, size: 0.04, len: 0.03, iris: '#d9821f', d0: 0.008, sclera: true }),
        { shape: 'sphere', size: [0.052], at: 'head', pos: [0.12, 0.155, -0.02], rot: [0, 0, -0.35], scale: [0.85, 1.15, 0.5], color: MD, mirror: true },
        { shape: 'sphere', size: [0.031], at: 'head', pos: [0.118, 0.15, 0.004], rot: [0, 0, -0.35], scale: [0.85, 1.15, 0.4], color: CR, mirror: true },
        { shape: 'disc', size: [0.034, 0.012], at: 'head', pos: onSphere(hc, R, 0, 0.5, 0.003).pos, face: [0, 0.5, 0.866], color: G, rough: 0.3, metal: 0.5 },
        { shape: 'ring', size: [0.025, 0.006], at: 'head', pos: onSphere(hc, R, 0, 0.5, 0.01).pos, face: [0, 0.5, 0.866], color: GD, rough: 0.3, metal: 0.5 },
        // 右手：コインを高く掲げる（光る）
        { shape: 'capsule', size: [0.038, 0.07], at: 'armR', pos: [0, -0.055, 0], color: M },
        { shape: 'sphere', size: [0.044], at: 'armR', pos: [0, -0.11, 0], color: MD },
        { shape: 'disc', size: [0.066, 0.02], at: 'armR', pos: [0, -0.175, 0.03], face: [0, 0, 1], color: G, rough: 0.25, metal: 0.55, glow: 0.25 },
        { shape: 'ring', size: [0.05, 0.009], at: 'armR', pos: [0, -0.175, 0.043], face: [0, 0, 1], color: GD, rough: 0.3, metal: 0.5 },
        ...sparkle('armR', [0.075, -0.25, 0.04], 0.07),
        ...sparkle('armR', [-0.07, -0.21, 0.05], 0.045, '#ffe680', Math.PI / 4),
        // 左手：おなかの前
        { shape: 'capsule', size: [0.038, 0.07], at: 'armL', pos: [0, -0.055, 0], color: M },
        { shape: 'sphere', size: [0.044], at: 'armL', pos: [0, -0.11, 0], color: MD },
        // しっぽ：ふさふさのしま模様、先は濃い色
        { shape: 'capsule', size: [0.068, 0.1], at: 'tail', pos: [0, 0.07, -0.05], rot: [-0.6, 0, 0], color: M },
        { shape: 'ring', size: [0.07, 0.016], at: 'tail', pos: [0, 0.103, -0.073], rot: [-0.6, 0, 0], color: MD },
        { shape: 'ring', size: [0.07, 0.016], at: 'tail', pos: [0, 0.037, -0.027], rot: [-0.6, 0, 0], color: MD },
        { shape: 'sphere', size: [0.07], at: 'tail', pos: [0, 0.165, -0.115], color: MD },
      ],
    };
  })(),
  (() => {
    const B = '#4a3aa8', BD = '#2a2068', P = '#9c8ff0', PL = '#cfc8ff', C = '#3fd8ff';
    const hc = [0, 0.03, 0], R = 0.165;
    return {
      id: 'lumitto', slot: 'buddy', name: 'ルミット', nick: 'ルミット', recommend: ['programmer'],
      desc: 'すみれ色の子ネコ。耳・ひげ・背中の回路・しっぽの先が光り、前足の先に光る立方体（光の属性・プログラマー向け）',
      rig: {
        type: 'buddy', seat: 'desk',
        neck: { pos: [0, 0.27, 0], r: 0.128, sz: 0.95 }, top: { at: 'head', pos: [0, 0.195, 0] },
        joints: {
          head: { pos: [0, 0.4, 0.01], motion: 'tilt', amp: 0.5 },
          armL: { pos: [-0.125, 0.29, 0.03], rot: [-1.1, 0, -0.15], motion: 'nod', amp: 0.6 },
          armR: { pos: [0.125, 0.29, 0.03], rot: [-0.2, 0, 0.3], motion: 'nod', amp: 0.3, phase: 2 },
          tail: { pos: [0, 0.11, -0.12], motion: 'swish', amp: 0.8 },
        },
      },
      parts: [
        // 足（白いくつ下）・脚
        { shape: 'sphere', size: [0.05], pos: [0.068, 0.028, 0.035], scale: [1, 0.6, 1.35], color: PL, mirror: true },
        { shape: 'capsule', size: [0.043, 0.035], pos: [0.068, 0.07, 0], color: B, mirror: true },
        // 胴・腹・背中の回路（光る線）
        { shape: 'sphere', size: [0.14], pos: [0, 0.2, 0], scale: [1, 1.15, 0.95], color: B, rough: 0.35 },
        { shape: 'sphere', size: [0.103], pos: [0, 0.18, 0.068], scale: [0.72, 1.12, 0.75], color: P },
        { shape: 'ring', size: [0.134, 0.006, 2.6], pos: [0, 0.25, 0], rot: [0, Math.PI + 0.27, 0], scale: [1, 1, 0.95], color: C, glow: 0.7 },
        { shape: 'ring', size: [0.137, 0.006, 2.2], pos: [0, 0.16, 0], rot: [0, Math.PI + 0.47, 0], scale: [1, 1, 0.95], color: C, glow: 0.7 },
        { shape: 'sphere', size: [0.014], pos: [0.13, 0.25, -0.03], color: '#9ff2ff', glow: 1, mirror: true },
        // 頭：顔・鼻・口・光るひげ・とがった耳（内側が光る）・おでこのしるし
        { shape: 'sphere', size: [R], at: 'head', pos: hc, color: B, rough: 0.35 },
        { shape: 'sphere', size: [0.06], at: 'head', pos: onSphere(hc, R, 0, -0.4, -0.04).pos, scale: [1.35, 0.75, 0.8], color: P },
        { shape: 'sphere', size: [0.016], at: 'head', pos: [0, -0.008, 0.172], scale: [1.3, 0.9, 1], color: '#ff9cc2' },
        { shape: 'torus', size: [0.014, 0.005, Math.PI], at: 'head', pos: [0.014, -0.03, 0.168], rot: [0, 0, Math.PI], color: BD, flat: true, mirror: true },
        { shape: 'box', size: [0.075, 0.005, 0.005], at: 'head', pos: [0.105, -0.02, 0.13], rot: [0, -0.55, 0.12], color: C, glow: 0.8, mirror: true },
        { shape: 'box', size: [0.075, 0.005, 0.005], at: 'head', pos: [0.105, -0.042, 0.128], rot: [0, -0.55, -0.1], color: C, glow: 0.8, mirror: true },
        { shape: 'cone', size: [0.062, 0.13], at: 'head', pos: [0.095, 0.165, -0.01], rot: [0, 0, -0.38], color: B, rough: 0.35, mirror: true },
        { shape: 'cone', size: [0.04, 0.09], at: 'head', pos: [0.093, 0.158, 0.014], rot: [0, 0, -0.38], scale: [1, 1, 0.45], color: C, glow: 0.6, mirror: true },
        { shape: 'box', size: [0.03, 0.03, 0.008], at: 'head', ...onSphere(hc, R, 0, 0.45, 0.002), color: C, glow: 0.8 },
        ...bigEyes({ c: hc, r: R, size: 0.042, len: 0.034, iris: '#3fd8ff' }),
        // 左の前足：前へ伸ばし、その先に光る立方体
        { shape: 'capsule', size: [0.036, 0.07], at: 'armL', pos: [0, -0.055, 0], color: B },
        { shape: 'sphere', size: [0.042], at: 'armL', pos: [0, -0.11, 0], color: PL },
        { shape: 'box', size: [0.045, 0.045, 0.045], at: 'armL', pos: [0, -0.2, 0.0], rot: [0.6, 0.6, 0], color: C, glow: 0.9 },
        // 右の前足
        { shape: 'capsule', size: [0.036, 0.07], at: 'armR', pos: [0, -0.055, 0], color: B },
        { shape: 'sphere', size: [0.042], at: 'armR', pos: [0, -0.11, 0], color: PL },
        // しっぽ：3つに曲がって上を向き、先に光る玉
        { shape: 'capsule', size: [0.028, 0.08], at: 'tail', pos: [0, 0.03, -0.05], rot: [-1.0, 0, 0], color: B },
        { shape: 'capsule', size: [0.027, 0.08], at: 'tail', pos: [0, 0.134, -0.12], rot: [-0.2, 0, 0], color: B },
        { shape: 'ring', size: [0.03, 0.006], at: 'tail', pos: [0, 0.134, -0.12], rot: [-0.2, 0, 0], color: C, glow: 0.7 },
        { shape: 'capsule', size: [0.025, 0.07], at: 'tail', pos: [0, 0.241, -0.106], rot: [0.6, 0, 0], color: B },
        { shape: 'sphere', size: [0.042], at: 'tail', pos: [0, 0.3, -0.065], color: C, glow: 1 },
      ],
    };
  })(),
  (() => {
    const B = '#4fc3f7', BD = '#2196d3', CR = '#fdf7ec', BK = '#ffc23d', LG = '#ff9f2e', PK = '#ff7aa8', TP = '#bdeeff', W = '#c8f4ff';
    const hc = [0, 0.04, 0], R = 0.16;
    return {
      id: 'churio', slot: 'buddy', name: 'チュリオ', nick: 'チュリオ', recommend: ['sales'],
      desc: '空色の小鳥。片方の羽を上げてあいさつ、足もとに風のうず（風の属性・営業向け）',
      rig: {
        type: 'buddy', seat: 'desk',
        neck: { pos: [0, 0.275, 0], r: 0.135, sz: 0.95 }, top: { at: 'head', pos: [0, 0.2, 0] },
        joints: {
          head: { pos: [0, 0.39, 0.01], motion: 'tilt', amp: 0.5 },
          wingR: { pos: [0.14, 0.29, 0], rot: [0, 0, 2.3], motion: 'wave', amp: 0.9 },
          wingL: { pos: [-0.14, 0.29, 0], rot: [0, 0, -0.45], motion: 'flapL', amp: 0.4 },
          tail: { pos: [0, 0.14, -0.13], motion: 'wag', amp: 0.7 },
          wind: { pos: [0, 0, 0], motion: 'spin' },
        },
      },
      parts: [
        // 脚と3本指の足
        { shape: 'capsule', size: [0.016, 0.05], pos: [0.055, 0.06, 0.01], color: LG, mirror: true },
        { shape: 'capsule', size: [0.012, 0.035], pos: [0.055, 0.014, 0.045], rot: [Math.PI / 2, 0, 0], color: LG, mirror: true },
        { shape: 'capsule', size: [0.011, 0.03], pos: [0.078, 0.014, 0.04], rot: [Math.PI / 2, 0, -0.55], color: LG, mirror: true },
        { shape: 'capsule', size: [0.011, 0.03], pos: [0.032, 0.014, 0.04], rot: [Math.PI / 2, 0, 0.55], color: LG, mirror: true },
        // 胴・腹・腹のうろこ模様
        { shape: 'sphere', size: [0.15], pos: [0, 0.2, 0], scale: [1, 1.08, 0.95], color: B },
        { shape: 'sphere', size: [0.12], pos: [0, 0.18, 0.068], scale: [0.95, 1.05, 0.78], color: CR },
        { shape: 'torus', size: [0.03, 0.006, Math.PI], pos: [0, 0.205, 0.163], rot: [0, 0, Math.PI], color: '#f0cf9e', flat: true },
        { shape: 'torus', size: [0.03, 0.006, Math.PI], pos: [0.042, 0.15, 0.152], rot: [0, 0.3, Math.PI], color: '#f0cf9e', flat: true, mirror: true },
        // 頭：顔の白い所・くちばし（少し開いて笑う）・冠羽・耳羽
        { shape: 'sphere', size: [R], at: 'head', pos: hc, color: B },
        { shape: 'sphere', size: [0.12], at: 'head', pos: onSphere(hc, R, 0, -0.1, -0.06).pos, scale: [1.3, 0.95, 0.55], color: CR },
        { shape: 'cone', size: [0.04, 0.075], at: 'head', pos: [0, 0.0, 0.19], rot: [Math.PI / 2, 0, 0], scale: [1.2, 1, 0.75], color: BK },
        { shape: 'cone', size: [0.03, 0.05], at: 'head', pos: [0, -0.028, 0.178], rot: [Math.PI / 2 + 0.4, 0, 0], scale: [1.1, 1, 0.7], color: '#f29a1d' },
        { shape: 'cone', size: [0.028, 0.12], at: 'head', pos: [0, 0.21, 0.01], rot: [-0.2, 0, 0], color: PK },
        { shape: 'cone', size: [0.024, 0.1], at: 'head', pos: [0.042, 0.19, -0.005], rot: [-0.25, 0, -0.5], color: PK, mirror: true },
        { shape: 'sphere', size: [0.045], at: 'head', pos: [0.135, 0.11, -0.02], rot: [0, 0, -0.6], scale: [0.5, 1.1, 0.6], color: BD, mirror: true },
        ...bigEyes({ c: hc, r: R, ny: 0.04, size: 0.04, len: 0.03, iris: '#1b4f8a', d0: 0.012 }),
        // 右の羽：上げてあいさつ（先は明るい色）
        { shape: 'sphere', size: [0.1], at: 'wingR', pos: [0, -0.085, 0], scale: [0.38, 1, 0.75], color: BD },
        { shape: 'cone', size: [0.022, 0.07], at: 'wingR', pos: [0, -0.2, 0], rot: [Math.PI, 0, 0], color: TP },
        { shape: 'cone', size: [0.02, 0.06], at: 'wingR', pos: [0, -0.19, 0.035], rot: [Math.PI - 0.35, 0, 0], color: TP },
        { shape: 'cone', size: [0.02, 0.06], at: 'wingR', pos: [0, -0.19, -0.035], rot: [Math.PI + 0.35, 0, 0], color: TP },
        // 左の羽
        { shape: 'sphere', size: [0.1], at: 'wingL', pos: [0, -0.085, 0], scale: [0.38, 1, 0.75], color: BD },
        { shape: 'cone', size: [0.022, 0.07], at: 'wingL', pos: [0, -0.2, 0], rot: [Math.PI, 0, 0], color: TP },
        { shape: 'cone', size: [0.02, 0.06], at: 'wingL', pos: [0, -0.19, 0.035], rot: [Math.PI - 0.35, 0, 0], color: TP },
        { shape: 'cone', size: [0.02, 0.06], at: 'wingL', pos: [0, -0.19, -0.035], rot: [Math.PI + 0.35, 0, 0], color: TP },
        // しっぽの羽（扇形）
        { shape: 'sphere', size: [0.055], at: 'tail', pos: [0, 0.05, -0.03], rot: [-0.9, 0, 0], scale: [0.35, 1.25, 0.25], color: BD },
        { shape: 'sphere', size: [0.05], at: 'tail', pos: [0.04, 0.045, -0.025], rot: [-0.9, 0, -0.45], scale: [0.35, 1.2, 0.25], color: B, mirror: true },
        // 風のうず（足もとで回る）
        { shape: 'ring', size: [0.2, 0.007, 3.6], at: 'wind', pos: [0, 0.05, 0], rot: [0, 0.6, 0], color: W, glow: 0.35 },
        { shape: 'ring', size: [0.17, 0.006, 3.0], at: 'wind', pos: [0, 0.11, 0], rot: [0, 2.6, 0.12], color: W, glow: 0.35 },
      ],
    };
  })(),
  (() => {
    const L = '#a6e472', LD = '#4fae3c', CR = '#fffbe6', LF = '#3fae55', LL = '#8fe07a';
    const hc = [0, 0.04, 0], R = 0.16;
    return {
      id: 'pyorun', slot: 'buddy', name: 'ピョルン', nick: 'ピョルン', recommend: ['hr'],
      desc: '若葉色の子ウサギ。耳が葉っぱの形で、頭に芽。両手を上げて応援、まわりを葉っぱが舞う（葉の属性・人事向け）',
      rig: {
        type: 'buddy', seat: 'desk',
        neck: { pos: [0, 0.27, 0], r: 0.127, sz: 0.95 }, top: { at: 'head', pos: [0, 0.2, 0] },
        joints: {
          head: { pos: [0, 0.39, 0.01], motion: 'tilt', amp: 0.5 },
          armL: { pos: [-0.125, 0.29, 0.03], rot: [0, 0, -2.3], motion: 'wave', amp: 0.6, phase: Math.PI },
          armR: { pos: [0.125, 0.29, 0.03], rot: [0, 0, 2.3], motion: 'wave', amp: 0.6 },
          tail: { pos: [0, 0.13, -0.13], motion: 'wag', amp: 0.6 },
          leaves: { pos: [0, 0.22, 0], motion: 'spin' },
        },
      },
      parts: [
        // 長い足・脚
        { shape: 'sphere', size: [0.05], pos: [0.07, 0.025, 0.05], scale: [0.75, 0.5, 1.7], color: LD, mirror: true },
        { shape: 'capsule', size: [0.045, 0.03], pos: [0.07, 0.07, 0], color: L, mirror: true },
        // 胴・腹・おなかの葉っぱのしるし・背中の濃い色
        { shape: 'sphere', size: [0.14], pos: [0, 0.2, 0], scale: [1, 1.12, 0.95], color: L },
        { shape: 'sphere', size: [0.108], pos: [0, 0.18, 0.068], scale: [1, 1.08, 0.75], color: CR },
        { shape: 'sphere', size: [0.03], pos: [0, 0.2, 0.15], rot: [0, 0, 0.5], scale: [0.55, 1, 0.25], color: LF },
        { shape: 'sphere', size: [0.1], pos: [0, 0.24, -0.07], scale: [0.95, 0.9, 0.6], color: LD },
        // 頭：口もと・鼻・前歯・葉っぱの耳（中に葉脈）・頭の芽
        { shape: 'sphere', size: [R], at: 'head', pos: hc, color: L },
        { shape: 'sphere', size: [0.06], at: 'head', pos: onSphere(hc, R, 0, -0.38, -0.04).pos, scale: [1.3, 0.8, 0.8], color: CR },
        { shape: 'sphere', size: [0.015], at: 'head', pos: [0, 0.012, 0.172], scale: [1.3, 0.9, 1], color: '#ff8fb0' },
        { shape: 'torus', size: [0.014, 0.005, Math.PI], at: 'head', pos: [0.014, -0.012, 0.17], rot: [0, 0, Math.PI], color: '#4d7a3a', flat: true, mirror: true },
        { shape: 'box', size: [0.024, 0.02, 0.006], at: 'head', pos: [0, -0.034, 0.166], color: WHITE },
        { shape: 'sphere', size: [0.08], at: 'head', pos: [0.072, 0.25, -0.02], rot: [-0.15, 0, -0.22], scale: [0.6, 1.3, 0.22], color: LF, mirror: true },
        { shape: 'box', size: [0.009, 0.15, 0.006], at: 'head', pos: [0.071, 0.24, -0.002], rot: [-0.15, 0, -0.22], color: LL, mirror: true },
        { shape: 'cylinder', size: [0.008, 0.008, 0.05], at: 'head', pos: [0, 0.22, 0.03], color: LF },
        { shape: 'sphere', size: [0.032], at: 'head', pos: [0.026, 0.25, 0.03], rot: [0, 0, 0.5], scale: [1, 0.3, 0.55], color: LL, mirror: true },
        ...bigEyes({ c: hc, r: R, size: 0.04, len: 0.032, iris: '#2f8f46' }),
        // 両手を上げて応援
        { shape: 'capsule', size: [0.035, 0.065], at: 'armL', pos: [0, -0.05, 0], color: L },
        { shape: 'sphere', size: [0.04], at: 'armL', pos: [0, -0.105, 0], color: CR },
        { shape: 'capsule', size: [0.035, 0.065], at: 'armR', pos: [0, -0.05, 0], color: L },
        { shape: 'sphere', size: [0.04], at: 'armR', pos: [0, -0.105, 0], color: CR },
        // しっぽ：わたの玉に葉っぱ
        { shape: 'sphere', size: [0.055], at: 'tail', pos: [0, 0, -0.02], color: CR },
        { shape: 'sphere', size: [0.03], at: 'tail', pos: [0, 0.04, -0.06], rot: [-0.6, 0, 0.3], scale: [0.5, 1, 0.22], color: LF },
        // まわりを舞う葉っぱ
        { shape: 'sphere', size: [0.032], at: 'leaves', pos: [0.21, 0.2, 0.04], rot: [0.3, 0, -0.8], scale: [0.5, 1, 0.15], color: LL },
        { shape: 'sphere', size: [0.03], at: 'leaves', pos: [-0.2, -0.07, 0.09], rot: [0.2, 0, 0.9], scale: [0.5, 1, 0.15], color: LF },
        { shape: 'sphere', size: [0.026], at: 'leaves', pos: [0.02, 0.05, -0.22], rot: [0.9, 0, 0.3], scale: [0.5, 1, 0.15], color: LL },
      ],
    };
  })(),
  (() => {
    const A = '#45c4ea', AD = '#1e8fc0', W = '#f3fcff', D = '#9fe9ff';
    const hc = [0, 0.04, 0], R = 0.165;
    const drop = (at, pos, s = 0.022) => [
      { shape: 'sphere', size: [s], at, pos, color: D, glow: 0.35 },
      { shape: 'cone', size: [s * 0.95, s * 1.7], at, pos: [pos[0], pos[1] + s * 1.15, pos[2]], color: D, glow: 0.35 },
    ];
    return {
      id: 'akuwan', slot: 'buddy', name: 'アクワン', nick: 'アクワン', recommend: ['support'],
      desc: '水色の子イヌ。たれ耳の先が水のしずく、しっぽを振ると水しぶき。前足を上げてごきげん（水の属性・カスタマーサポート向け）',
      rig: {
        type: 'buddy', seat: 'desk',
        neck: { pos: [0, 0.27, 0], r: 0.132, sz: 0.95 }, top: { at: 'head', pos: [0, 0.205, 0] },
        joints: {
          head: { pos: [0, 0.39, 0.01], motion: 'tilt', amp: 0.6 },
          armL: { pos: [-0.125, 0.29, 0.03], rot: [-1.3, 0, -0.25], motion: 'nod', amp: 0.6 },
          armR: { pos: [0.125, 0.29, 0.03], rot: [-1.3, 0, 0.25], motion: 'nod', amp: 0.6, phase: Math.PI },
          tail: { pos: [0, 0.13, -0.13], motion: 'wag', amp: 1.3 },
          drops: { pos: [0, 0.25, 0], motion: 'spin' },
        },
      },
      parts: [
        // 足（白）・脚
        { shape: 'sphere', size: [0.052], pos: [0.07, 0.028, 0.035], scale: [1, 0.6, 1.35], color: W, mirror: true },
        { shape: 'capsule', size: [0.045, 0.035], pos: [0.07, 0.07, 0], color: A, mirror: true },
        // 胴・腹・背中のぶち
        { shape: 'sphere', size: [0.145], pos: [0, 0.2, 0], scale: [1, 1.1, 0.95], color: A },
        { shape: 'sphere', size: [0.112], pos: [0, 0.18, 0.068], scale: [0.8, 1.08, 0.75], color: '#bdf0ff' },
        { shape: 'sphere', size: [0.052], pos: [0.088, 0.235, -0.1], face: [0.6, 0.2, -0.76], scale: [1, 0.3, 0.8], color: AD, mirror: true },
        // 頭：白い口もと・鼻・開いた口と舌・おでこのしずく模様・たれ耳（先が水のしずく）
        { shape: 'sphere', size: [R], at: 'head', pos: hc, color: A },
        { shape: 'sphere', size: [0.07], at: 'head', pos: onSphere(hc, R, 0, -0.36, -0.04).pos, scale: [1.25, 0.8, 0.95], color: W },
        { shape: 'sphere', size: [0.024], at: 'head', pos: [0, 0.006, 0.19], scale: [1.3, 0.9, 1], color: '#1d3b4f' },
        { shape: 'sphere', size: [0.026], at: 'head', pos: [0, -0.04, 0.178], scale: [1.2, 0.8, 0.5], color: '#7a2e3a', show: ['working', 'waiting', 'done'] },
        { shape: 'capsule', size: [0.016, 0.018], at: 'head', pos: [0, -0.06, 0.182], rot: [0.4, 0, 0], scale: [1.2, 1, 0.5], color: '#ff8fa8', show: ['working', 'waiting', 'done'] },
        { shape: 'sphere', size: [0.03], at: 'head', ...onSphere(hc, R, 0, 0.45, -0.006), scale: [0.8, 1.25, 0.35], color: W },
        { shape: 'sphere', size: [0.068], at: 'head', pos: [0.175, 0.02, 0.0], rot: [0, 0, 0.4], scale: [0.55, 1.3, 0.45], color: AD, mirror: true },
        { shape: 'sphere', size: [0.032], at: 'head', pos: [0.21, -0.065, 0.005], color: D, glow: 0.35, mirror: true },
        ...bigEyes({ c: hc, r: R, ny: 0.03, size: 0.042, len: 0.034, iris: '#1f6fb0' }),
        // 前足を上げる
        { shape: 'capsule', size: [0.037, 0.06], at: 'armL', pos: [0, -0.05, 0], color: A },
        { shape: 'sphere', size: [0.044], at: 'armL', pos: [0, -0.105, 0], color: W },
        { shape: 'capsule', size: [0.037, 0.06], at: 'armR', pos: [0, -0.05, 0], color: A },
        { shape: 'sphere', size: [0.044], at: 'armR', pos: [0, -0.105, 0], color: W },
        // しっぽ：先に水のしずくと、しぶき
        { shape: 'capsule', size: [0.03, 0.08], at: 'tail', pos: [0, 0.05, -0.03], rot: [-0.6, 0, 0], color: A },
        { shape: 'sphere', size: [0.04], at: 'tail', pos: [0, 0.12, -0.075], color: D, glow: 0.4 },
        { shape: 'sphere', size: [0.015], at: 'tail', pos: [0.045, 0.165, -0.07], color: D, glow: 0.5 },
        { shape: 'sphere', size: [0.012], at: 'tail', pos: [-0.045, 0.155, -0.09], color: D, glow: 0.5 },
        { shape: 'sphere', size: [0.011], at: 'tail', pos: [0, 0.19, -0.1], color: D, glow: 0.5 },
        // まわりをめぐる水のしずく
        ...drop('drops', [0.22, 0.1, 0.02]),
        ...drop('drops', [-0.21, -0.06, 0.08], 0.018),
      ],
    };
  })(),
];

// ───────── 部署ごとの小物（DEPT_KIT） ─────────
// 元の白いロボット（office3d.js の OUTFIT）の部署ごとの違いを、そのまま人型・相棒にも付ける。
//   items : 設定画面に出す「この部署の特徴」の説明
//   hides : 担当の部品のうち隠す slot（'hat'＝帽子、'neck'＝首まわりのスカーフ）
//   top   : 上着（slot:'top'）の色。スーツの部署だけ（ロボットのスーツと同じ色）。書かなければ部署の色
//   staff : 担当（人型）に足す部品。座標は標準の頭（半径 0.42）・胴に合わせてある。rig.fit.head で頭まわりは自動で拡大縮小
//   buddy : 相棒の飾り { accent:'tie'|'bow'|'tag'（ひし形の名札）, tie:'#色', hat:'beret'|'antenna'|'headset' }（首輪は全部署に付く）
const TIE_BLUE = '#2f5bd6', DARK = '#2a303c', JOINT = '#1b1f27', NAVY_BERET = '#26324a';
const KIT = {
  // スーツ：白いシャツのえり・ネクタイ（スカーフは外す）
  suit: (tie) => [
    { shape: 'box', size: [0.085, 0.05, 0.02], at: 'body', pos: [0.042, 0.79, 0.205], rot: [-0.35, 0, 0.62], color: WHITE },
    { shape: 'box', size: [0.085, 0.05, 0.02], at: 'body', pos: [-0.042, 0.79, 0.205], rot: [-0.35, 0, -0.62], color: WHITE },
    { shape: 'box', size: [0.12, 0.2, 0.02], at: 'body', pos: [0, 0.66, 0.253], color: WHITE },
    { shape: 'box', size: [0.055, 0.045, 0.03], at: 'body', pos: [0, 0.755, 0.238], color: tie },
    { shape: 'box', size: [0.055, 0.24, 0.02], at: 'body', pos: [0, 0.6, 0.27], color: tie },
    { shape: 'cone', size: [0.039, 0.04], at: 'body', pos: [0, 0.46, 0.27], rot: [Math.PI, 0, 0], scale: [1, 1, 0.26], color: tie },
  ],
  glasses: [
    { shape: 'torus', size: [0.08, 0.012], at: 'head', pos: [0.145, -0.02, 0.415], rot: [0, 0.33, 0], color: '#3a4150', rough: 0.3, metal: 0.5, mirror: true },
    { shape: 'box', size: [0.07, 0.014, 0.014], at: 'head', pos: [0, 0.0, 0.43], color: '#3a4150', rough: 0.3, metal: 0.5 },
  ],
  beret: [
    // キャップを外すと頭頂が見えるので、髪（rig.fit.hair の色）で覆ってからベレー帽をのせる
    { shape: 'dome', size: [0.44], at: 'head', pos: [0, 0.09, -0.02], color: 'hair', rough: 0.8 },
    { shape: 'sphere', size: [0.34], at: 'head', pos: [-0.04, 0.38, -0.03], rot: [0, 0, 0.18], scale: [1.22, 0.38, 1.16], color: NAVY_BERET, rough: 0.8 },
    { shape: 'cylinder', size: [0.022, 0.022, 0.07], at: 'head', pos: [-0.08, 0.52, -0.02], color: NAVY_BERET, rough: 0.8 },
  ],
  lanyard: [
    { shape: 'torus', size: [0.15, 0.01, Math.PI], at: 'body', pos: [0, 0.68, 0.22], rot: [0.35, 0, Math.PI], color: TIE_BLUE },
    { shape: 'box', size: [0.1, 0.13, 0.015], at: 'body', pos: [0, 0.5, 0.278], color: WHITE },
    { shape: 'box', size: [0.1, 0.03, 0.016], at: 'body', pos: [0, 0.548, 0.279], color: 'dept' },
  ],
  hoodie: [
    { shape: 'torus', size: [0.2, 0.07], at: 'body', pos: [0, 0.84, -0.12], rot: [Math.PI / 2.3, 0, 0], color: 'dept' },
    { shape: 'box', size: [0.28, 0.1, 0.03], at: 'body', pos: [0, 0.49, 0.262], color: 'deptLight' },
  ],
  antenna: [
    { shape: 'cylinder', size: [0.012, 0.012, 0.22], at: 'head', pos: [0, 0.58, 0], color: DARK },
    { shape: 'sphere', size: [0.05], at: 'head', pos: [0, 0.71, 0], color: '#ff5470', flat: true },
  ],
  megaphone: [
    { shape: 'cone', size: [0.12, 0.28], at: 'armL', pos: [0, -0.52, 0.1], rot: [-Math.PI / 2, 0, 0], color: WHITE },
    { shape: 'ring', size: [0.1, 0.014], at: 'armL', pos: [0, -0.52, 0.14], rot: [Math.PI / 2, 0, 0], color: 'dept' },
  ],
  bun: [
    { shape: 'sphere', size: [0.13], at: 'head', pos: [0, -0.02, -0.41], color: 'hair', rough: 0.7 },
    { shape: 'ring', size: [0.085, 0.016], at: 'head', pos: [0, -0.02, -0.34], face: [0, 0, -1], color: 'dept' },
  ],
  headphones: [
    { shape: 'torus', size: [0.5, 0.03, Math.PI], at: 'head', pos: [0, 0, 0], color: DARK },
    { shape: 'cylinder', size: [0.13, 0.13, 0.1], at: 'head', pos: [0.45, 0, 0], rot: [0, 0, Math.PI / 2], color: DARK, mirror: true },
    { shape: 'torus', size: [0.09, 0.016], at: 'head', pos: [0.505, 0, 0], rot: [0, Math.PI / 2, 0], color: '#5fd0ff', flat: true, mirror: true },
  ],
  mic: [
    { shape: 'capsule', size: [0.012, 0.36], at: 'head', pos: [0.3, -0.13, 0.22], face: [-0.32, -0.15, 0.31], color: DARK },
    { shape: 'sphere', size: [0.035], at: 'head', pos: [0.13, -0.21, 0.37], color: JOINT },
  ],
  pen: [
    { shape: 'cylinder', size: [0.015, 0.015, 0.26], at: 'armR', pos: [0, -0.5, 0.06], rot: [0.6, 0, 0], color: JOINT },
    { shape: 'cone', size: [0.015, 0.04], at: 'armR', pos: [0, -0.39, -0.015], rot: [0.6, 0, 0], color: 'dept' },
  ],
  mug: [
    { shape: 'cylinder', size: [0.06, 0.055, 0.12], at: 'armL', pos: [0, -0.5, 0.1], color: JOINT },
    { shape: 'torus', size: [0.035, 0.01], at: 'armL', pos: [-0.065, -0.5, 0.1], rot: [0, Math.PI / 2, 0], color: JOINT },
  ],
  vest: [
    { shape: 'box', size: [0.085, 0.05, 0.02], at: 'body', pos: [0.042, 0.79, 0.205], rot: [-0.35, 0, 0.62], color: WHITE },
    { shape: 'box', size: [0.085, 0.05, 0.02], at: 'body', pos: [-0.042, 0.79, 0.205], rot: [-0.35, 0, -0.62], color: WHITE },
    { shape: 'box', size: [0.12, 0.2, 0.02], at: 'body', pos: [0, 0.66, 0.253], color: WHITE },
    { shape: 'box', size: [0.05, 0.04, 0.03], at: 'body', pos: [0, 0.755, 0.238], color: JOINT },
    { shape: 'box', size: [0.05, 0.22, 0.02], at: 'body', pos: [0, 0.61, 0.27], color: JOINT },
    { shape: 'box', size: [0.12, 0.3, 0.02], at: 'body', pos: [0.115, 0.58, 0.245], rot: [0, 0.35, 0.18], color: '#2c3a55', mirror: true },
  ],
};
export const DEPT_KIT = {
  executive: { name: '執行役', items: '紺のスーツ・青いネクタイ・大きな机（体も一回り大きい）', hides: ['neck'], top: '#1f2a44', staff: KIT.suit(TIE_BLUE), buddy: { accent: 'tie', tie: TIE_BLUE } },
  planning: { name: '経営企画', items: 'メガネ・紺のベレー帽・名札（ストラップ）', hides: ['hat'], staff: [...KIT.glasses, ...KIT.beret, ...KIT.lanyard], buddy: { accent: 'tag', hat: 'beret' } },
  sales: { name: '営業', items: 'チャコールのスーツ・青いネクタイ', hides: ['neck'], top: '#2b303b', staff: KIT.suit(TIE_BLUE), buddy: { accent: 'tie', tie: TIE_BLUE } },
  marketing: { name: 'マーケティング', items: 'パーカー（フード・ポケット）・赤い玉のアンテナ・メガホン', hides: [], staff: [...KIT.hoodie, ...KIT.antenna, ...KIT.megaphone], buddy: { accent: 'tag', hat: 'antenna' } },
  hr: { name: '人事', items: 'シャツ・おだんご髪・名札（ストラップ）', hides: [], staff: [...KIT.bun, ...KIT.lanyard], buddy: { accent: 'bow' } },
  accounting: { name: '経理', items: 'メガネ', hides: [], staff: [...KIT.glasses], buddy: { accent: 'tag' } },
  support: { name: 'カスタマーサポート', items: 'マイク付きのヘッドセット', hides: [], staff: [...KIT.headphones, ...KIT.mic], buddy: { accent: 'tag', hat: 'headset' } },
  designer: { name: 'デザイナー', items: '紺のベレー帽・ペン', hides: ['hat'], staff: [...KIT.beret, ...KIT.pen], buddy: { accent: 'tag', hat: 'beret' } },
  programmer: { name: 'プログラマー', items: 'マグカップ（ロボットの共通のヘッドホンも付ける）', hides: [], staff: [...KIT.headphones, ...KIT.mug], buddy: { accent: 'tag' } },
  analyst: { name: 'データ分析担当', items: 'ベスト・白いえり・黒いネクタイ・机の上の光る画面', hides: ['neck'], staff: KIT.vest, buddy: { accent: 'tie', tie: JOINT } },
};

// 相棒の飾り（首輪＋部署ごとの飾り）を、相棒の rig.neck / rig.top に合わせて作る
export function buddyKitParts(role, rig) {
  const k = (DEPT_KIT[role] || {}).buddy || { accent: 'tag' };
  const n = rig.neck; const out = [];
  if (n) {
    const [x, y, z] = n.pos, sz = n.sz ?? 1, fz = n.front ?? (z + n.r * sz + 0.012);
    out.push({ shape: 'ring', size: [n.r, 0.017], pos: [x, y, z], scale: [1, 1, sz], color: 'dept', rough: 0.4 });
    if (k.accent === 'tie') {
      out.push(
        { shape: 'box', size: [0.034, 0.028, 0.022], pos: [x, y - 0.016, fz + 0.006], color: k.tie },
        { shape: 'cone', size: [0.028, 0.08], pos: [x, y - 0.07, fz + 0.022], rot: [Math.PI - 0.4, 0, 0], scale: [1, 1, 0.35], color: k.tie },
      );
    } else if (k.accent === 'bow') {
      out.push(
        { shape: 'sphere', size: [0.018], pos: [x, y - 0.006, fz + 0.012], color: 'deptDark' },
        { shape: 'cone', size: [0.026, 0.055], pos: [x + 0.032, y - 0.006, fz + 0.006], rot: [0, 0, Math.PI / 2], scale: [1, 1, 0.5], color: 'dept', mirror: true },
      );
    } else {
      out.push(
        { shape: 'box', size: [0.034, 0.034, 0.012], pos: [x, y - 0.034, fz + 0.008], rot: [-0.15, 0, Math.PI / 4], color: 'deptLight', rough: 0.35, metal: 0.3 },
        { shape: 'box', size: [0.016, 0.016, 0.012], pos: [x, y - 0.034, fz + 0.013], rot: [-0.15, 0, Math.PI / 4], color: 'deptDark' },
      );
    }
  }
  const t = rig.top;
  if (t && k.hat) {
    const at = t.at || 'body', [x, y, z] = t.pos;
    if (k.hat === 'beret') out.push(
      { shape: 'sphere', size: [0.1], at, pos: [x - 0.01, y + 0.005, z - 0.01], rot: [0, 0, 0.2], scale: [1.25, 0.38, 1.15], color: NAVY_BERET, rough: 0.8 },
      { shape: 'cylinder', size: [0.008, 0.008, 0.025], at, pos: [x - 0.02, y + 0.045, z - 0.01], color: NAVY_BERET },
    );
    else if (k.hat === 'antenna') out.push(
      { shape: 'cylinder', size: [0.006, 0.006, 0.09], at, pos: [x, y + 0.04, z], color: DARK },
      { shape: 'sphere', size: [0.022], at, pos: [x, y + 0.09, z], color: '#ff5470', flat: true },
    );
    else if (k.hat === 'headset') out.push(
      { shape: 'torus', size: [0.17, 0.012, Math.PI], at, pos: [x, y - 0.17, z], color: DARK },
      { shape: 'cylinder', size: [0.04, 0.04, 0.03], at, pos: [x + 0.168, y - 0.17, z], rot: [0, 0, Math.PI / 2], color: DARK, mirror: true },
      { shape: 'capsule', size: [0.006, 0.1], at, pos: [x + 0.13, y - 0.24, z + 0.07], face: [-0.5, -0.35, 0.8], color: DARK },
    );
  }
  return out;
}
