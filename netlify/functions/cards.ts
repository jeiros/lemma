import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';

type CardIndex = { ids: string[]; updatedAt: number };

const json = (status: number, data: unknown): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function key(id: string): string {
  return `card:${id}`;
}

async function readIndex(store: ReturnType<typeof getStore>): Promise<CardIndex> {
  const idx = (await store.get('index', { type: 'json' })) as CardIndex | null;
  return idx ?? { ids: [], updatedAt: 0 };
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  const store = getStore({ name: 'cards' });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  switch (req.method) {
    case 'GET': {
      if (id) {
        const card = await store.get(key(id), { type: 'json' });
        return card ? json(200, card) : json(404, { error: 'not found' });
      }
      const idx = await readIndex(store);
      const cards = await Promise.all(
        idx.ids.map((i) => store.get(key(i), { type: 'json' })),
      );
      return json(200, cards.filter(Boolean));
    }

    case 'POST':
    case 'PUT': {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return json(400, { error: 'invalid json' });
      }
      if (!body?.id || typeof body.id !== 'string') {
        return json(400, { error: 'id required' });
      }
      await store.setJSON(key(body.id), body);
      const idx = await readIndex(store);
      if (!idx.ids.includes(body.id)) idx.ids.push(body.id);
      idx.updatedAt = Date.now();
      await store.setJSON('index', idx);
      return json(200, body);
    }

    case 'DELETE': {
      if (!id) return json(400, { error: 'id required' });
      await store.delete(key(id));
      const idx = await readIndex(store);
      idx.ids = idx.ids.filter((x) => x !== id);
      idx.updatedAt = Date.now();
      await store.setJSON('index', idx);
      return new Response(null, { status: 204 });
    }

    default:
      return json(405, { error: 'method not allowed' });
  }
};
