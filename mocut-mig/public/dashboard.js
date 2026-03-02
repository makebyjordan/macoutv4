const state = {
  products: [],
  transactions: [],
  testimonials: []
};

function requireAuth() {
  if (sessionStorage.getItem('macout-auth') !== 'true') {
    window.location.href = '/';
  }
}

function currency(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function dateFmt(isoDate) {
  return new Date(isoDate).toLocaleString('es-ES');
}

function stars(value) {
  return '★'.repeat(value) + '☆'.repeat(Math.max(0, 5 - value));
}

function getAvatar(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || 'Error en API');
  }

  if (response.status === 204) return null;
  return response.json();
}

async function loadData() {
  const [products, transactions, testimonials] = await Promise.all([
    api('/api/products'),
    api('/api/transactions'),
    api('/api/testimonials')
  ]);

  state.products = products;
  state.transactions = transactions;
  state.testimonials = testimonials;

  renderSummary();
  renderProducts();
  renderTransactions();
  renderTestimonials();
}

function renderSummary() {
  const totalIncome = state.transactions
    .filter((tx) => tx.type === 'income')
    .reduce((acc, tx) => acc + Number(tx.amount), 0);

  const totalExpenses = state.transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((acc, tx) => acc + Number(tx.amount), 0);

  const netBalance = totalIncome - totalExpenses;

  const container = document.getElementById('summaryCards');
  container.innerHTML = `
    <div class="item"><strong>Equipos</strong><br />${state.products.length}</div>
    <div class="item"><strong>Testimonios</strong><br />${state.testimonials.length}</div>
    <div class="item"><strong>Ingresos</strong><br />${currency(totalIncome)}</div>
    <div class="item"><strong>Gastos</strong><br />${currency(totalExpenses)}</div>
    <div class="item"><strong>Balance</strong><br />${currency(netBalance)}</div>
  `;
}

function renderProducts() {
  const tbody = document.getElementById('productsTableBody');

  tbody.innerHTML = state.products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (product) => `
      <tr>
        <td>
          <strong>${product.name}</strong><br />
          <span class="meta">${product.description}</span>
        </td>
        <td>${currency(product.price)}</td>
        <td>
          <div class="actions">
            <button data-action="edit-product" data-id="${product.id}">Editar</button>
            <button class="delete" data-action="delete-product" data-id="${product.id}">Borrar</button>
          </div>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderTransactions() {
  const tbody = document.getElementById('transactionsTableBody');

  tbody.innerHTML = state.transactions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(
      (tx) => `
      <tr>
        <td>
          <strong>${tx.title}</strong><br />
          <span class="meta">${tx.description || ''}</span>
        </td>
        <td>${tx.type === 'income' ? 'Ingreso' : 'Gasto'}</td>
        <td>${dateFmt(tx.date)}</td>
        <td>${currency(tx.amount)}</td>
        <td>
          <div class="actions">
            <button data-action="edit-transaction" data-id="${tx.id}">Editar</button>
            <button class="delete" data-action="delete-transaction" data-id="${tx.id}">Borrar</button>
          </div>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderTestimonials() {
  const tbody = document.getElementById('testimonialsTableBody');

  tbody.innerHTML = state.testimonials
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (item) => `
      <tr>
        <td><strong>${item.avatar}</strong> ${item.name}</td>
        <td>${item.review}</td>
        <td class="stars">${stars(item.stars)}</td>
        <td>
          <div class="actions">
            <button class="delete" data-action="delete-testimonial" data-id="${item.id}">Borrar</button>
          </div>
        </td>
      </tr>
    `
    )
    .join('');
}

function bindTabs() {
  const buttons = Array.from(document.querySelectorAll('.tab-btn'));
  const panels = Array.from(document.querySelectorAll('.tab-panel'));

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      buttons.forEach((b) => b.classList.toggle('active', b === button));
      panels.forEach((panel) => panel.classList.toggle('hidden', panel.id !== tab));
    });
  });
}

function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('macout-auth');
    window.location.href = '/';
  });
}

