// 4.25: dentro de Coach.fetch, antes de «return new Response('not found'…)»
    if (path === '/rl') { // límite simple por clave y hora (en memoria; el DO es único)
      const now = Date.now(), m = this.rl || (this.rl = new Map());
      if (m.size > 5000) for (const [x, v] of m) if (now - v.t > 3600e3) m.delete(x);
      const e = m.get(d.k); const v = e && now - e.t < 3600e3 ? e : {t: now, n: 0};
      if (v.n >= d.max) return new Response('busy', {status: 429});
      v.n++; m.set(d.k, v); return new Response('ok');
    }
    if (path === '/dev/reg') {
      const dv = d.d, tk = devKey(dv), prev = await st.get(tk);
      if (prev && prev !== d.uid) { const o = (await st.get('d:' + prev)) || []; await st.put('d:' + prev, o.filter(x => !(x.k === dv.k && x.t === dv.t))); } // el móvil cambió de cuenta
      const list = ((await st.get('d:' + d.uid)) || []).filter(x => !(x.k === dv.k && x.t === dv.t));
      list.unshift({...dv, at: Date.now()});
      for (const x of list.splice(DEV_MAX)) await st.delete(devKey(x)); // máx. 5 aparatos por cuenta: fuera los más viejos
      await st.put('d:' + d.uid, list); await st.put(tk, d.uid);
      return new Response('ok');
    }
    if (path === '/dev/off') {
      const dv = d.d, tk = devKey(dv), uid = await st.get(tk);
      if (uid) { const o = (await st.get('d:' + uid)) || []; await st.put('d:' + uid, o.filter(x => !(x.k === dv.k && x.t === dv.t))); await st.delete(tk); }
      return new Response('ok');
    }
    if (path === '/notify') {
      const seen = this.seen || (this.seen = new Map()), now = Date.now(), sk = d.to + '/' + d.id;
      if (seen.size > 5000) for (const [x, t] of seen) if (now - t > 600e3) seen.delete(x);
      if (now - (seen.get(sk) || 0) < 600e3) return new Response('skip'); // el mismo aviso (p. ej. quitar y volver a dar me gusta) solo una vez cada 10 min
      seen.set(sk, now);
      const list = (await st.get('d:' + d.to)) || []; if (!list.length) return new Response('skip');
      let sent = 0; const keep = [];
      for (const dv of list) {
        if (now - (dv.at || 0) > 90 * 864e5) { await st.delete(devKey(dv)); continue; } // 3 meses sin abrir la app
        try {
          const r = await sendAny(devSub(dv), d.msg, this.env, {t: d.type, tag: 'hierro-social', url: './?go=notifs', ttl: 24 * 3600, collapse: d.id, thread: 'social'});
          if (r.gone) { await st.delete(devKey(dv)); continue; }
          if (r.status >= 200 && r.status < 300) sent++;
        } catch (e) { console.log('notify send', String(e).slice(0, 150)); }
        keep.push(dv);
      }
      if (keep.length !== list.length) await st.put('d:' + d.to, keep);
      return new Response(sent ? 'ok' : 'skip');
    }
