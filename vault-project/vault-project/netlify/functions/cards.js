import { getStore } from "@netlify/blobs";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  const store = getStore("vault");

  // One-time password reset migration. Runs once on the next page load,
  // then marks itself done so it never fires again.
  const resetDone = await store.get("password-reset-2025").catch(() => null);
  if (!resetDone) {
    await store.set("admin-password", "CardVault2025");
    await store.set("password-reset-2025", "true");
  }

  if (req.method === "GET") {
    const ids = (await store.get("catalog-index", { type: "json" }).catch(() => null)) || [];
    const cards = [];
    for (const id of ids) {
      const card = await store.get(`card:${id}`, { type: "json" }).catch(() => null);
      if (card) cards.push(card);
    }
    const password = await store.get("admin-password").catch(() => null);
    return json({ cards, hasPassword: !!password });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "Invalid request body" }, 400);
    }

    if (body.action === "unlock") {
      const stored = await store.get("admin-password").catch(() => null);
      if (!stored) {
        if (!body.password || !body.password.trim()) {
          return json({ ok: false, error: "Password required" }, 400);
        }
        await store.set("admin-password", body.password);
        return json({ ok: true, created: true });
      }
      if (stored === body.password) return json({ ok: true });
      return json({ ok: false }, 401);
    }

    if (body.action === "save") {
      const card = body.card;
      if (!card || !card.id) return json({ ok: false, error: "Missing card" }, 400);
      await store.setJSON(`card:${card.id}`, card);
      const ids = (await store.get("catalog-index", { type: "json" }).catch(() => null)) || [];
      if (!ids.includes(card.id)) {
        ids.push(card.id);
        await store.setJSON("catalog-index", ids);
      }
      return json({ ok: true });
    }

    if (body.action === "delete") {
      if (!body.id) return json({ ok: false, error: "Missing id" }, 400);
      await store.delete(`card:${body.id}`);
      const ids = (await store.get("catalog-index", { type: "json" }).catch(() => null)) || [];
      await store.setJSON("catalog-index", ids.filter((x) => x !== body.id));
      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  }

  return json({ ok: false, error: "Method not allowed" }, 405);
};
