// Web 画面の組み立て: 接続設定の読み込み → 保存済みの鍵でつなぐ / ペアリングの画面 → 上部の「パソコン: つながっている／いない」
// 暗号と中継は relay.mjs（lib/ の部品）、画面本体は index.html（server/index.html から build_web.py が作る）。
import { createRelay } from './relay.mjs';
import { idbStore } from './lib/browser-store.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function browserName() {
  const ua = navigator.userAgent || '';
  const b = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'ブラウザ';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${b} ${os}` : b; // 名前にカギかっこ類は使わない（パソコン側で除かれるため）
}

const store = idbStore();
const relay = createRelay({
  config: window.WEB_CONFIG, store, hidden: () => document.hidden,
  onStatus: () => paint(),
});
window.WebRelay.impl = relay;

// ---- 上部の表示 ----
const wrap = el('div', { class: 'pcwrap' }, '<button type="button" class="pcchip wait" id="pcChip" aria-haspopup="true" aria-expanded="false">パソコン: 確認中…</button>' +
  '<div class="pcmenu" id="pcMenu" hidden role="dialog" aria-label="パソコンとのつながり"><p id="pcMenuText"></p><button type="button" id="pcForget">このブラウザの登録を消す</button></div>');
const header = document.querySelector('header');
header.insertBefore(wrap, header.querySelector('.live'));
function paint() {
  const s = relay.status(), chip = $('pcChip');
  let cls, text, offline = false, why = '';
  if (!relay.configured) { cls = 'off'; text = 'パソコン: 接続設定がありません'; offline = true; why = '接続設定（config.js）がありません。配布者に知らせてください'; }
  else if (!s.paired) { cls = 'off'; text = 'パソコン: まだつないでいません'; offline = true; why = 'まだパソコンとつないでいません。ペアリングをしてください'; }
  else if (s.connected) { cls = 'on'; text = 'パソコン: つながっている'; }
  else if (s.sinceBeatSec == null) { cls = 'wait'; text = 'パソコン: つなぎ中…'; offline = true; why = 'パソコンにつなぎ中です。少し待ってください'; }
  else { cls = 'off'; text = `パソコン: つながっていない（最後の合図から ${Math.round(s.sinceBeatSec)} 秒）`; offline = true; why = `パソコンにつながっていないので送れません（最後の合図から ${Math.round(s.sinceBeatSec)} 秒）。パソコンで Claude Code の会話を開いているか確かめてください`; }
  chip.className = 'pcchip ' + cls; chip.textContent = text;
  document.body.classList.toggle('pc-off', offline);
  const ta = $('reqText');
  if (ta) {
    if (offline) { ta.dataset.pcWhy = why; ta.placeholder = why; ta.title = why; }
    else { delete ta.dataset.pcWhy; ta.placeholder = ''; ta.title = ''; }
  }
  $('pcMenuText').textContent = !relay.configured || !s.paired ? '' : s.connected
    ? 'このブラウザは登録済みで、パソコンとつながっています。鍵はこのブラウザの中だけにあります。' : 'このブラウザは登録済みですが、いまパソコンの合図が届いていません。';
  $('pcForget').hidden = !s.paired;
}
$('pcChip').addEventListener('click', (e) => {
  e.stopPropagation();
  const s = relay.status();
  if (!s.paired) { showPair(); return; }
  const m = $('pcMenu'); m.hidden = !m.hidden; $('pcChip').setAttribute('aria-expanded', String(!m.hidden));
});
document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) { $('pcMenu').hidden = true; $('pcChip').setAttribute('aria-expanded', 'false'); } });
$('pcForget').addEventListener('click', async () => {
  if (!confirm('このブラウザの登録を消します。もう一度使うには、パソコンで新しい番号を出してペアリングし直します。（パソコン側の登録も消すには、パソコンで /my-ai-assistant web-revoke を使います）')) return;
  await relay.forget(); $('pcMenu').hidden = true; window.WebRelay.lastState = null; showPair();
});

// 送信は、つながっていないあいだ止める（理由は入力欄に出ている）
$('reqForm').addEventListener('submit', (e) => {
  const ta = $('reqText');
  if (document.body.classList.contains('pc-off')) {
    e.preventDefault(); e.stopImmediatePropagation();
    const m = $('reqMsg'); if (m) m.textContent = (ta && ta.dataset.pcWhy) || 'パソコンにつながっていないので送れません';
  }
}, true);
document.addEventListener('visibilitychange', () => { if (!document.hidden && typeof window.tick === 'function') window.tick(); });

// ---- ペアリングの画面 ----
const pairBox = el('div', { class: 'pair', id: 'pairBox', hidden: '', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pairTitle' });
document.body.appendChild(pairBox);
let pairing = false;
function showPair(msg = '') {
  pairing = true; pairBox.hidden = false;
  pairBox.innerHTML = `<div class="pair-card"><h2 id="pairTitle">パソコンとつなぐ（ペアリング）</h2>
