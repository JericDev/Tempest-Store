const products = [
  { name: "Queen Bee", category: "pets", price: "₱100", new: true, stock: 5, image: "queenbee.png" },
  { name: "Petal Bee", category: "pets", price: "₱10", new: true, stock: 3, image: "Petalbee.webp" },
  { name: "Bear Bee", category: "pets", price: "₱10", new: true, stock: 4, image: "Bearbeee1.webp" },
  { name: "Dragon Fly", category: "pets", price: "₱150", new: true, stock: 2, image: "DragonflyIcon.webp" },
  { name: "1T Sheckle", category: "sheckles", price: "₱5", new: true, stock: 8, image: "sheckles.png" },
  { name: "Raccoon", category: "pets", price: "₱250", new: true, stock: 1, image: "Raccon_Better_Quality.webp" },
  { name: "Butterfly", category: "pets", price: "₱180", new: true, stock: 6, image: "Thy_Butterfly_V2.webp" },
  { name: "Red Fox", category: "pets", price: "₱25", new: true, stock: 3, image: "RedFox.webp" },
  { name: "Chicken Zombie", category: "pets", price: "₱25", new: true, stock: 0, image: "Chicken_Zombie_Icon.webp" },
  { name: "Disco Bee", category: "pets", price: "₱200", new: true, stock: 2, image: "DiscoBeeIcon.webp" },
  { name: "Chocolate Sprinkler", category: "gears", price: "₱25", new: true, stock: 5, image: "ChocolateSprinkler.webp" },
  { name: "Master Sprinkler", category: "gears", price: "₱10", new: true, stock: 4, image: "MasterSprinkler.webp" },
  { name: "Lightning Rod", category: "gears", price: "₱10", new: true, stock: 3, image: "Lightning_Rod.webp" },
  { name: "Turtle", category: "pets", price: "₱10", new: true, stock: 2, image: "Turtle_icon.webp" },
  { name: "Honey Sprinkler", category: "gears", price: "₱15", new: true, stock: 6, image: "HoneySprinklerRender.webp" },
  { name: "Godly Sprinkler", category: "gears", price: "₱5", new: true, stock: 0, image: "Godly_Sprinkler.webp" },
  { name: "Sprinkler Method", category: "gears", price: "₱15", new: true, stock: 7, image: "sprinklermethod.png" },
  { name: "Polar Bear", category: "pets", price: "₱10", new: true, stock: 1, image: "Polarbear.webp" },
];
let currentCategory = "all";
let cart = JSON.parse(localStorage.getItem("cart")) || [];

function renderProducts(items) {
  const list = document.getElementById("product-list");
  list.innerHTML = "";

  items.forEach((product, index) => {
    const card = document.createElement("div");
    card.className = "card";
    if (product.stock <= 0) card.classList.add("out-of-stock");

    card.innerHTML = `
      ${product.new ? `<span class="badge">NEW</span>` : ""}
      <img src="images/${product.image}" alt="${product.name}" />
      <h4>${product.name}</h4>
      <div class="price">₱${product.price}</div>
      <div style="color:${product.stock > 0 ? 'green' : 'red'}; font-weight:bold;">
        ${product.stock > 0 ? `Stock: ${product.stock}` : 'Out of Stock'}
      </div>
      <div class="buttons">
        <button onclick="addToCart(${index})" ${product.stock <= 0 ? 'disabled' : ''}>Add to Cart</button>
        <button onclick="buyNow(${index})" ${product.stock <= 0 ? 'disabled' : ''}>Buy Now</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function setFilter(category) {
  currentCategory = category;
  document.querySelectorAll(".filters button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.cat === category);
  });
  applyFilters();
}

function applyFilters() {
  const query = document.getElementById("searchBox").value.toLowerCase().trim();

  const filtered = products.filter(product => {
    const matchesCategory = currentCategory === "all" || product.category === currentCategory;
    const matchesSearch = query === "" || product.name.toLowerCase().startsWith(query);
    return matchesCategory && matchesSearch;
  });

  renderProducts(filtered);
}

function addToCart(index) {
  const product = products[index];
  if (product.stock <= 0) return;

  cart.push({ ...product, quantity: 1 });
  product.stock--;
  saveCart();
  applyFilters();
}

function buyNow(index) {
  const product = products[index];
  if (product.stock <= 0) return;

  // Decrease stock
  product.stock--;

  // Show order summary
  showOrderSummary(product);

  saveCart();
  applyFilters();
}

function showOrderSummary(product) {
  const modal = document.createElement("div");
  modal.className = "order-modal";
  modal.innerHTML = `
    <div class="order-box">
      <h2>Order Summary</h2>
      <p><strong>Item:</strong> ${product.name}</p>
      <p><strong>Quantity:</strong> 1</p>
      <p><strong>Price:</strong> ₱${product.price}</p>
      <p><strong>Payment Method:</strong> Cash on Delivery</p>
      <hr>
      <p><strong>Total (1 item):</strong> ₱${product.price}</p>
      <button onclick="placeOrder(this)">Place Order</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function placeOrder(btn) {
  alert("✅ Order placed successfully!");
  btn.closest(".order-modal").remove();
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

window.addEventListener("DOMContentLoaded", () => {
  renderProducts(products);
});

