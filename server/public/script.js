const CART_STORAGE_KEY = "lobos-cart";
const FALLBACK_PRODUCTS_PATH = "products.json";
const FEATURED_PRODUCT_SLUGS = [
  "dog",
  "forest-friend-fox",
  "pocket-ocean-octopus",
];
const HOME_PRODUCTS_PAGE_SIZE = 10;
const INTERACTIVE_ELEMENT_SELECTOR = "a, button, input, select, textarea, label";

let cartItemsCache = [];
let cartScope = {
  type: "guest",
  userId: null,
  username: null,
};
let cartLoadPromise = null;
let authStateCache = null;
let authStatePromise = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateText(value, maxLength = 110) {
  const normalizedValue = String(value ?? "").trim();

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength).trimEnd()}...`;
}

function sanitizeCart(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const mergedItems = new Map();

  items.forEach((item) => {
    const productId = Number.parseInt(String(item.productId), 10);
    const quantity = Number.parseInt(String(item.quantity), 10);

    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      return;
    }

    mergedItems.set(productId, (mergedItems.get(productId) || 0) + quantity);
  });

  return [...mergedItems.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function readGuestCart() {
  try {
    return sanitizeCart(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]"));
  } catch (error) {
    return [];
  }
}

function writeGuestCart(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(sanitizeCart(items)));
}

function clearGuestCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
}

function emitCartUpdate(items) {
  window.dispatchEvent(
    new CustomEvent("lobos:cart-updated", {
      detail: {
        items,
        count: items.reduce((sum, item) => sum + item.quantity, 0),
        scope: { ...cartScope },
      },
    }),
  );
}

function syncCartCount() {
  const cartCount = cartItemsCache.reduce((sum, item) => sum + item.quantity, 0);

  document.querySelectorAll("[data-cart-count]").forEach((element) => {
    element.textContent = String(cartCount);
    element.hidden = cartCount === 0;
  });
}

function mergeCartItems(...carts) {
  return sanitizeCart(carts.flat());
}

function getAccountLinkLabel(user) {
  if (!user?.username) {
    return "Login";
  }

  const shortName = user.username.length > 12 ? `${user.username.slice(0, 12)}...` : user.username;
  return `Hi, ${shortName}`;
}

function updateAdminLinks(user) {
  document.querySelectorAll("[data-admin-link]").forEach((link) => {
    link.hidden = !user?.isAdmin;
  });
}

function updateAccountLinks(user) {
  document.querySelectorAll("[data-account-link]").forEach((link) => {
    link.textContent = getAccountLinkLabel(user);
    link.href = "account.html";

    if (user?.username) {
      link.setAttribute("aria-label", `Account for ${user.username}`);
      link.title = `Signed in as ${user.username}`;
    } else {
      link.setAttribute("aria-label", "Login or create account");
      link.removeAttribute("title");
    }
  });
}

function emitAuthUpdate(user) {
  window.dispatchEvent(
    new CustomEvent("lobos:auth-changed", {
      detail: {
        authenticated: Boolean(user?.userId),
        user: user ? { ...user } : null,
      },
    }),
  );
}

async function fetchAuthState() {
  const response = await fetch("/api/auth/check", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Could not check your login status");
  }

  const data = await response.json();

  if (!data.authenticated) {
    return null;
  }

  return {
    userId: Number(data.userId),
    username: data.username || null,
    isAdmin: Boolean(data.isAdmin),
  };
}

async function refreshAuthState() {
  if (!authStatePromise) {
    authStatePromise = fetchAuthState()
      .then((user) => {
        authStateCache = user ? { ...user } : null;
        updateAccountLinks(authStateCache);
        updateAdminLinks(authStateCache);
        emitAuthUpdate(authStateCache);
        return authStateCache;
      })
      .catch(() => {
        authStateCache = null;
        updateAccountLinks(null);
        updateAdminLinks(null);
        emitAuthUpdate(null);
        return null;
      })
      .finally(() => {
        authStatePromise = null;
      });
  }

  return authStatePromise;
}

window.LobosAuth = {
  ready: refreshAuthState(),

  async refresh() {
    return refreshAuthState();
  },

  getUser() {
    return authStateCache ? { ...authStateCache } : null;
  },

  isAuthenticated() {
    return Boolean(authStateCache?.userId);
  },

  async login(username, password) {
    const response = await fetch("/api/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Could not log in");
    }

    await refreshAuthState();
    await window.LobosCart?.refresh?.();
    return data.user;
  },

  async register({ username, password }) {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Could not create your account");
    }

    return data.user;
  },

  async registerAndLogin({ username, password }) {
    await window.LobosAuth.register({ username, password });
    return window.LobosAuth.login(username, password);
  },

  async logout() {
    const response = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Could not log out");
    }

    authStateCache = null;
    updateAccountLinks(null);
    emitAuthUpdate(null);
    await window.LobosCart?.refresh?.();
    return data;
  },
};

async function fetchRemoteCart() {
  const response = await fetch("/api/cart", {
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not load your cart");
  }

  const data = await response.json();
  return sanitizeCart(data.items || []);
}

async function saveRemoteCart(items) {
  const response = await fetch("/api/cart", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items: sanitizeCart(items) }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Could not save your cart");
  }

  return sanitizeCart(data.items || []);
}

async function loadCartState() {
  try {
    const authenticatedUser = window.LobosAuth ? await window.LobosAuth.refresh() : await fetchAuthState();

    if (!authenticatedUser) {
      cartScope = {
        type: "guest",
        userId: null,
        username: null,
      };
      cartItemsCache = readGuestCart();
      emitCartUpdate(cartItemsCache);
      return cartItemsCache;
    }

    cartScope = {
      type: "user",
      userId: authenticatedUser.userId,
      username: authenticatedUser.username,
    };

    const [remoteCart, guestCart] = await Promise.all([
      fetchRemoteCart(),
      Promise.resolve(readGuestCart()),
    ]);

    if (guestCart.length > 0) {
      cartItemsCache = await saveRemoteCart(mergeCartItems(remoteCart, guestCart));
      clearGuestCart();
    } else {
      cartItemsCache = remoteCart;
    }

    emitCartUpdate(cartItemsCache);
    return cartItemsCache;
  } catch (error) {
    cartScope = {
      type: "guest",
      userId: null,
      username: null,
    };
    cartItemsCache = readGuestCart();
    emitCartUpdate(cartItemsCache);
    return cartItemsCache;
  }
}

async function refreshCartState() {
  if (!cartLoadPromise) {
    cartLoadPromise = loadCartState().finally(() => {
      cartLoadPromise = null;
    });
  }

  return cartLoadPromise;
}

async function persistCart(items) {
  const sanitizedItems = sanitizeCart(items);
  const previousItems = [...cartItemsCache];

  cartItemsCache = sanitizedItems;
  emitCartUpdate(cartItemsCache);

  try {
    if (cartScope.type === "user" && cartScope.userId) {
      cartItemsCache = await saveRemoteCart(sanitizedItems);
    } else {
      if (sanitizedItems.length === 0) {
        clearGuestCart();
      } else {
        writeGuestCart(sanitizedItems);
      }
    }

    emitCartUpdate(cartItemsCache);
    return cartItemsCache;
  } catch (error) {
    cartItemsCache = previousItems;
    emitCartUpdate(cartItemsCache);
    throw error;
  }
}

async function ensureCartReady() {
  if (cartLoadPromise) {
    await cartLoadPromise;
    return;
  }

  if (cartScope.type === "guest" && cartItemsCache.length === 0 && localStorage.getItem(CART_STORAGE_KEY) !== null) {
    cartItemsCache = readGuestCart();
    emitCartUpdate(cartItemsCache);
    return;
  }

  if (cartScope.userId || cartItemsCache.length > 0) {
    return;
  }

  await refreshCartState();
}

window.LobosCart = {
  ready: refreshCartState(),

  async refresh() {
    return refreshCartState();
  },

  getItems() {
    return [...cartItemsCache];
  },

  getScope() {
    return { ...cartScope };
  },

  async setItems(items) {
    await ensureCartReady();
    return persistCart(items);
  },

  async addItem(productId, quantity = 1) {
    await ensureCartReady();

    const nextCart = [...cartItemsCache];
    const numericProductId = Number.parseInt(String(productId), 10);
    const numericQuantity = Number.parseInt(String(quantity), 10);
    const existingItem = nextCart.find((item) => item.productId === numericProductId);

    if (!Number.isInteger(numericProductId) || numericProductId <= 0) {
      return nextCart;
    }

    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      return nextCart;
    }

    if (existingItem) {
      existingItem.quantity += numericQuantity;
    } else {
      nextCart.push({ productId: numericProductId, quantity: numericQuantity });
    }

    return persistCart(nextCart);
  },

  async updateItem(productId, quantity) {
    await ensureCartReady();

    const numericProductId = Number.parseInt(String(productId), 10);
    const numericQuantity = Number.parseInt(String(quantity), 10);
    const nextCart = [...cartItemsCache];
    const itemIndex = nextCart.findIndex((item) => item.productId === numericProductId);

    if (itemIndex === -1) {
      return nextCart;
    }

    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      nextCart.splice(itemIndex, 1);
      return persistCart(nextCart);
    }

    nextCart[itemIndex] = {
      ...nextCart[itemIndex],
      quantity: numericQuantity,
    };

    return persistCart(nextCart);
  },

  async removeItem(productId) {
    await ensureCartReady();
    return persistCart(
      cartItemsCache.filter((item) => item.productId !== Number.parseInt(String(productId), 10)),
    );
  },

  async clear() {
    await ensureCartReady();
    return persistCart([]);
  },

  getCount() {
    return cartItemsCache.reduce((sum, item) => sum + item.quantity, 0);
  },

  formatMoney(amount, currency = "SEK") {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency,
    }).format(Number(amount || 0) / 100);
  },

  syncCount: syncCartCount,
};

window.LobosStore = {
  async fetchCatalog() {
    try {
      const apiResponse = await fetch("/api/products");

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        return {
          ...apiData,
          source: "api",
        };
      }
    } catch (error) {
    }

    const fallbackResponse = await fetch(FALLBACK_PRODUCTS_PATH);
    const fallbackData = await fallbackResponse.json();

    return {
      ...fallbackData,
      source: "fallback",
    };
  },

  async fetchFeaturedProducts() {
    try {
      const apiResponse = await fetch("/api/featured-products");

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        const featuredProducts = Array.isArray(apiData.featuredProducts)
          ? apiData.featuredProducts.filter((product) => product?.category === "amigurumi")
          : [];

        if (featuredProducts.length > 0) {
          return {
            products: featuredProducts,
            source: "api",
          };
        }
      }
    } catch (error) {
    }

    const catalogData = await window.LobosStore.fetchCatalog();

    return {
      products: getFeaturedProducts(catalogData.products || []),
      source: catalogData.source,
    };
  },

  async fetchProduct(slug) {
    if (!slug) {
      throw new Error("Missing product slug.");
    }

    try {
      const apiResponse = await fetch(`/api/products/${encodeURIComponent(slug)}`);

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        return {
          ...apiData,
          source: "api",
        };
      }
    } catch (error) {
    }

    const fallbackResponse = await fetch(FALLBACK_PRODUCTS_PATH);
    const fallbackData = await fallbackResponse.json();
    const product = (fallbackData.products || []).find((item) => item.slug === slug);

    if (!product) {
      throw new Error("Product not found.");
    }

    return {
      product,
      source: "fallback",
    };
  },
};

const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    siteNav.classList.toggle("open");
  });
}

const filterButtons = document.querySelectorAll(".filter-btn");

function getInitialShopCategory() {
  const params = new URLSearchParams(window.location.search);
  return params.get("category") || filterButtons[0]?.dataset.filter || "all";
}

function getValidShopCategory(category) {
  return Array.from(filterButtons).some((button) => button.dataset.filter === category)
    ? category
    : filterButtons[0]?.dataset.filter || "all";
}

function updateShopCategoryUrl(category) {
  const url = new URL(window.location.href);

  if (category === "all") {
    url.searchParams.delete("category");
  } else {
    url.searchParams.set("category", category);
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function applyShopFilter(category = "all", options = {}) {
  const nextCategory = getValidShopCategory(category);
  const productCards = document.querySelectorAll(".product-card");

  filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === nextCategory);
  });

  productCards.forEach((card) => {
    card.style.display = nextCategory === "all" || card.dataset.category === nextCategory ? "block" : "none";
  });

  if (options.updateUrl !== false) {
    updateShopCategoryUrl(nextCategory);
  }

  return nextCategory;
}

window.LobosShopFilters = {
  apply: applyShopFilter,
  getInitialCategory: getInitialShopCategory,
};

if (filterButtons.length > 0) {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyShopFilter(button.dataset.filter);
    });
  });
}

const featuredProductsGrid = document.getElementById("featuredProducts");
const featuredProductsNotice = document.getElementById("featuredProductsNotice");
const featuredProductsPagination = document.getElementById("featuredProductsPagination");
const featuredProductsResults = document.getElementById("featuredProductsResults");
let homepageProducts = [];

function showFeaturedProductsNotice(message, type = "error") {
  if (!featuredProductsNotice) {
    return;
  }

  featuredProductsNotice.hidden = false;
  featuredProductsNotice.className = `page-status${type === "success" ? " is-success" : type === "error" ? " is-error" : ""}`;
  featuredProductsNotice.textContent = message;
}

function clearFeaturedProductsNotice() {
  if (!featuredProductsNotice) {
    return;
  }

  featuredProductsNotice.hidden = true;
  featuredProductsNotice.className = "page-status";
  featuredProductsNotice.textContent = "";
}

function getHomepageCategoryLabel(category) {
  if (category === "books") {
    return "Book";
  }

  if (category === "calendars") {
    return "Calendar";
  }

  if (category === "amigurumi") {
    return "Amigurumi";
  }

  return "Product";
}

function getProductDetailHref(product) {
  return `product.html?slug=${encodeURIComponent(product.slug)}`;
}

function getStoreStockLabel(product) {
  if (product.stockStatus === "out_of_stock") {
    return {
      className: "status-pill out-of-stock",
      text: "Out of stock",
      note: "This product cannot be added until stock is updated.",
    };
  }

  if (product.stockStatus === "low_stock") {
    return {
      className: "status-pill low-stock",
      text: `Only ${product.stockQuantity} left`,
      note: "Low stock. Stripe will verify availability again at checkout.",
    };
  }

  return {
    className: "status-pill in-stock",
    text: "In stock",
    note: `Ready to ship from Sweden. ${product.stockQuantity} available right now.`,
  };
}

function getFeaturedProducts(products) {
  const amigurumiProducts = (Array.isArray(products) ? products : []).filter(
    (product) => product?.category === "amigurumi",
  );
  const productMap = new Map(
    amigurumiProducts
      .filter((product) => product && product.slug)
      .map((product) => [product.slug, product]),
  );
  const selectedProducts = FEATURED_PRODUCT_SLUGS.map((slug) => productMap.get(slug)).filter(Boolean);

  if (selectedProducts.length >= FEATURED_PRODUCT_SLUGS.length) {
    return selectedProducts;
  }

  const usedSlugs = new Set(selectedProducts.map((product) => product.slug));
  const fallbackProducts = amigurumiProducts.filter(
    (product) => product?.slug && !usedSlugs.has(product.slug),
  );

  return [...selectedProducts, ...fallbackProducts].slice(0, FEATURED_PRODUCT_SLUGS.length);
}

function getProductImagePaths(product) {
  const imagePaths = Array.isArray(product?.imagePaths)
    ? product.imagePaths.map((imagePath) => String(imagePath || "").trim()).filter(Boolean)
    : [];
  const primaryImagePath = String(product?.imagePath || "").trim();

  if (primaryImagePath && !imagePaths.includes(primaryImagePath)) {
    imagePaths.unshift(primaryImagePath);
  }

  return imagePaths;
}

function renderProductImageThumbs(product, imagePaths, imageId) {
  if (imagePaths.length <= 1) {
    return "";
  }

  return `
    <div class="product-image-thumbs" aria-label="Product images for ${escapeHtml(product.name)}">
      ${imagePaths
        .map(
          (imagePath, index) => `
            <button
              class="product-image-thumb${index === 0 ? " is-active" : ""}"
              type="button"
              data-product-image-src="${escapeHtml(imagePath)}"
              data-product-image-target="${escapeHtml(imageId)}"
              aria-label="Show image ${index + 1} for ${escapeHtml(product.name)}"
              aria-pressed="${index === 0 ? "true" : "false"}"
            >
              <img src="${escapeHtml(imagePath)}" alt="" />
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function getHomepagePageFromUrl(totalPages) {
  const params = new URLSearchParams(window.location.search);
  const requestedPage = Number.parseInt(String(params.get("page") || "1"), 10);

  if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > totalPages) {
    return 1;
  }

  return requestedPage;
}

function updateHomepagePageUrl(page) {
  const url = new URL(window.location.href);

  if (page <= 1) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", String(page));
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function renderHomepagePagination(totalProducts, currentPage, totalPages) {
  if (!featuredProductsPagination) {
    return;
  }

  if (featuredProductsResults) {
    if (totalProducts === 0) {
      featuredProductsResults.textContent = "No amigurumi available right now.";
    } else {
      const start = (currentPage - 1) * HOME_PRODUCTS_PAGE_SIZE + 1;
      const end = Math.min(totalProducts, currentPage * HOME_PRODUCTS_PAGE_SIZE);
      featuredProductsResults.textContent = `Showing ${start}-${end} of ${totalProducts} amigurumi.`;
    }
  }

  if (totalPages <= 1) {
    featuredProductsPagination.hidden = true;
    featuredProductsPagination.innerHTML = "";
    return;
  }

  featuredProductsPagination.hidden = false;
  featuredProductsPagination.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return `
      <button class="page-btn${page === currentPage ? " active" : ""}" type="button" data-home-page="${page}" aria-current="${page === currentPage ? "page" : "false"}">
        ${page}
      </button>
    `;
  }).join("");
}

function renderFeaturedProducts(products) {
  if (!featuredProductsGrid) {
    return;
  }

  if (!Array.isArray(products) || products.length === 0) {
    renderHomepagePagination(0, 1, 1);
    featuredProductsGrid.innerHTML = `
      <article class="card empty-state">
        <h3>No amigurumi available</h3>
        <p>Add products to the catalog to show them here.</p>
      </article>
    `;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(products.length / HOME_PRODUCTS_PAGE_SIZE));
  const currentPage = getHomepagePageFromUrl(totalPages);
  const pageStart = (currentPage - 1) * HOME_PRODUCTS_PAGE_SIZE;
  const visibleProducts = products.slice(pageStart, pageStart + HOME_PRODUCTS_PAGE_SIZE);

  updateHomepagePageUrl(currentPage);
  renderHomepagePagination(products.length, currentPage, totalPages);

  featuredProductsGrid.innerHTML = visibleProducts
    .map((product) => {
      const detailHref = getProductDetailHref(product);
      const categoryLabel = getHomepageCategoryLabel(product.category);
      const priceLabel = product.price || window.LobosCart.formatMoney(product.unitAmount, product.currency || "SEK");
      const description = truncateText(product.description, 120);
      const stock = getStoreStockLabel(product);
      const highlightLabel = String(product.highlightLabel || "").trim();
      const imagePaths = getProductImagePaths(product);
      const imagePath = imagePaths[0] || product.imagePath;
      const imageId = `home-product-image-${product.id}`;

      return `
        <article class="featured-card card product-card card-stack" tabindex="0" role="link" data-featured-product-link="${detailHref}" aria-label="View details for ${escapeHtml(product.name)}">
          <img id="${escapeHtml(imageId)}" class="product-image" src="${escapeHtml(imagePath)}" alt="${escapeHtml(product.name)}" />
          ${renderProductImageThumbs(product, imagePaths, imageId)}
          <div class="featured-card-badges">
            ${highlightLabel ? `<div class="card-tag is-highlight">${escapeHtml(highlightLabel)}</div>` : ""}
            <div class="card-tag">${escapeHtml(categoryLabel)}</div>
          </div>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(description)}</p>
          <p class="price">${escapeHtml(priceLabel)}</p>
          <div class="card-footer">
            <span class="${stock.className}">${escapeHtml(stock.text)}</span>
            <button class="btn" type="button" data-featured-add-to-cart="${product.id}" ${product.stockStatus === "out_of_stock" ? "disabled" : ""}>
              ${product.stockStatus === "out_of_stock" ? "Unavailable" : "Add to cart"}
            </button>
          </div>
          <p class="inventory-copy">${escapeHtml(stock.note)}</p>
          <a class="text-link featured-card-cta" href="${detailHref}">View details</a>
        </article>
      `;
    })
    .join("");
}

async function loadFeaturedProducts() {
  if (!featuredProductsGrid) {
    return;
  }

  try {
    const data = await window.LobosStore.fetchCatalog();
    homepageProducts = (data.products || []).filter((product) => product?.category === "amigurumi");
    renderFeaturedProducts(homepageProducts);
    clearFeaturedProductsNotice();
  } catch (error) {
    featuredProductsGrid.innerHTML = `
      <article class="card empty-state">
        <h3>Amigurumi unavailable</h3>
        <p>We could not load the product catalog right now.</p>
      </article>
    `;
    showFeaturedProductsNotice("Available amigurumi could not be loaded right now.");
  }
}

if (featuredProductsGrid) {
  loadFeaturedProducts();

  featuredProductsGrid.addEventListener("click", async (event) => {
    const imageButton = event.target.closest("[data-product-image-src]");

    if (imageButton) {
      const image = document.getElementById(imageButton.dataset.productImageTarget);

      if (image) {
        image.src = imageButton.dataset.productImageSrc;
      }

      imageButton
        .closest(".product-image-thumbs")
        ?.querySelectorAll("[data-product-image-src]")
        .forEach((button) => {
          const isActive = button === imageButton;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
      return;
    }

    const addButton = event.target.closest("[data-featured-add-to-cart]");

    if (addButton) {
      try {
        const productId = Number.parseInt(addButton.dataset.featuredAddToCart, 10);
        await window.LobosCart.addItem(productId, 1);
        showFeaturedProductsNotice("Added to cart. You can keep browsing or review your cart now.", "success");
      } catch (error) {
        showFeaturedProductsNotice(error.message || "Could not add this product to your cart.");
      }
      return;
    }

    if (event.target.closest(INTERACTIVE_ELEMENT_SELECTOR)) {
      return;
    }

    const card = event.target.closest("[data-featured-product-link]");

    if (!card) {
      return;
    }

    window.location.href = card.dataset.featuredProductLink;
  });

  featuredProductsGrid.addEventListener("keydown", (event) => {
    const card = event.target.closest("[data-featured-product-link]");

    if (!card || event.target !== card || !["Enter", " "].includes(event.key)) {
      return;
    }

    event.preventDefault();
    window.location.href = card.dataset.featuredProductLink;
  });
}

if (featuredProductsPagination) {
  featuredProductsPagination.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-home-page]");

    if (!pageButton) {
      return;
    }

    const page = Number.parseInt(pageButton.dataset.homePage, 10);

    if (!Number.isInteger(page) || page <= 0) {
      return;
    }

    updateHomepagePageUrl(page);
    renderFeaturedProducts(homepageProducts);
    featuredProductsGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

const contactForm = document.getElementById("contactForm");
const contactNotice = document.getElementById("contactNotice");
const contactSubmitButton = document.getElementById("contactSubmitButton");

function showContactNotice(message, type = "") {
  if (!contactNotice) {
    return;
  }

  contactNotice.hidden = false;
  contactNotice.className = `page-status${type === "success" ? " is-success" : type === "error" ? " is-error" : ""}`;
  contactNotice.textContent = message;
}

if (contactForm && contactNotice) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      message: String(formData.get("message") || "").trim(),
    };

    if (!payload.name || !payload.email || !payload.message) {
      showContactNotice("Please fill in your name, email, and message.", "error");
      return;
    }

    try {
      if (contactSubmitButton) {
        contactSubmitButton.disabled = true;
        contactSubmitButton.textContent = "Sending...";
      }

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not send your message.");
      }

      showContactNotice("Thanks! Your message was sent to Lobos Shop.", "success");
      contactForm.reset();
    } catch (error) {
      showContactNotice(error.message || "Could not send your message.", "error");
    } finally {
      if (contactSubmitButton) {
        contactSubmitButton.disabled = false;
        contactSubmitButton.textContent = "Send message";
      }
    }
  });
}

window.addEventListener("storage", (event) => {
  if (event.key !== CART_STORAGE_KEY || cartScope.type !== "guest") {
    return;
  }

  cartItemsCache = readGuestCart();
  emitCartUpdate(cartItemsCache);
});
window.addEventListener("lobos:cart-updated", syncCartCount);
window.addEventListener("focus", () => {
  window.LobosAuth.refresh().catch(() => {});
  window.LobosCart.refresh().catch(() => {});
});
updateAccountLinks(null);
updateAdminLinks(null);
syncCartCount();
