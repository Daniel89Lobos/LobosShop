const productContent = document.getElementById("productContent");
const productNotice = document.getElementById("productNotice");

let currentProduct = null;
let selectedQuantity = 1;
let selectedImageIndex = 0;

function showProductNotice(message, type = "error") {
  if (!productNotice) {
    return;
  }

  productNotice.hidden = false;
  productNotice.className = `page-status${type === "success" ? " is-success" : type === "error" ? " is-error" : ""}`;
  productNotice.textContent = message;
}

function clearProductNotice() {
  if (!productNotice) {
    return;
  }

  productNotice.hidden = true;
  productNotice.className = "page-status";
  productNotice.textContent = "";
}

function getRequestedSlug() {
  return new URLSearchParams(window.location.search).get("slug") || "";
}

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

function renderMissingProduct(message) {
  if (!productContent) {
    return;
  }

  productContent.innerHTML = `
    <article class="empty-state">
      <h1>Product not found</h1>
      <p>${message}</p>
      <a class="btn" href="index.html">Back to shop</a>
    </article>
  `;
}

function renderProduct() {
  if (!productContent || !currentProduct) {
    return;
  }

  const stock = getStockLabel(currentProduct);
  const quantity = Math.min(Math.max(selectedQuantity, 1), Math.max(currentProduct.stockQuantity, 1));
  const imagePaths = getProductImagePaths(currentProduct);
  const activeImageIndex = Math.min(Math.max(selectedImageIndex, 0), Math.max(imagePaths.length - 1, 0));
  const activeImagePath = imagePaths[activeImageIndex] || currentProduct.imagePath;
  const productName = escapeHtml(currentProduct.name);

  selectedQuantity = quantity;
  selectedImageIndex = activeImageIndex;

  productContent.innerHTML = `
    <article class="product-detail-panel">
      <div class="product-detail-media">
        <img class="product-detail-image" src="${escapeHtml(activeImagePath)}" alt="${productName}" />
        ${
          imagePaths.length > 1
            ? `<div class="product-image-thumbs is-detail" aria-label="Product images for ${productName}">
                ${imagePaths
                  .map(
                    (imagePath, index) => `
                      <button
                        class="product-image-thumb${index === activeImageIndex ? " is-active" : ""}"
                        type="button"
                        data-product-action="image"
                        data-image-index="${index}"
                        aria-label="Show image ${index + 1} for ${productName}"
                        aria-pressed="${index === activeImageIndex ? "true" : "false"}"
                      >
                        <img src="${escapeHtml(imagePath)}" alt="" />
                      </button>
                    `,
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>
      <div class="product-detail-copy">
        <a class="text-link product-back-link" href="index.html">Back to available amigurumi</a>
        <div class="card-tag">${escapeHtml(getCategoryLabel(currentProduct.category))}</div>
        <h1>${productName}</h1>
        <p class="product-detail-price">${escapeHtml(currentProduct.price)}</p>
        <p class="product-detail-description">${escapeHtml(currentProduct.description)}</p>
        <div class="product-detail-status">
          <span class="${stock.className}">${escapeHtml(stock.text)}</span>
          <p class="product-helper">${escapeHtml(stock.note)}</p>
        </div>
        <div class="product-actions">
          <div class="product-qty-picker" aria-label="Quantity selector">
            <span class="product-qty-label">Qty</span>
            <button class="qty-btn" type="button" data-product-action="decrement" ${quantity <= 1 ? "disabled" : ""}>-</button>
            <span class="qty-value">${quantity}</span>
            <button class="qty-btn" type="button" data-product-action="increment" ${quantity >= currentProduct.stockQuantity ? "disabled" : ""}>+</button>
          </div>
          <button class="btn" type="button" data-product-action="add" ${currentProduct.stockStatus === "out_of_stock" ? "disabled" : ""}>
            ${currentProduct.stockStatus === "out_of_stock" ? "Unavailable" : "Add to cart"}
          </button>
          <a class="btn btn-secondary" href="cart.html">Review cart</a>
        </div>
      </div>
    </article>
  `;
}

async function loadProduct() {
  if (!productContent) {
    return;
  }

  const slug = getRequestedSlug();

  if (!slug) {
    renderMissingProduct("Choose a product from the shop to view its details.");
    return;
  }

  try {
    const data = await window.LobosStore.fetchProduct(slug);

    currentProduct = data.product;
    selectedQuantity = 1;
    selectedImageIndex = 0;
    document.title = `${currentProduct.name} | Lobos Shop`;
    renderProduct();

    if (data.source === "fallback") {
      showProductNotice(
        "This product is loading from a static catalog because the live backend API is not available right now.",
      );
    } else {
      clearProductNotice();
    }
  } catch (error) {
    renderMissingProduct(error.message);
    showProductNotice("Could not load this product right now.");
  }
}

if (productContent) {
  loadProduct();

  productContent.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-product-action]");

    if (!actionButton || !currentProduct) {
      return;
    }

    const action = actionButton.dataset.productAction;

    if (action === "decrement") {
      selectedQuantity = Math.max(selectedQuantity - 1, 1);
      renderProduct();
      return;
    }

    if (action === "increment") {
      selectedQuantity = Math.min(selectedQuantity + 1, currentProduct.stockQuantity);
      renderProduct();
      return;
    }

    if (action === "image") {
      const imageIndex = Number.parseInt(actionButton.dataset.imageIndex, 10);

      if (Number.isInteger(imageIndex) && imageIndex >= 0) {
        selectedImageIndex = imageIndex;
        renderProduct();
      }
      return;
    }

    if (action === "add") {
      try {
        await window.LobosCart.addItem(currentProduct.id, selectedQuantity);
        showProductNotice("Added to cart. You can keep browsing or review your cart now.", "success");
      } catch (error) {
        showProductNotice(error.message || "Could not add this product to your cart.");
      }
    }
  });
}
