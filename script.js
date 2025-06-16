const products = [/* your product list */];
let selectedProduct = null;
let cart = [];

function displayProducts() {
  const list = document.getElementById("product-list");
  list.innerHTML = "";
  products.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h4>${product.name}</h4>
      <p>${product.price}</p>
      <button onclick="showProductModal('${product.name}')">Add to Cart / Buy</button>
    `;
    list.appendChild(card);
  });
}
function showProductModal(name) {
  selectedProduct = products.find(p => p.name === name);
  document.getElementById("modalTitle").textContent = selectedProduct.name;
  document.getElementById("modalPrice").textContent = selectedProduct.price;
  document.getElementById("modalQuantity").value = 1;
  document.getElementById("productModal").classList.remove("hidden");
}
function closeModal() {
  document.getElementById("productModal").classList.add("hidden");
}
function confirmAddToCart() {
  const quantity = parseInt(document.getElementById("modalQuantity").value);
  cart.push({ ...selectedProduct, quantity });
  closeModal();
  alert("Added to cart!");
}
function confirmBuyNow() {
  const quantity = parseInt(document.getElementById("modalQuantity").value);
  cart = [{ ...selectedProduct, quantity }];
  closeModal();
  showCheckout();
}
function showCheckout() {
  const checkout = document.getElementById("checkoutSummary");
  const items = document.getElementById("checkoutItems");
  const total = document.getElementById("checkoutTotal");

  items.innerHTML = "";
  let totalPrice = 0;
  cart.forEach(item => {
    const priceNum = parseFloat(item.price.replace(/[₱,]/g, ''));
    const line = document.createElement("p");
    line.textContent = `${item.name} x${item.quantity} = ₱${(priceNum * item.quantity).toFixed(2)}`;
    items.appendChild(line);
    totalPrice += priceNum * item.quantity;
  });

  total.textContent = `Total: ₱${totalPrice.toFixed(2)}`;
  checkout.classList.remove("hidden");
}
function closeCheckout() {
  document.getElementById("checkoutSummary").classList.add("hidden");
}
function placeOrder() {
  alert("Order placed successfully!");
  cart = [];
  closeCheckout();
}
function filterItems(category) {
  const filtered = category === 'all' ? products : products.filter(p => p.category === category);
  displayProducts(filtered);
}
function searchItems() {
  const keyword = document.getElementById("searchBox").value.toLowerCase();
  const filtered = products.filter(p => p.name.toLowerCase().includes(keyword));
  displayProducts(filtered);
}
window.onload = () => displayProducts(products);

