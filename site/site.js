// NextLevel Collections — browse filters, share, and the waitlist form. No framework.
(() => {
  // ---- browse: search + chips ----
  const grid = document.querySelector('[data-grid]');
  if (grid) {
    const cards = [...grid.querySelectorAll('.card')];
    const input = document.querySelector('[data-search-input]');
    const empty = document.querySelector('[data-empty]');
    let ids = null;
    const apply = () => {
      const q = (input?.value || '').trim().toLowerCase();
      let shown = 0;
      for (const c of cards) {
        const id = c.getAttribute('href').split('/')[2];
        const ok = (!ids || ids.has(id)) && (!q || c.dataset.search.includes(q));
        c.hidden = !ok;
        if (ok) shown++;
      }
      if (empty) empty.hidden = shown > 0;
    };
    input?.addEventListener('input', apply);
    for (const chip of document.querySelectorAll('.chip')) {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === chip));
        ids = chip.dataset.filterIds ? new Set(chip.dataset.filterIds.split(' ')) : null;
        apply();
      });
    }
  }

  // ---- share ----
  for (const b of document.querySelectorAll('[data-share]')) {
    b.addEventListener('click', async () => {
      const data = { title: document.title, url: location.href };
      try {
        if (navigator.share) await navigator.share(data);
        else { await navigator.clipboard.writeText(location.href); b.textContent = 'Link copied'; }
      } catch {}
    });
  }

  // ---- waitlist ----
  for (const form of document.querySelectorAll('[data-waitlist]')) {
    const msg = form.parentElement.querySelector('.join-msg');
    const source = form.querySelector('[name=source]');
    if (source && !source.value) source.value = location.pathname;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      const body = Object.fromEntries(new FormData(form));
      btn.disabled = true;
      msg.textContent = '';
      try {
        const res = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.error || 'That didn’t go through.');
        msg.textContent = out.already ? 'You’re already on the list. We’ll be in touch.' : 'You’re on the list. We’ll email you an invite.';
        form.reset();
      } catch (err) {
        msg.textContent = (err && err.message) || 'That didn’t go through. Try again?';
      } finally {
        btn.disabled = false;
      }
    });
  }
})();
