const ACCESS_CODE = 'm1c23t';

function currency(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function stars(value) {
  return '★'.repeat(value) + '☆'.repeat(Math.max(0, 5 - value));
}

function setTopbarOnScroll() {
  const topbar = document.getElementById('topbar');
  const onScroll = () => {
    topbar.classList.toggle('scrolled', window.scrollY > 10);
  };
  onScroll();
  window.addEventListener('scroll', onScroll);
}

function bindAuthButton() {
  const button = document.getElementById('openDashboard');
  button?.addEventListener('click', () => {
    const code = window.prompt('Introduce el código de acceso al dashboard');
    if (!code) return;

    if (code === ACCESS_CODE) {
      sessionStorage.setItem('macout-auth', 'true');
      window.location.href = '/dashboard.html?v=20260302c';
      return;
    }

    alert('Código incorrecto');
  });
}

async function loadLandingData() {
  const [productsRes, testimonialsRes] = await Promise.all([
    fetch('/api/products'),
    fetch('/api/testimonials')
  ]);

  const products = productsRes.ok ? await productsRes.json() : [];
  const testimonials = testimonialsRes.ok ? await testimonialsRes.json() : [];

  const productsGrid = document.getElementById('productsGrid');
  const testimonialsGrid = document.getElementById('testimonialsGrid');

  if (products.length === 0) {
    productsGrid.innerHTML = '<p>No hay equipos disponibles en este momento.</p>';
  } else {
    productsGrid.innerHTML = products
      .slice()
      .reverse()
      .slice(0, 12)
      .map(
        (product) => `
        <article class="product-card">
          <img src="${product.image}" alt="${product.name}" />
          <div class="product-body">
            <h3>${product.name}</h3>
            <span class="price-badge">${currency(product.price)}</span>
            <p class="product-desc">${product.description}</p>
            <a class="product-buy" href="${product.buyLink}" target="_blank" rel="noreferrer">Comprar</a>
          </div>
        </article>
      `
      )
      .join('');
  }

  if (testimonials.length === 0) {
    testimonialsGrid.innerHTML = '<p>Aún no hay testimonios para mostrar.</p>';
  } else {
    testimonialsGrid.innerHTML = testimonials
      .slice()
      .reverse()
      .slice(0, 4)
      .map(
        (item) => `
        <article class="testimonial-card">
          <p class="testimonial-stars">${stars(item.stars)}</p>
          <p class="testimonial-copy">"${item.review}"</p>
          <div class="testimonial-user">
            <span class="avatar">${item.avatar}</span>
            <strong>${item.name}</strong>
          </div>
        </article>
      `
      )
      .join('');
  }
}

function setYear() {
  const yearNode = document.getElementById('year');
  if (yearNode) yearNode.textContent = String(new Date().getFullYear());
}

setTopbarOnScroll();
bindAuthButton();
setYear();
loadLandingData().catch((error) => {
  console.error(error);
  alert('No se pudieron cargar los datos de la landing.');
});