<p class="lead">この画面は、あなたのパソコンの Claude Code につないで使います。最初に1回だけ、このブラウザを登録します。</p>
<ol><li>パソコンの Claude Code の会話で <code>/my-ai-assistant web-on</code> のあと <code>/my-ai-assistant web-pair</code> を打つ</li>
<li>ペインに出た<b>12桁の番号</b>を、下に入れる（ハイフンは入れても入れなくても構いません）</li></ol>
<label for="pairCode">12桁の番号</label><input id="pairCode" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="0000-0000-0000">
<label for="pairName">このブラウザの名前（パソコン側の一覧に出ます）</label><input id="pairName" maxlength="40" value="${esc(browserName())}">
<div class="pair-err" id="pairErr" role="alert">${esc(msg)}</div>
<div class="row"><button type="button" class="go" id="pairGo">つなぐ</button></div>
<p class="pair-small">鍵はこのブラウザの中（IndexedDB・取り出せない形）に保存します。会話の中身は暗号化され、中継は読めません。番号は5分で失効します。番号は通り道の名前で、秘密ではありません。守りは次の6桁の見比べです。</p></div>`;
  const go = $('pairGo'), code = $('pairCode');
  code.addEventListener('input', () => { code.value = code.value.normalize('NFKC').replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1-'); });
  code.focus();
  const run = async () => {
    const c = code.value.normalize('NFKC').replace(/\D/g, '');
    if (!/^\d{12}$/.test(c)) { $('pairErr').textContent = '12桁の番号を入れてください'; return; }
    go.disabled = true; $('pairErr').textContent = 'パソコンを探しています…';
    let p;
    try { p = await relay.startPair(c, $('pairName').value.trim()); }
    catch (e) {
      go.disabled = false;
      $('pairErr').textContent = e.code === 'no_config' ? '接続設定がありません（config.js）' : e.message === 'no_response'
        ? 'パソコンから返事がありません。番号が正しいか、番号の時間（5分）が切れていないか、パソコンで web-pair を打ったか確かめてください' : '失敗しました: ' + e.message;
      return;
    }
    showSas(p);
  };
  go.addEventListener('click', run);
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
}
function showSas(p) {
  pairBox.innerHTML = `<div class="pair-card"><h2 id="pairTitle">6桁を見比べてください</h2>
<div class="pair-sas" id="pairSas" aria-label="確認用の6桁">${esc(p.sas)}</div>
<p class="pair-note"><b>パソコンの Claude Code の画面に同じ6桁が出ていたら、そちらで「一致」を押してください。</b><br>違う数字のときは、パソコン側で「違う」を押し、ここで「やめる」を押してください（他の人が割り込んでいるかもしれません）。</p>
<div class="pair-note" id="pairErr" role="status" style="color:var(--mute)">パソコンの返事を待っています…（最長5分）</div>
<div class="row"><button type="button" id="pairCancel">やめる</button></div></div>`;
  $('pairCancel').addEventListener('click', () => { p.cancel(); });
  p.finish().then((ok) => {
    if (ok) { pairing = false; pairBox.hidden = true; pairBox.innerHTML = ''; window.WebRelay.lastState = null; if (typeof window.tick === 'function') window.tick(); paint(); }
    else showPair('登録されませんでした（パソコンで「違う」を押した、やめた、または時間切れです）。もう一度、新しい番号でやり直してください。');
  }).catch((e) => showPair('失敗しました: ' + e.message));
}

// ---- 起動 ----
(async () => {
  paint();
  if (!relay.configured) { showPair('接続設定（config.js）がありません。'); return; }
  try { const r = await relay.init(); if (!r.paired) showPair(); else { pairing = false; pairBox.hidden = true; } } catch (e) { showPair('起動に失敗しました: ' + e.message); }
  paint();
})();
