function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin)
    }
  });
}

function normalizePrefix(value) {
  if (!value) return '';
  return value.endsWith('/') ? value : `${value}/`;
}

function basename(key) {
  const parts = key.split('/');
  return parts[parts.length - 1] || key;
}

async function listAll(bucket, prefix = '') {
  const objects = [];
  let cursor;

  while (true) {
    const result = await bucket.list({ prefix, cursor, limit: 1000 });
    objects.push(...result.objects);
    if (!result.truncated) break;
    cursor = result.cursor;
  }

  return objects;
}

async function handleList(request, env) {
  const url = new URL(request.url);
  const prefix = normalizePrefix(url.searchParams.get('prefix') || '');
  const objects = await listAll(env.FILES_BUCKET, prefix);
  const entries = new Map();

  for (const object of objects) {
    const relative = object.key.slice(prefix.length);
    if (!relative) continue;

    const slashIndex = relative.indexOf('/');
    if (slashIndex === -1) {
      entries.set(object.key, {
        name: basename(object.key),
        type: 'file',
        size: object.size,
        path: object.key
      });
      continue;
    }

    const dirName = relative.slice(0, slashIndex);
    const dirPath = `${prefix}${dirName}`;
    if (!entries.has(dirPath)) {
      entries.set(dirPath, {
        name: dirName,
        type: 'dir',
        size: 0,
        path: dirPath
      });
    }
  }

  return json(Array.from(entries.values()));
}

async function handleStats(request, env) {
  const url = new URL(request.url);
  const prefix = normalizePrefix(url.searchParams.get('prefix') || '');
  const objects = await listAll(env.FILES_BUCKET, prefix);

  let count = 0;
  let lastUpdate = null;

  for (const object of objects) {
    count += 1;
    if (!lastUpdate || object.uploaded > lastUpdate) {
      lastUpdate = object.uploaded;
    }
  }

  return json({
    count,
    lastUpdate: lastUpdate ? lastUpdate.toISOString() : null
  });
}

async function handleUpload(request, env) {
  const formData = await request.formData();
  const filePath = formData.get('path');
  const file = formData.get('file');

  if (!filePath || typeof filePath !== 'string' || !file || typeof file === 'string') {
    return json({ error: 'Missing file or path' }, 400);
  }

  await env.FILES_BUCKET.put(filePath, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream'
    },
    customMetadata: {
      originalName: file.name
    }
  });

  return json({ success: true });
}

async function deletePrefix(bucket, prefix) {
  const objects = await listAll(bucket, normalizePrefix(prefix));
  for (const object of objects) {
    await bucket.delete(object.key);
  }
  return objects.length;
}

async function handleDelete(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const filePath = body.path;
  if (!filePath || typeof filePath !== 'string') {
    return json({ error: 'Missing path' }, 400);
  }

  const exact = await env.FILES_BUCKET.head(filePath);
  if (exact) {
    await env.FILES_BUCKET.delete(filePath);
    return json({ success: true });
  }

  const deleted = await deletePrefix(env.FILES_BUCKET, filePath);
  if (deleted > 0) {
    return json({ success: true });
  }

  return json({ error: 'File not found' }, 404);
}

async function handleDownload(request, env) {
  const url = new URL(request.url);
  const filePath = url.searchParams.get('path') || '';
  if (!filePath) {
    return new Response('Invalid path', { status: 400 });
  }

  const object = await env.FILES_BUCKET.get(filePath);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Length', String(object.size));
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(basename(filePath))}"`);

  return new Response(object.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/list') {
      return handleList(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/api/stats') {
      return handleStats(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/api/download') {
      return handleDownload(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/upload') {
      return handleUpload(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/delete') {
      return handleDelete(request, env);
    }

    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders(origin)
    });
  }
};