function clearProductForm() {
  document.getElementById('productId').value = '';
  document.getElementById('productName').value = '';
  document.getElementById('productDescription').value = '';
  document.getElementById('productImage').value = '';
  document.getElementById('productPrice').value = '';
  document.getElementById('productBuyLink').value = '';
}

function bindProductForm() {
  const form = document.getElementById('productForm');
  const cancel = document.getElementById('cancelProductEdit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('productId').value;
    const payload = {
      name: document.getElementById('productName').value.trim(),
      description: document.getElementById('productDescription').value.trim(),
      image: document.getElementById('productImage').value.trim(),
      price: Number(document.getElementById('productPrice').value),
      buyLink: document.getElementById('productBuyLink').value.trim()
    };

    try {
      if (id) {
        await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
      }

      clearProductForm();
      await loadData();
    } catch (error) {
      alert(error.message);
    }
  });

  cancel.addEventListener('click', clearProductForm);
}

function clearTransactionForm() {
  document.getElementById('transactionId').value = '';
  document.getElementById('transactionType').value = 'income';
  document.getElementById('transactionTitle').value = '';
  document.getElementById('transactionDescription').value = '';
  document.getElementById('transactionAmount').value = '';
}

function bindTransactionForm() {
  const form = document.getElementById('transactionForm');
  const cancel = document.getElementById('cancelTransactionEdit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('transactionId').value;
    const payload = {
      type: document.getElementById('transactionType').value,
      title: document.getElementById('transactionTitle').value.trim(),
      description: document.getElementById('transactionDescription').value.trim(),
      amount: Number(document.getElementById('transactionAmount').value)
    };

    try {
      if (id) {
        await api(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
      }

      clearTransactionForm();
      await loadData();
    } catch (error) {
      alert(error.message);
    }
  });

  cancel.addEventListener('click', clearTransactionForm);
}

function bindTestimonialForm() {
  const form = document.getElementById('testimonialForm');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('testimonialName').value.trim();
    const review = document.getElementById('testimonialReview').value.trim();
    const stars = Number(document.getElementById('testimonialStars').value);

    try {
      await api('/api/testimonials', {
        method: 'POST',
        body: JSON.stringify({
          name,
          review,
          stars,
          avatar: getAvatar(name)
        })
      });

      form.reset();
      document.getElementById('testimonialStars').value = 5;
      await loadData();
    } catch (error) {
      alert(error.message);
    }
  });
}

function bindTableActions() {
  document.body.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) return;

    try {
      if (action === 'edit-product') {
        const item = state.products.find((p) => p.id === id);
        if (!item) return;
        document.getElementById('productId').value = item.id;
        document.getElementById('productName').value = item.name;
        document.getElementById('productDescription').value = item.description;
        document.getElementById('productImage').value = item.image;
        document.getElementById('productPrice').value = item.price;
        document.getElementById('productBuyLink').value = item.buyLink;
      }

      if (action === 'delete-product') {
        if (!confirm('¿Eliminar este producto?')) return;
        await api(`/api/products/${id}`, { method: 'DELETE' });
        await loadData();
      }

      if (action === 'edit-transaction') {
        const tx = state.transactions.find((t) => t.id === id);
        if (!tx) return;
        document.getElementById('transactionId').value = tx.id;
        document.getElementById('transactionType').value = tx.type;
        document.getElementById('transactionTitle').value = tx.title;
        document.getElementById('transactionDescription').value = tx.description || '';
        document.getElementById('transactionAmount').value = tx.amount;
      }

      if (action === 'delete-transaction') {
        if (!confirm('¿Eliminar esta transacción?')) return;
        await api(`/api/transactions/${id}`, { method: 'DELETE' });
        await loadData();
      }

      if (action === 'delete-testimonial') {
        if (!confirm('¿Eliminar este testimonio?')) return;
        await api(`/api/testimonials/${id}`, { method: 'DELETE' });
        await loadData();
      }
    } catch (error) {
      alert(error.message);
    }
  });
}

async function init() {
  requireAuth();
  bindTabs();
  bindLogout();
  bindProductForm();
  bindTransactionForm();
  bindTestimonialForm();
  bindTableActions();
  await loadData();
}

init().catch((error) => {
  console.error(error);
  alert('No se pudo iniciar el dashboard');
});
