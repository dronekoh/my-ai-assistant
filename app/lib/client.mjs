// W2: ブラウザ側。ペアリング → 鍵を store（IndexedDB）へ → 保存した鍵で何度でもつなぐ。
// store は { get, put, del }（ブラウザは idbStore()、試験は memoryStore()）。
import {
  genIdentity, newCode, pairChannelName, codeMac, codeMacOk, helloBody, sasOf, fingerprint, importSigPub, staticChannel,
  openChannel, Assembler, hs1Make, hs2Verify, makeSecure,
} from './proto.mjs';

export async function browserPair({ url, key, code, name = 'ブラウザ', store, timeoutMs = 8000, extractable = false, backoff }) {
  const me = await genIdentity({ extractable });
  const pairName = await pairChannelName(code);
  let reply = null;
  const ch = openChannel({ url, key, name: pairName, backoff, onBroadcast: (ev, p) => { if (ev === 'hello2') reply = p; } });
  await ch.ready;
  const hello = { t: 'hello', ecdh: me.pub.ecdh, sig: me.pub.sig, name, mac: await codeMac(code, helloBody(me.pub.ecdh, me.pub.sig, name)) };
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    ch.send('hello', hello);
    await new Promise((r) => setTimeout(r, 700));
    if (reply) {
      // パソコンの返事が「自分の鍵」を含んで番号で認証されているものだけ受ける
      const ok = reply.bEcdh === me.pub.ecdh && reply.bSig === me.pub.sig &&
        await codeMacOk(code, `P|${reply.ecdh}|${reply.sig}|${me.pub.ecdh}|${me.pub.sig}`, reply.mac);
      if (ok) {
        ch.close();
        const peer = { ecdh: reply.ecdh, sig: reply.sig };
        return {
          sas: await sasOf(me.pub, peer), pcFp: await fingerprint(peer.sig), identity: me,
          // 6桁を見比べて同じだったら呼ぶ。鍵を store に保存してから接続する
          async commit(opts = {}) {
            await store.put('identity', { ecdhPriv: me.ecdhPriv, sigPriv: me.sigPriv, pub: me.pub });
            await store.put('pc', { pub: peer, pairedAt: Date.now() });
            return connectBrowser({ url, key, store, backoff, ...opts });
          },
        };
      }
      reply = null;
    }
  }
  ch.close();
  throw new Error('no_response');
}

export async function forget(store) { await store.del('identity'); await store.del('pc'); await store.del('hc'); }

