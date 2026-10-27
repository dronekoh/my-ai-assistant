// 画面（server/index.html と同じ中身）が呼ぶ fetch('/api/…') を、中継の窓口 WebRelay.api(method, path, body) に差し替える。1か所だけ。
// 画面より先に読み込む（classic script）。WebRelay.impl は shell.mjs が用意する。/api/ 以外の fetch はそのまま。
(function () {
  var realFetch = window.fetch.bind(window);
  window.WebRelay = { impl: null };
  function json(status, obj) { return new Response(JSON.stringify(obj == null ? {} : obj), { status: status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }); }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/') !== 0) return realFetch(input, init);
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var body; if (init && typeof init.body === 'string') { try { body = JSON.parse(init.body); } catch (e) { body = undefined; } }
    var impl = window.WebRelay.impl;
    var fail = function (e) { return { status: e && e.code === 'not_paired' ? 401 : 503, body: { ok: false, error: (e && e.message) || '失敗しました', code: e && e.code } }; };
    var p = impl ? impl.api(method, url, body).catch(function (e) { if (method === 'GET') throw e; return fail(e); })
                 : (method === 'GET' ? Promise.reject(new Error('準備中です')) : Promise.resolve(fail({ message: '準備中です', code: 'offline' })));
    return p.then(function (r) { return json(r.status, r.body); });
  };
})();
