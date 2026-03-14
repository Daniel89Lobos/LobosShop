const productGrid = document.getElementById("productGrid");
const shopNotice = document.getElementById("shopNotice");

function getCategoryLabel(category) {
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

function highlightRequestedProduct() {
  if (!window.location.hash.startsWith("#product-")) {
    return;
  }

  const target = document.getElementById(window.location.hash.slice(1));

  if (!target) {
    return;
  }

  target.classList.add("is-targeted");
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  window.setTimeout(() => {
    target.classList.remove("is-targeted");
  }, 2200);
}

function showShopNotice(message, type = "error") {
  if (!shopNotice) {
    return;
  }

  shopNotice.hidden = false;
  shopNotice.className = `page-status${type === "success" ? " is-success" : type === "error" ? " is-error" : ""}`;
  shopNotice.textContent = message;
}

function getStockLabel(product) {
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

function renderProducts(products) {
  if (!productGrid) {
    return;
  }

  if (!Array.isArray(products) || products.length === 0) {
    productGrid.innerHTML = `
      <article class="card empty-state">
        <h3>No products available</h3>
        <p>Add products to the database seed and reload the shop.</p>
      </article>
    `;
    return;
  }

  productGrid.innerHTML = products
    .map((product) => {
      const stock = getStockLabel(product);
      const detailHref = getProductDetailHref(product);

      return `
        <article id="product-${product.slug}" class="card product-card card-stack" data-category="${product.category}" data-slug="${product.slug}">
          <a class="product-image-link" href="${detailHref}">
            <img class="product-image" src="${product.imagePath}" alt="${product.name}" />
          </a>
          <div class="card-tag">${getCategoryLabel(product.category)}</div>
          <h3><a class="product-title-link" href="${detailHref}">${product.name}</a></h3>
          <p>${product.description}</p>
          <a class="text-link" href="${detailHref}">View details</a>
          <p class="price">${product.price}</p>
          <div class="card-footer">
            <span class="${stock.className}">${stock.text}</span>
            <button class="btn" type="button" data-add-to-cart="${product.id}" ${product.stockStatus === "out_of_stock" ? "disabled" : ""}>
              ${product.stockStatus === "out_of_stock" ? "Unavailable" : "Add to cart"}
            </button>
          </div>
          <p class="inventory-copy">${stock.note}</p>
        </article>
      `;
    })
    .join("");
}

async function loadProducts() {
  if (!productGrid) {
    return;
  }

  try {
    const data = await window.LobosStore.fetchCatalog();
    const initialCategory = window.LobosShopFilters ? window.LobosShopFilters.getInitialCategory() : "all";

    renderProducts(data.products || []);
    window.LobosShopFilters?.apply(initialCategory, { updateUrl: false });
    highlightRequestedProduct();

    if (data.source === "fallback") {
      showShopNotice(
        "Products are loading from a static catalog because the live backend API is not deployed yet. Browsing works, but checkout still needs the server setup.",
      );
    }
  } catch (error) {
    productGrid.innerHTML = `
      <article class="card empty-state">
        <h3>Product feed unavailable</h3>
        <p>${error.message}</p>
      </article>
    `;
    showShopNotice("Could not load products from either the API or the fallback catalog.");
  }
}

if (productGrid) {
  loadProducts();

  productGrid.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-to-cart]");

    if (!addButton) {
      return;
    }

    const productId = Number.parseInt(addButton.dataset.addToCart, 10);
    window.LobosCart.addItem(productId, 1);
    showShopNotice("Added to cart. You can keep browsing or review your cart now.", "success");
  });
}
