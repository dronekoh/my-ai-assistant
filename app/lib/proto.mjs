// W2: 暗号・署名・ペアリング部品・分割/圧縮・Realtime(Broadcast) の共通部品。
// ブラウザと Node(22 以上) の両方で動く。使うのは WebCrypto・CompressionStream・WebSocket だけ（自作の暗号なし）。
const subtle = globalThis.crypto.subtle;
const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

export const b64 = (buf) => {
  const u = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64 = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};
export const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const sha256 = async (s) => new Uint8Array(await subtle.digest('SHA-256', typeof s === 'string' ? enc(s) : s));
export async function hkdf(ikm, salt, info, bits = 256) {
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc(info) }, k, bits));
}
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const ECDSA_K = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGALG = { name: 'ECDSA', hash: 'SHA-256' };
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

// ---- 鍵 ----
// ブラウザ側は extractable=false（取り出せない形）。パソコン側だけ、ファイルに保存するため true で作る。
export async function genIdentity({ extractable = false } = {}) {
  const ecdh = await subtle.generateKey(ECDH, extractable, ['deriveBits']);
  const sig = await subtle.generateKey(ECDSA_K, extractable, ['sign', 'verify']);
  return {
    ecdhPriv: ecdh.privateKey, sigPriv: sig.privateKey,
    pub: { ecdh: b64(await subtle.exportKey('raw', ecdh.publicKey)), sig: b64(await subtle.exportKey('raw', sig.publicKey)) },
  };
}
export async function exportIdentity(id) {
  return { v: 1, ecdhPriv: await subtle.exportKey('jwk', id.ecdhPriv), sigPriv: await subtle.exportKey('jwk', id.sigPriv), pub: id.pub };
}
export async function importIdentity(j) { // 読み込んだ後のメモリ上の鍵は取り出せない形にする
  return {
    ecdhPriv: await subtle.importKey('jwk', j.ecdhPriv, ECDH, false, ['deriveBits']),
    sigPriv: await subtle.importKey('jwk', j.sigPriv, ECDSA_K, false, ['sign']),
    pub: j.pub,
  };
}
export const fingerprint = async (sigPubB64) => hex((await sha256(unb64(sigPubB64))).slice(0, 16));
export const importSigPub = (p) => subtle.importKey('raw', unb64(p), ECDSA_K, false, ['verify']);
const signB64 = async (priv, str) => b64(await subtle.sign(SIGALG, priv, enc(str)));
const verifyB64 = async (pubKey, sig, str) => { try { return await subtle.verify(SIGALG, pubKey, unb64(sig), enc(str)); } catch { return false; } };

// ---- つなぎ分け（1）: 長く使う鍵どうしの共有秘密から、パソコン×ブラウザごとの通り道の名前を作る ----
// 共有秘密を知るのは本人たち2者だけ。ペアリング用の 'pair-…' とは別の接頭辞・別の材料。
export async function staticChannel(myEcdhPriv, peerEcdhPub, browserEcdh, pcEcdh) {
  const peer = await subtle.importKey('raw', unb64(peerEcdhPub), ECDH, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: peer }, myEcdhPriv, 256));
  const salt = await sha256(browserEcdh + '|' + pcEcdh);
  return 'd-' + hex(await hkdf(shared, salt, 'chan')).slice(0, 32);
}

