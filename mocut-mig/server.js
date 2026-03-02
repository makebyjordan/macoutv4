const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 9010;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      products: [],
      transactions: [],
      testimonials: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();

      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', reject);
  });
}

function createId(prefix) {
  if (typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function starsFromName(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

function validateTransactionType(type) {
  return type === 'income' || type === 'expense';
}

function routeApi(req, res, pathname) {
  const method = req.method || 'GET';
  const db = readDb();

  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, { ok: true, service: 'mocut-mig-api' });
  }

  if (pathname === '/api/products' && method === 'GET') {
    const products = [...db.products].sort((a, b) => a.name.localeCompare(b.name));
    return sendJson(res, 200, products);
  }

  if (pathname === '/api/products' && method === 'POST') {
    return parseBody(req)
      .then((body) => {
        if (!body.name || !body.description || !body.image || !body.buyLink || Number(body.price) <= 0) {
          return sendJson(res, 400, { error: 'Datos inválidos para producto' });
        }

        const product = {
          id: createId('p'),
          name: String(body.name),
          description: String(body.description),
          image: String(body.image),
          price: Number(body.price),
          buyLink: String(body.buyLink)
        };

        db.products.push(product);
        writeDb(db);
        return sendJson(res, 201, product);
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  if (pathname.startsWith('/api/products/') && (method === 'PUT' || method === 'DELETE')) {
    const id = pathname.replace('/api/products/', '');
    const index = db.products.findIndex((p) => p.id === id);

    if (index === -1) return sendJson(res, 404, { error: 'Producto no encontrado' });

    if (method === 'DELETE') {
      db.products.splice(index, 1);
      writeDb(db);
      return sendJson(res, 200, { success: true });
    }

    return parseBody(req)
      .then((body) => {
        if (!body.name || !body.description || !body.image || !body.buyLink || Number(body.price) <= 0) {
          return sendJson(res, 400, { error: 'Datos inválidos para producto' });
        }

        const updated = {
          ...db.products[index],
          name: String(body.name),
          description: String(body.description),
          image: String(body.image),
          price: Number(body.price),
          buyLink: String(body.buyLink)
        };

        db.products[index] = updated;
        writeDb(db);
        return sendJson(res, 200, updated);
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  if (pathname === '/api/transactions' && method === 'GET') {
    const transactions = [...db.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sendJson(res, 200, transactions);
  }

  if (pathname === '/api/transactions' && method === 'POST') {
    return parseBody(req)
      .then((body) => {
        if (!validateTransactionType(body.type) || !body.title || Number(body.amount) <= 0) {
          return sendJson(res, 400, { error: 'Datos inválidos para transacción' });
        }

        const transaction = {
          id: createId('t'),
          type: body.type,
          title: String(body.title),
          description: body.description ? String(body.description) : '',
          amount: Number(body.amount),
          date: new Date().toISOString()
        };

        db.transactions.push(transaction);
        writeDb(db);
        return sendJson(res, 201, transaction);
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  if (pathname.startsWith('/api/transactions/') && (method === 'PUT' || method === 'DELETE')) {
    const id = pathname.replace('/api/transactions/', '');
    const index = db.transactions.findIndex((t) => t.id === id);

    if (index === -1) return sendJson(res, 404, { error: 'Transacción no encontrada' });

    if (method === 'DELETE') {
      db.transactions.splice(index, 1);
      writeDb(db);
      return sendJson(res, 200, { success: true });
    }

    return parseBody(req)
      .then((body) => {
        if (!validateTransactionType(body.type) || !body.title || Number(body.amount) <= 0) {
          return sendJson(res, 400, { error: 'Datos inválidos para transacción' });
        }

        const updated = {
          ...db.transactions[index],
          type: body.type,
          title: String(body.title),
          description: body.description ? String(body.description) : '',
          amount: Number(body.amount),
          date: db.transactions[index].date
        };

        db.transactions[index] = updated;
        writeDb(db);
        return sendJson(res, 200, updated);
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  if (pathname === '/api/testimonials' && method === 'GET') {
    const testimonials = [...db.testimonials].sort((a, b) => a.name.localeCompare(b.name));
    return sendJson(res, 200, testimonials);
  }

  if (pathname === '/api/testimonials' && method === 'POST') {
    return parseBody(req)
      .then((body) => {
        const stars = Number(body.stars);
        if (!body.name || !body.review || stars < 1 || stars > 5) {
          return sendJson(res, 400, { error: 'Datos inválidos para testimonio' });
        }

        const testimonial = {
          id: createId('r'),
          name: String(body.name),
          review: String(body.review),
          stars,
          avatar: body.avatar ? String(body.avatar) : starsFromName(String(body.name))
        };

        db.testimonials.push(testimonial);
        writeDb(db);
        return sendJson(res, 201, testimonial);
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  if (pathname.startsWith('/api/testimonials/') && method === 'DELETE') {
    const id = pathname.replace('/api/testimonials/', '');
    const index = db.testimonials.findIndex((t) => t.id === id);

    if (index === -1) return sendJson(res, 404, { error: 'Testimonio no encontrado' });

    db.testimonials.splice(index, 1);
    writeDb(db);
    return sendJson(res, 200, { success: true });
  }

  if (pathname === '/api/dashboard/summary' && method === 'GET') {
    const totalIncome = db.transactions
      .filter((tx) => tx.type === 'income')
      .reduce((acc, tx) => acc + Number(tx.amount || 0), 0);

    const totalExpenses = db.transactions
      .filter((tx) => tx.type === 'expense')
      .reduce((acc, tx) => acc + Number(tx.amount || 0), 0);

    return sendJson(res, 200, {
      totalProducts: db.products.length,
      totalTestimonials: db.testimonials.length,
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses
    });
  }

  return false;
}

function serveStatic(req, res, pathname) {
  let normalizedPath = pathname;

  if (normalizedPath === '/') normalizedPath = '/index.html';
  if (normalizedPath === '/dashboard' || normalizedPath === '/dashboard/') {
    normalizedPath = '/dashboard.html';
  }

  const safePath = path.normalize(normalizedPath).replace(/^\/+(\.\.\/(\.?))+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackError, fallbackContent) => {
          if (fallbackError) {
            sendText(res, 404, 'Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fallbackContent);
        });
        return;
      }

      sendText(res, 500, 'Server error');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (pathname.startsWith('/api/')) {
    const handled = routeApi(req, res, pathname);
    if (handled === false) {
      sendJson(res, 404, { error: 'Endpoint no encontrado' });
    }
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  ensureDataFile();
  console.log(`mocut-mig corriendo en http://localhost:${PORT}`);
});
