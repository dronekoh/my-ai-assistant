// Web 画面の「中継の窓口」（ブラウザと node の両方で動く。画面の部品 shell.mjs と試験 tests/web.test.mjs が使う）。
// 画面が呼んでいた fetch('/api/…') を、暗号化・署名つきの中継 request('api', {method, path, body}) に差し替える1か所が api()。
// 鍵: ペアリングで作り、store（ブラウザは IndexedDB・取り出せない形）に置く。ログインは無く、ペアリングが「入る資格」。
import { browserPair, connectBrowser, forget } from './lib/client.mjs';

// パソコン側の許可リスト（bridge/lib/policy.mjs）と同じ範囲。ここでも先に絞り、許されない操作は最初から送らない。
const HISTORY_RE = /^\/api\/history\/(stats|search|sessions|session|memory)$/;
const TASK_STOP_RE = /^\/api\/exec\/tasks\/([^/]{1,128})\/stop$/;
export function webAllowed(method, pathname) {
  if (method === 'GET') return pathname === '/api/state' || pathname === '/api/settings' || HISTORY_RE.test(pathname);
  if (method === 'POST') return pathname === '/api/exec/send' || pathname === '/api/exec/stop' || TASK_STOP_RE.test(pathname) || pathname === '/api/settings';
  return false;
}
// 添付の上限（パソコン側 WEB_LIMITS と同じ）。base64 の合計 900000 文字 ≒ 中身 約650KB
export const ATTACH_MAX_FILES = 5;
export const ATTACH_MAX_B64 = 900000;
export const ATTACH_MAX_BYTES = 640 * 1024; // 画面に出す上限（base64 にして 約 874,000 文字）

const MESSAGES = {
  offline: 'パソコンにつながっていません。パソコンで Claude Code を開き、Web 版が「使う」になっているか確かめてください',
  timeout: 'パソコンから返事がありません（時間切れ）',
  too_large: '大きすぎて送れません',
  op_not_allowed: 'この操作は Web からは使えません',
  run_not_allowed: '「実行」の依頼は Web からは出せません',
  web_blocked: 'この操作は Web からは使えません',
  rate_limited: '短い間に送りすぎました。1分ほど待ってください',
  server_down: 'パソコン側の画面サーバーに届きません（Claude Code の会話が開いているか確かめてください）',
  bad_request: '依頼の形が正しくありません',
  handler_error: 'パソコン側で失敗しました',
  hidden: '画面が見えていないので更新を止めています',
  not_paired: 'まだパソコンとつないでいません（ペアリングが要ります）',
};
export const explain = (code) => MESSAGES[code] || `失敗しました（${code}）`;
const fail = (code) => Object.assign(new Error(explain(code)), { code });

export function createRelay({ config, store, onStatus, hidden = () => false, pollGuardMs = 0, jobWaitMs = 1500, connectOpts = {} }) {
  let client = null, paired = false, last = { connected: false, sinceBeatSec: null };
  const bump = (s) => { last = s; if (onStatus) try { onStatus(view()); } catch {} };
  const view = () => ({ paired, connected: !!client && last.connected, sinceBeatSec: last.sinceBeatSec, wsOpen: !!last.wsOpen });
  const cfgOk = !!(config && typeof config.url === 'string' && config.url && typeof config.key === 'string' && config.key);

  const self = {
    get configured() { return cfgOk; },
    status: view,
    // 起動: 保存済みの鍵があればつなぐ。途中まで進んだペアリングの残り（pairing の印）は捨てる
    async init() {
      if (!cfgOk) return { paired: false, reason: 'no_config' };
      if (await store.get('pairing')) { await forget(store); await store.del('pairing'); }
      client = await connectBrowser({ url: config.url, key: config.key, store, onStatus: bump, ...connectOpts });
      paired = !!client;
      bump(client ? client.status() : { connected: false, sinceBeatSec: null });
      return { paired };
    },
    // 番号 → 鍵交換 → 確認用の6桁。戻り値 { sas, finish(signal), cancel() }。finish は「パソコンで一致が押される」まで待つ
    async startPair(code, name) {
      if (!cfgOk) throw Object.assign(new Error('no_config'), { code: 'no_config' });
      if (!/^\d{8}$/.test(code)) throw Object.assign(new Error('bad_code'), { code: 'bad_code' });
      const pending = await browserPair({ url: config.url, key: config.key, code, name: (name || 'ブラウザ').slice(0, 40), store, timeoutMs: 20000 });
      let done = false;
      return {
        sas: pending.sas,
        cancel() { done = true; },
        // 一致が押されるまで（最長 waitMs）待つ。パソコン側が登録して初めて鍵交換が通り、つながる。通らなければ鍵を消す
        async finish(waitMs = 190000) {
          await store.put('pairing', Date.now());
          const c = await pending.commit({ onStatus: bump, hsBackoff: { min: 1000, max: 3000 }, ...connectOpts });
          const t0 = Date.now();
          while (!done && Date.now() - t0 < waitMs) {
            if (await c.waitConnected(500)) { client = c; paired = true; await store.del('pairing'); bump(c.status()); return true; }
          }
          c.close(); await forget(store); await store.del('pairing');
          return false;
        },
      };
    },
    async forget() { if (client) client.close(); client = null; paired = false; await forget(store); await store.del('pairing'); bump({ connected: false, sinceBeatSec: null }); },
    close() { if (client) client.close(); client = null; },
    // fetch('/api/…') の代わり。戻り値 { status, body }。失敗は code つきの Error
    async api(method, path, body) {
      method = String(method || 'GET').toUpperCase();
      const u = new URL(path, 'http://x.invalid');
      if (method === 'GET' && /^\/api\/jobs\/[^/]+$/.test(u.pathname)) {
        // 設定の保存の完了確認（/api/jobs/…）は Web からは許していない。少し待って「済み」とし、画面が設定を読み直す
        await new Promise((r) => setTimeout(r, jobWaitMs));
        return { status: 200, body: { status: 'done' } };
      }
      if (!webAllowed(method, u.pathname)) throw fail('web_blocked');
      if (method === 'GET' && u.pathname === '/api/state' && hidden()) throw fail('hidden');
      if (!paired || !client) throw fail('not_paired');
      if (method === 'POST' && u.pathname === '/api/exec/send' && body && Array.isArray(body.files)) {
        const total = body.files.reduce((s, f) => s + (f && typeof f.data === 'string' ? f.data.length : 0), 0);
        if (body.files.length > ATTACH_MAX_FILES) throw Object.assign(new Error(`添付は${ATTACH_MAX_FILES}件までです`), { code: 'too_large' });
        if (total > ATTACH_MAX_B64) throw Object.assign(new Error('添付が大きすぎます（合計 約640KBまで）'), { code: 'too_large' });
      }
      let r;
      try { r = await client.request('api', { method, path: u.pathname + u.search, ...(method === 'POST' ? { body: body ?? {} } : {}) }, 30000); }
      catch (e) { throw fail(e && e.message === 'timeout' ? 'timeout' : e && e.message === 'too_large' ? 'too_large' : 'offline'); }
      if (!r.ok) throw fail(r.err || 'handler_error');
      const out = r.data || { status: 502, body: null };
      if (method === 'GET' && u.pathname === '/api/state' && out.body && typeof out.body === 'object') {
        // Web では出さない機能: ▶実行（コマンドを頼む）・入力の予測（許可リストに無い）
        out.body.features = { ...(out.body.features || {}), runCommand: false, suggest: false };
      }
      return out;
    },
  };
  return self;
}
