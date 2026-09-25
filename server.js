const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const GROQ_KEY = process.env.GROQ_API_KEY;
const SUPA_URL = (process.env.SUPABASE_URL || '').replace('https://', '');
const SUPA_KEY = process.env.SUPABASE_ANON_KEY;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'wakeel2024admin';
const WHATSAPP = process.env.WHATSAPP || '3129299666';

// ── HELPERS ───────────────────────────────────────────────────
function parseBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { resolve({}); } });
  });
}

function json(res, data, code) {
  res.writeHead(code || 200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function serveFile(res, filename) {
  try {
    const ext = path.extname(filename);
    const ct = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'application/javascript' : 'text/plain';
    const content = fs.readFileSync(path.join(__dirname, filename), 'utf8');
    res.writeHead(200, { 'Content-Type': ct });
    res.end(content);
  } catch(e) { res.writeHead(404); res.end('Not found'); }
}

// ── GROQ AI ───────────────────────────────────────────────────
function groq(system, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: system }].concat(messages),
      max_tokens: 1500, temperature: 0.3
    });
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(d);
          if (p.error) { reject(new Error(p.error.message)); return; }
          resolve(p.choices?.[0]?.message?.content || '');
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ── SUPABASE ──────────────────────────────────────────────────
function supa(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation'
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request({
      hostname: SUPA_URL, path, method, headers
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve([]); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── SERVER ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query;

  // ── PAGES ─────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (pathname === '/' || pathname === '/index.html') { serveFile(res, 'index.html'); return; }
    if (pathname === '/admin') { serveFile(res, 'admin.html'); return; }
    if (pathname === '/lawyer-portal') { serveFile(res, 'lawyer-portal.html'); return; }
    if (pathname === '/documents') { serveFile(res, 'documents.html'); return; }

    // Test page
    if (pathname === '/test') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body style="font-family:sans-serif;padding:30px;background:#e8f5ee">
        <h2 style="color:#1a5c3a">✅ WakeelAI is running on Render!</h2>
        <p>Groq key: ${GROQ_KEY ? '✅ Set' : '❌ Missing'}</p>
        <p>Supabase URL: ${SUPA_URL ? '✅ Set' : '❌ Missing'}</p>
        <p>Supabase Key: ${SUPA_KEY ? '✅ Set' : '❌ Missing'}</p>
        <p>Admin Password: ${ADMIN_PASS ? '✅ Set' : '❌ Missing'}</p>
        <br><a href="/" style="color:#1a5c3a;font-weight:bold">Open WakeelAI →</a>
        &nbsp;&nbsp;<a href="/admin" style="color:#1a5c3a;font-weight:bold">Admin Panel →</a>
      </body></html>`);
      return;
    }

    // Lawyers API
    if (pathname === '/api/lawyers') {
      try {
        const cat = query.cat;
        let p = '/rest/v1/lawyers?active=eq.true&select=name,city,phone,specialty,experience,plan';
        if (cat) p += `&specialty=cs.{${cat}}`;
        const lawyers = await supa('GET', p, null);
        json(res, Array.isArray(lawyers) ? lawyers : []);
      } catch(e) { json(res, []); }
      return;
    }
  }

  // ── POST APIs ────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await parseBody(req);

    // Main AI chat
    if (pathname === '/api/chat') {
      try {
        if (!GROQ_KEY) { json(res, { error: 'GROQ_API_KEY not set in environment variables' }); return; }
        const text = await groq(body.system, body.messages);
        json(res, { content: [{ type: 'text', text }] });
      } catch(e) { json(res, { error: e.message }); }
      return;
    }

    // Lawyer login
    if (pathname === '/api/lawyer-login') {
      try {
        const code = (body.code || '').trim();
        const lawyers = await supa('GET', `/rest/v1/lawyers?access_code=eq.${encodeURIComponent(code)}&active=eq.true&select=id,name,city,specialty,plan`, null);
        if (lawyers && lawyers.length > 0) json(res, { success: true, lawyer: lawyers[0] });
        else json(res, { success: false, error: 'Invalid or inactive access code. Contact WakeelAI support.' });
      } catch(e) { json(res, { success: false, error: e.message }); }
      return;
    }

    // Lawyer research (premium)
    if (pathname === '/api/lawyer-research') {
      try {
        const code = (body.code || '').trim();
        const lawyers = await supa('GET', `/rest/v1/lawyers?access_code=eq.${encodeURIComponent(code)}&active=eq.true&plan=eq.premium&select=id,name`, null);
        if (!lawyers || lawyers.length === 0) { json(res, { error: 'Premium access required. Contact WakeelAI to upgrade.' }); return; }
        const sys = 'You are an expert Pakistani legal research assistant helping a practicing advocate prepare for court.\nProvide: Case Analysis, Relevant Laws, Legal Arguments, Counter-Arguments, Practical Advice.\nBe precise. Note: Verify all citations independently before use in court.';
        const text = await groq(sys, [{ role: 'user', content: body.caseDetails }]);
        json(res, { content: [{ type: 'text', text }] });
      } catch(e) { json(res, { error: e.message }); }
      return;
    }

    // Request document
    if (pathname === '/api/request-document') {
      try {
        const id = 'DOC' + Date.now();
        await supa('POST', '/rest/v1/documents', {
          id, type: body.type, description: body.description,
          name: body.name, phone: body.phone, email: body.email || '',
          price: body.price, status: 'pending'
        });
        json(res, { success: true, id, message: `WhatsApp: ${WHATSAPP} | Ref: ${id}` });
      } catch(e) { json(res, { error: e.message }); }
      return;
    }

    // Check document status
    if (pathname === '/api/check-document') {
      try {
        const id = (body.id || '').trim();
        const phone = (body.phone || '').trim();
        const docs = await supa('GET', `/rest/v1/documents?id=eq.${encodeURIComponent(id)}&phone=eq.${encodeURIComponent(phone)}&select=*`, null);
        if (!docs || docs.length === 0) { json(res, { error: 'Not found. Check your document ID and phone number.' }); return; }
        const doc = docs[0];
        if (doc.status === 'completed') json(res, { status: 'completed', document: doc.document, type: doc.type });
        else json(res, { status: doc.status, message: 'Your document is being prepared. You will be notified on WhatsApp.' });
      } catch(e) { json(res, { error: e.message }); }
      return;
    }

    // Admin - get all data
    if (pathname === '/api/admin-data') {
      if ((body.password || '').trim() !== ADMIN_PASS.trim()) { json(res, { error: 'Wrong password' }); return; }
      try {
        const [lawyers, documents] = await Promise.all([
          supa('GET', '/rest/v1/lawyers?select=*&order=created_at.desc', null),
          supa('GET', '/rest/v1/documents?select=*&order=created_at.desc', null)
        ]);
        json(res, {
          lawyers: Array.isArray(lawyers) ? lawyers : [],
          documents: Array.isArray(documents) ? documents : [],
          admin: { whatsapp: WHATSAPP }
        });
      } catch(e) { json(res, { error: e.message }); }
      return;
    }

    // Admin - save/update lawyer
    if (pathname === '/api/admin-save-lawyer') {
      if ((body.password || '').trim() !== ADMIN_PASS.trim()) { json(res, { error: 'Wrong password' }); return; }
      try {
        await supa('POST', '/rest/v1/lawyers', body.lawyer);
        json(res, { success: true });
      } catch(e) { json(res, { error: e.message }); }
      return;
    }

    // Admin - delete lawyer
    if (pathname === '/api/admin-delete-lawyer') {
      if ((body.password || '').trim() !== ADMIN_PASS.trim()) { json(res, { error: 'Wrong password' }); return; }
      try {
        await supa('DELETE', `/rest/v1/lawyers?id=eq.${encodeURIComponent(body.id)}`, null);
        json(res, { success: true });
      } catch(e) { json(res, { error: e.message }); }
      return;
    }

    // Admin - update document status
    if (pathname === '/api/admin-update-doc') {
      if ((body.password || '').trim() !== ADMIN_PASS.trim()) { json(res, { error: 'Wrong password' }); return; }
      try {
        await supa('PATCH', `/rest/v1/documents?id=eq.${encodeURIComponent(body.id)}`, { status: body.status });
        json(res, { success: true });
      } catch(e) { json(res, { error: e.message }); }
      return;
    }

    // Admin - generate document with AI
    if (pathname === '/api/generate-document') {
      if ((body.password || '').trim() !== ADMIN_PASS.trim()) { json(res, { error: 'Wrong password' }); return; }
      try {
        const docs = await supa('GET', `/rest/v1/documents?id=eq.${encodeURIComponent(body.id)}&select=*`, null);
        if (!docs || docs.length === 0) { json(res, { error: 'Document not found' }); return; }
        const doc = docs[0];
        const sys = 'You are an expert Pakistani legal document drafter. Write professional, complete, legally sound documents ready for use in Pakistan. Use proper formal format.';
        const prompt = `Draft a ${doc.type} for:\n\n${doc.description}\n\nClient: ${doc.name}\n\nMake it complete and professional.`;
        const text = await groq(sys, [{ role: 'user', content: prompt }]);
        await supa('PATCH', `/rest/v1/documents?id=eq.${encodeURIComponent(body.id)}`, {
          document: text, status: 'completed', completed_at: new Date().toISOString()
        });
        json(res, { success: true, document: text, id: body.id });
      } catch(e) { json(res, { error: e.message }); }
      return;
    }
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log('\n========================================');
  console.log('  WakeelAI running on port ' + PORT);
  console.log('  Groq key: ' + (GROQ_KEY ? 'SET ✅' : 'MISSING ❌'));
  console.log('  Supabase: ' + (SUPA_URL ? 'SET ✅' : 'MISSING ❌'));
  console.log('  Test: http://localhost:' + PORT + '/test');
  console.log('========================================\n');
});