// ---- ペアリング用の部品（W5: 先に約束させる手順） ----
// 手順: (1) ブラウザが commit = SHA-256(B の鍵・名前・乱数 nb) だけを送る (2) パソコンが自分の鍵 P と乱数 np を返す
//       (3) ブラウザが B・名前・nb を明かし、パソコンが commit と照らし合わせる (4) 6桁は SHA-256(B・P・nb・np) から作る。
// 中継が B を見られるのは (2) のあとなので、見てから偽の鍵を作り直して6桁をそろえることはできない（そろう確率は約100万分の1。外れたら番号は捨てられる）。
// 番号 = パソコンが作る乱数の「通り道の名前」そのもの（12桁）。番号から鍵や名前を計算しない。番号は秘密ではない（中継にも見える）。
const PAIR_DIGITS = 12;
export const PAIR_ID_RE = /^\d{12}$/;
export function newPairId() { // 12 桁の使い捨て番号（桁ごとに偏りなく選ぶ）
  const u = new Uint32Array(1); let s = '';
  while (s.length < PAIR_DIGITS) { crypto.getRandomValues(u); if (u[0] < 4294967290) s += String(u[0] % 10); }
  return s;
}
// 入力欄から: 全角・ハイフン・空白を除いて数字だけにする（12桁でなければそのまま返す＝呼ぶ側が形を確かめる）
export const normalizePairId = (s) => String(s ?? '').normalize('NFKC').replace(/\D/g, '');
export const formatPairId = (id) => String(id).replace(/(\d{4})(?=\d)/g, '$1-'); // 表示用: 1234-5678-9012
export const pairChannelName = (id) => 'pair-' + id;
export const pairNonce = () => b64(rand(16));
export async function pairCommit({ ecdh, sig, name, nb }) {
  return b64(await sha256(JSON.stringify(['pair-v2-commit', ecdh, sig, name, nb])));
}
// 目視確認用の6桁（両方の画面に出る）。b: ブラウザの鍵、p: パソコンの鍵
export async function pairSas(b, p, nb, np) {
  const h = await sha256(JSON.stringify(['pair-v2-sas', b.ecdh, b.sig, p.ecdh, p.sig, nb, np]));
  return String(new DataView(h.buffer).getUint32(0) % 1000000).padStart(6, '0');
}