// 保存済みの鍵でつなぐ（ペアリング済みでなければ null）。切れたら自動でつなぎ直す。
export async function connectBrowser({ url, key, store, onRaw, onState, onStatus, backoff, hsBackoff = { min: 1000, max: 15000 }, beatFactor = 2.5, watchMs = 500,
  maxInflated = 64000000, debugKeepRaw = false }) {
  const idr = await store.get('identity'), pcr = await store.get('pc');
  if (!idr || !pcr) return null;
  const me = { ecdhPriv: idr.ecdhPriv, sigPriv: idr.sigPriv, pub: idr.pub };
  const peer = pcr.pub, myFp = await fingerprint(me.pub.sig), pcFp = await fingerprint(peer.sig);
  const pcSigKey = await importSigPub(peer.sig);
  const channel = await staticChannel(me.ecdhPriv, peer.ecdh, me.pub.ecdh, peer.ecdh);
  const asm = new Assembler({ ttlMs: 30000, maxChunks: 400, maxTotalChars: maxInflated });
  const pendingHs = new Map(); // nb → 使い捨て秘密鍵
  const reqs = new Map();
  let lastHs1 = null, sess = null, lastBeatAt = 0, beatMs = 0, lim = { maxReq: 0, perMin: 0 }, wsOpen = false, closed = false;
  let hsDelay = hsBackoff.min, nextHsAt = 0, rid = 0, lastHc = (await store.get('hc')) || 0;
  const bump = () => { if (onStatus) try { onStatus(status()); } catch {} };

  const isConnected = () => !!sess && wsOpen && beatMs > 0 && Date.now() - lastBeatAt < beatMs * beatFactor;
  function status() {
    return { connected: isConnected(), wsOpen, hasSession: !!sess, sinceBeatSec: lastBeatAt ? Math.round((Date.now() - lastBeatAt) / 100) / 10 : null, beatMs };
  }

  async function onBroadcast(ev, p) {
    if (closed) return;
    if (ev === 'hs2') {
      if (!p || !pendingHs.has(p.nb) || p.from !== pcFp || !(await hs2Verify(p, pcSigKey))) return;
      const ephPriv = pendingHs.get(p.nb); pendingHs.clear();
      sess = await makeSecure({ role: 'browser', bEph: p.eb, pEph: p.ep, nb: p.nb, np: p.np, ephPriv, mySigPriv: me.sigPriv, peerSigKey: pcSigKey,
        myFp, peerFp: pcFp, maxInflated, keepRaw: debugKeepRaw });
      beatMs = p.beat; lim = p.lim; lastBeatAt = Date.now(); hsDelay = hsBackoff.min; bump();
      return;
    }
    if (ev !== 'c') return;
    const r = asm.add(p);
    if (!r.done) return;
    let env; try { env = JSON.parse(r.text); } catch { return; }
    if (!sess || env.sid !== sess.sid) return;
    const o = await sess.open(env);
    if (!o.ok) return;
    const m = o.msg; lastBeatAt = Date.now();
    if (m.t === 'beat') { beatMs = m.every || beatMs; bump(); }
    else if (m.t === 'res' && reqs.has(m.re)) { const q = reqs.get(m.re); reqs.delete(m.re); clearTimeout(q.timer); q.res(m); }
  }

  const ch = openChannel({ url, key, name: channel, onRaw, backoff, keepTrying: true, onBroadcast,
    onState: (s) => { wsOpen = s === 'open'; if (wsOpen) { nextHsAt = 0; hsDelay = hsBackoff.min; } if (onState) onState(s); bump(); } });
  ch.ready.then(() => { wsOpen = true; }).catch(() => {});

  async function startHandshake() {
    lastHc = Math.max(lastHc + 1, Date.now());
    await store.put('hc', lastHc); // 再送でないことを示す番号。パソコン側も保存していて、これより古い番号は断る
    const { msg, ephPriv } = await hs1Make(me, lastHc);
    pendingHs.set(msg.nb, ephPriv); while (pendingHs.size > 4) pendingHs.delete(pendingHs.keys().next().value);
    lastHs1 = msg; ch.send('hs1', msg);
  }
  // 合図が途絶えたら、間隔を伸ばしながら鍵交換をやり直す
  const timer = setInterval(() => {
    if (closed || !wsOpen) return;
    asm.gc();
    if (!isConnected() && Date.now() >= nextHsAt) {
      nextHsAt = Date.now() + hsDelay; hsDelay = Math.min(hsDelay * 2, hsBackoff.max);
      startHandshake().catch(() => {});
    }
    bump();
  }, watchMs);

  const api = {
    fp: myFp, pcFp, channel, status,
    get session() { return sess; },
    async waitConnected(ms = 10000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (isConnected()) return true; await new Promise((r) => setTimeout(r, 50)); }
      return false;
    },
    // 依頼を送り、返事（{ok,data}|{ok:false,err}）を待つ
    async request(op, args, timeoutMs = 15000) {
      if (!isConnected()) throw new Error('offline');
      const id = ++rid;
      const { chunks, wireLen } = await sess.seal({ t: 'req', id, op, args });
      if (lim.maxReq && wireLen > lim.maxReq) throw new Error('too_large');
      const p = new Promise((res, rej) => { reqs.set(id, { res, timer: setTimeout(() => { reqs.delete(id); rej(new Error('timeout')); }, timeoutMs) }); });
      for (const c of chunks) if (!ch.send('c', c)) { reqs.delete(id); throw new Error('offline'); }
      return p;
    },
    async send(text, timeoutMs) { const r = await api.request('chat', { text }, timeoutMs); return r.ok ? r.data : r; },
    // 試験用: 検査を通さず断片をそのまま送る
    async sealForTest(obj, chunkChars) { return sess.seal(obj, chunkChars); },
    sendChunkForTest: (c) => ch.send('c', c),
    sendEventForTest: (ev, p) => ch.send(ev, p),
    lastHs1ForTest: () => lastHs1,
    killSocketForTest: () => ch.killForTest(),
    close: () => { closed = true; clearInterval(timer); ch.close(); for (const q of reqs.values()) clearTimeout(q.timer); },
  };
  return api;
}