// ---- 圧縮（3）: CompressionStream の gzip。展開は上限つき（圧縮爆弾よけ） ----
export async function gzip(bytes) { return pipeThrough(new CompressionStream('gzip'), bytes, Infinity); }
export async function gunzip(bytes, maxOut) { return pipeThrough(new DecompressionStream('gzip'), bytes, maxOut); }
async function pipeThrough(stream, bytes, maxOut) {
  const w = stream.writable.getWriter();
  const wp = w.write(bytes).then(() => w.close()).catch(() => {});
  const r = stream.readable.getReader(); const parts = []; let total = 0;
  for (;;) {
    let x; try { x = await r.read(); } catch { throw new Error('bad_gzip'); }
    if (x.done) break;
    total += x.value.length;
    if (total > maxOut) { try { await r.cancel(); } catch {} throw new Error('too_large'); }
    parts.push(x.value);
  }
  await wp;
  const out = new Uint8Array(total); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---- 分割（3）: 1通を CHUNK_CHARS 文字ごとの断片にする。順不同で組み立てられ、欠けたら捨てる ----
export const CHUNK_CHARS = 150000; // 1通あたり 200KB 以下に収まる目安（Broadcast の上限: Free 256KB / Pro 3,000KB）
export function toChunks(wire, chunkChars = CHUNK_CHARS) {
  const m = b64(rand(9)); const n = Math.max(1, Math.ceil(wire.length / chunkChars)); const out = [];
  for (let i = 0; i < n; i++) out.push({ m, i, n, d: wire.slice(i * chunkChars, (i + 1) * chunkChars) });
  return out;
}
export class Assembler {
  constructor({ ttlMs = 30000, maxMessages = 8, maxChunks = 64, maxChunkChars = 200000, maxTotalChars = 10000000, maxPendingChars = Infinity } = {}) {
    Object.assign(this, { ttlMs, maxMessages, maxChunks, maxChunkChars, maxTotalChars, maxPendingChars }); this.m = new Map(); this.dropped = 0;
  }
  // 戻り値: {done,text} 組み立て完了 / {pending} まだ / {dup} 重複 / {drop:理由} 捨てた
  add(c, now = Date.now()) {
    if (!c || typeof c.m !== 'string' || c.m.length > 32 || !Number.isInteger(c.i) || !Number.isInteger(c.n) || typeof c.d !== 'string') return { drop: 'malformed' };
    if (c.n < 1 || c.i < 0 || c.i >= c.n) return { drop: 'bad_index' };
    if (c.n > this.maxChunks) return { drop: 'too_many_chunks' };
    if (c.d.length > this.maxChunkChars) return { drop: 'chunk_too_large' };
    this.gc(now);
    let e = this.m.get(c.m);
    if (!e) {
      if (this.m.size >= this.maxMessages) { this.m.delete(this.m.keys().next().value); this.dropped++; }
      e = { n: c.n, parts: new Array(c.n), got: 0, size: 0, t: now }; this.m.set(c.m, e);
    }
    if (e.n !== c.n) return { drop: 'n_mismatch' };
    if (e.parts[c.i] !== undefined) return { dup: true };
    if (e.size + c.d.length > this.maxTotalChars) { this.m.delete(c.m); this.dropped++; return { drop: 'too_large' }; }
    // 組み立て中の全体の上限（署名を確かめる前の断片が使える量）。超えるときは古い組み立てから捨てる
    if (this.maxPendingChars !== Infinity) {
      let total = 0; for (const x of this.m.values()) total += x.size;
      while (total + c.d.length > this.maxPendingChars) {
        let victim = null; for (const k of this.m.keys()) if (k !== c.m) { victim = k; break; }
        if (victim === null) { this.m.delete(c.m); this.dropped++; return { drop: 'too_large' }; }
        total -= this.m.get(victim).size; this.m.delete(victim); this.dropped++;
      }
    }
    e.parts[c.i] = c.d; e.got++; e.size += c.d.length;
    if (e.got === e.n) { this.m.delete(c.m); return { done: true, text: e.parts.join('') }; }
    return { pending: true };
  }
  gc(now = Date.now()) { // 時間切れの断片を捨てる。捨てた数を返す
    let n = 0;
    for (const [k, e] of this.m) if (now - e.t > this.ttlMs) { this.m.delete(k); n++; }
    this.dropped += n; return n;
  }
  get pending() { return this.m.size; }
}

// ---- 回数の上限（4） ----
export function rateLimiter(max, windowMs = 60000, now = () => Date.now()) {
  let hits = [];
  return {
    take() { const t = now(); hits = hits.filter((x) => t - x < windowMs); if (hits.length >= max) return false; hits.push(t); return true; },
    get count() { const t = now(); return hits.filter((x) => t - x < windowMs).length; },
  };
}

// ---- 前方秘匿（6）: 接続ごとの使い捨て ECDH 鍵を、長く使う署名鍵で署名して交換する ----
// 1通目（ブラウザ→パソコン）: 一時公開鍵 eb・乱数 nb・単調増加の hc を署名つきで送る
export async function hs1Make(me, hc) {
  const eph = await subtle.generateKey(ECDH, false, ['deriveBits']);
  const eb = b64(await subtle.exportKey('raw', eph.publicKey)), nb = b64(rand(16));
  const from = await fingerprint(me.pub.sig);
  return { msg: { v: 2, from, hc, nb, eb, sig: await signB64(me.sigPriv, `hs1|2|${from}|${hc}|${nb}|${eb}`) }, ephPriv: eph.privateKey };
}
const isStr = (x, max = 200) => typeof x === 'string' && x.length > 0 && x.length <= max;
export async function hs1Verify(m, sigKey) {
  if (!m || m.v !== 2 || !isStr(m.from) || !Number.isSafeInteger(m.hc) || !isStr(m.nb) || !isStr(m.eb) || !isStr(m.sig)) return false;
  return verifyB64(sigKey, m.sig, `hs1|2|${m.from}|${m.hc}|${m.nb}|${m.eb}`);
}
// 2通目（パソコン→ブラウザ）: 相手の乱数・一時公開鍵・自分の一時公開鍵・合図の間隔・上限を署名つきで返す
export async function hs2Make(me, hs1, { beat, lim }) {
  const eph = await subtle.generateKey(ECDH, false, ['deriveBits']);
  const ep = b64(await subtle.exportKey('raw', eph.publicKey)), np = b64(rand(16));
  const from = await fingerprint(me.pub.sig);
  const sig = await signB64(me.sigPriv, `hs2|2|${from}|${hs1.hc}|${hs1.nb}|${np}|${hs1.eb}|${ep}|${beat}|${lim.maxReq}|${lim.perMin}`);
  return { msg: { v: 2, from, hc: hs1.hc, nb: hs1.nb, np, eb: hs1.eb, ep, beat, lim, sig }, ephPriv: eph.privateKey };
}
export async function hs2Verify(m, sigKey) {
  if (!m || m.v !== 2 || !isStr(m.from) || !Number.isSafeInteger(m.hc) || !isStr(m.nb) || !isStr(m.np) || !isStr(m.eb) || !isStr(m.ep) ||
      !Number.isSafeInteger(m.beat) || !m.lim || !Number.isSafeInteger(m.lim.maxReq) || !Number.isSafeInteger(m.lim.perMin) || !isStr(m.sig)) return false;
  return verifyB64(sigKey, m.sig, `hs2|2|${m.from}|${m.hc}|${m.nb}|${m.np}|${m.eb}|${m.ep}|${m.beat}|${m.lim.maxReq}|${m.lim.perMin}`);
}

// ---- 接続ごとの暗号化＋署名つきの通り道 ----
// 鍵は「使い捨て鍵どうしの ECDH」からだけ作る（長く使う鍵は署名にしか使わない）＝長く使う鍵が漏れても過去の通信は読めない
export async function makeSecure({ role, bEph, pEph, nb, np, ephPriv, mySigPriv, peerSigKey, myFp, peerFp, maxInflated = 32000000, keepRaw = false }) {
  const peerEph = await subtle.importKey('raw', unb64(role === 'browser' ? pEph : bEph), ECDH, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: peerEph }, ephPriv, 256));
  const salt = await sha256(`hs2|${nb}|${np}|${bEph}|${pEph}`);
  const sid = hex(await hkdf(shared, salt, 'sid')).slice(0, 16);
  const mk = async (info) => { const raw = await hkdf(shared, salt, info); return { raw, key: await subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']) }; };
  const b2p = await mk('b2p'), p2b = await mk('p2b');
  const sendK = role === 'browser' ? b2p : p2b, recvK = role === 'browser' ? p2b : b2p;
  const myDir = role === 'browser' ? 'b' : 'p', peerDir = role === 'browser' ? 'p' : 'b';
  let sendSeq = 0, maxSeq = 0; const seen = new Set(); const WINDOW = 2048;
  const signed = (from, seq, iv, ct) => `2|${sid}|${from}|${seq}|${iv}|${ct}`;
  const self = {
    sid, createdAt: Date.now(), myFp, peerFp,
    raw: keepRaw ? { b2p: b2p.raw, p2b: p2b.raw, shared } : undefined, // 試験専用
    // 1つの中身（圧縮→暗号化→署名）を作り、断片に分ける。{chunks, wireLen}
    async seal(obj, chunkChars = CHUNK_CHARS) {
      let raw = enc(JSON.stringify(obj)), flag = 0;
      if (raw.length > 1024) { const z = await gzip(raw); if (z.length < raw.length) { raw = z; flag = 1; } }
      const pt = new Uint8Array(raw.length + 1); pt[0] = flag; pt.set(raw, 1);
      const seq = ++sendSeq, iv = rand(12), ivb = b64(iv);
      const ct = b64(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc(`2|${sid}|${myDir}|${seq}`) }, sendK.key, pt));
      const sig = await signB64(mySigPriv, signed(myFp, seq, ivb, ct));
      const wire = JSON.stringify({ v: 2, sid, from: myFp, seq, iv: ivb, ct, sig });
      return { chunks: toChunks(wire, chunkChars), wireLen: wire.length };
    },
    // 成功: {ok:true,msg}  失敗: {ok:false,reason}
    async open(env) {
      if (!env || env.v !== 2 || !isStr(env.ct, 1e8) || !isStr(env.iv) || !Number.isSafeInteger(env.seq) || env.seq < 1) return { ok: false, reason: 'malformed' };
      if (typeof env.sig !== 'string' || !env.sig) return { ok: false, reason: 'no_sig' };
      if (env.sid !== sid) return { ok: false, reason: 'unknown_sid' };
      if (env.from !== peerFp) return { ok: false, reason: 'unknown_from' };
      if (env.seq <= maxSeq - WINDOW || seen.has(env.seq)) return { ok: false, reason: 'replay' };
      if (!(await verifyB64(peerSigKey, env.sig, signed(env.from, env.seq, env.iv, env.ct)))) return { ok: false, reason: 'bad_sig' };
      let pt;
      try { pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: enc(`2|${sid}|${peerDir}|${env.seq}`) }, recvK.key, unb64(env.ct))); }
      catch { return { ok: false, reason: 'bad_ct' }; }
      seen.add(env.seq); if (env.seq > maxSeq) maxSeq = env.seq; // 署名と復号が通ったものだけ記録
      if (seen.size > WINDOW * 2) for (const s of seen) if (s <= maxSeq - WINDOW) seen.delete(s);
      try {
        let body = pt.subarray(1);
        if (pt[0] === 1) body = await gunzip(body, maxInflated);
        return { ok: true, msg: JSON.parse(dec(body)) };
      } catch (e) { return { ok: false, reason: e.message === 'too_large' ? 'inflated_too_large' : 'bad_body' }; }
    },
  };
  return self;
}

// ---- Supabase Realtime（Broadcast だけ。Phoenix プロトコルを直接話す）。切れたら間隔を伸ばしながら自動でつなぎ直す（5） ----
export function openChannel({ url, key, name, onBroadcast, onRaw, onState, onRetry, keepTrying = false, backoff = { min: 500, max: 15000 }, hbMs = 25000 }) {
  const topic = 'realtime:' + name;
  const wsUrl = url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(key) + '&vsn=1.0.0';
  let ws = null, ref = 0, hb = null, closed = false, joined = false, everJoined = false, attempt = 0, settled = false, hbPending = false, retry = null;
  let resolveReady, rejectReady;
  const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; }); ready.catch(() => {});
  const setState = (s) => { if (onState) try { onState(s); } catch {} };
  const schedule = () => {
    const d = Math.min(backoff.max, backoff.min * 2 ** attempt++) * (0.8 + Math.random() * 0.4);
    if (onRetry) try { onRetry(d); } catch {}
    retry = setTimeout(connect, d);
  };
  function connect() {
    if (closed) return;
    const sock = new WebSocket(wsUrl); ws = sock; let dead = false, joinRef = null;
    const wsend = (o) => sock.send(JSON.stringify(o));
    const die = (err) => {
      if (dead) return; dead = true; clearTimeout(jt); clearInterval(hb); try { sock.close(); } catch {}
      const was = joined; joined = false; hbPending = false;
      if (!settled) { settled = true; rejectReady(err); }
      if (closed) return;
      if (was) setState('reconnecting');
      if (everJoined || keepTrying) schedule();
    };
    const jt = setTimeout(() => die(new Error('join_timeout')), 10000);
    sock.addEventListener('open', () => {
      joinRef = String(++ref);
      wsend({ topic, event: 'phx_join', ref: joinRef, join_ref: joinRef, payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } } });
      hb = setInterval(() => { if (hbPending) return die(new Error('hb_timeout')); hbPending = true; try { wsend({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }); } catch {} }, hbMs);
    });
    sock.addEventListener('error', () => die(new Error('ws_error')));
    sock.addEventListener('close', () => die(new Error('ws_closed')));
    sock.addEventListener('message', (e) => {
      if (sock !== ws || dead) return;
      const raw = typeof e.data === 'string' ? e.data : String(e.data);
      if (onRaw) onRaw(raw);
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.topic === 'phoenix' && m.event === 'phx_reply') { hbPending = false; return; }
      if (m.topic !== topic) return;
      if (m.event === 'phx_reply' && m.ref === joinRef) {
        clearTimeout(jt);
        if (m.payload?.status === 'ok') { joined = true; everJoined = true; attempt = 0; if (!settled) { settled = true; resolveReady(); } setState('open'); }
        else die(new Error('join_failed: ' + JSON.stringify(m.payload)));
      } else if (m.event === 'broadcast' && onBroadcast) onBroadcast(m.payload.event, m.payload.payload);
    });
  }
  connect();
  return {
    ready,
    isOpen: () => joined,
    send: (event, payload) => {
      if (!joined) return false;
      try { ws.send(JSON.stringify({ topic, event: 'broadcast', ref: String(++ref), payload: { type: 'broadcast', event, payload } })); return true; } catch { return false; }
    },
    close: () => { closed = true; clearTimeout(retry); clearInterval(hb); try { ws && ws.close(); } catch {} },
    killForTest: () => { try { ws.close(); } catch {} }, // 試験用: 回線だけを切る（自動で戻るはず）
  };
}
// REST での送信（WebSocket が無い環境＝プラグイン内の送信側の候補）
export async function restBroadcast({ url, key, name, event, payload }) {
  const r = await fetch(url + '/realtime/v1/api/broadcast', {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ topic: name, event, payload, private: false }] }),
  });
  return r.status;
}
