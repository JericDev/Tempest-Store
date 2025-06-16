import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { app } from './firebase-config.js';

const auth = getAuth(app);
let user = null;
let selectedProduct = null;
let cart = [];

const products = [
  { name: "Queen Bee", category: "pets", price: "₱100", image: "queenbee.png" },
  { name: "Petal Bee", category: "pets", price: "₱10", image: "Petalbee.webp" },
  { name: "Bear Bee", category: "pets", price: "₱10", image: "Bearbeee1.webp" },
  { name: "Dragon Fly", category: "pets", price: "₱150", image: "DragonflyIcon.webp" },
  { name: "1T Sheckle", category: "sheckles", price: "₱5", image: "sheckles.png" },
  { name: "Raccoon", category: "pets", price: "₱250", image: "Raccon_Better_Quality.webp" },
  { name: "Butterfly", category: "pets", price: "₱180", image: "Thy_Butterfly_V2.webp" },
  { name: "Red Fox", category: "pets", price: "₱25", image: "RedFox.webp" },
  { name: "Chicken Zombie", category: "pets", price: "₱25", image: "Chicken_Zombie_Icon.webp" },
  { name: "Disco Bee", category: "pets", price: "₱200", image: "DiscoBeeIcon.webp" },
  { name: "Chocolate Sprinkler", category: "gears", price: "₱25", image: "ChocolateSprinkler.webp" },
  { name: "Master Sprinkler", category: "gears", price: "₱10", image: "MasterSprinkler.webp" },
  { name: "Lightning Rod", category: "gears", price: "₱10", image: "Lightning_Rod.webp" },
  { name: "Turtle", category: "pets", price: "₱10", image: "Turtle_icon.webp" },
  { name: "Honey Sprinkler", category: "gears", price: "₱15", image: "HoneySprinklerRender.webp" },
  { name: "Godly Sprinkler", category: "gears", price: "₱5", image: "Godly_Sprinkler.webp" },
  { name: "Sprinkler Method", category: "gears", price: "₱15", image: "sprinklermethod.png" },
  { name: "Polar Bear", category: "pets", price: "₱10", image: "Polarbear.webp" }
];

function displayProducts(list = products) {
  const container = document.getElementById("product-list");
  container.innerHTML = "";
  list.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h4>${product.name}</h4>
      <p>${product.price}</p>
      <button onclick="showProductModal('${product.name}')">Add to Cart</button>
      <button onclick="buyNow('${product.name}')">Buy Now</button>
    `;
    container.appendChild(card);
  });
}

window.showProductModal = function(name) {
  selectedProduct = products.find(p => p.name === name);
  document.getElementById("modalTitle").textContent = selectedProduct.name;
  document.getElementById("modalPrice").textContent = selectedProduct.price;
  document.getElementById("modalQuantity").value = 1;
  document.getElementById("productModal").classList.remove("hidden");
};

window.confirmAddToCart = function() {
  const qty = parseInt(document.getElementById("modalQuantity").value);
  cart.push({ ...selectedProduct, quantity: qty });
  closeModal();
  alert("Added to cart!");
};

window.buyNow = function(name) {
  selectedProduct = products.find(p => p.name === name);
  showProductModal(name);
};

window.confirmBuyNow = function() {
  if (!user) return alert("You must be logged in to checkout!");
  const qty = parseInt(document.getElementById("modalQuantity").value);
  cart = [{ ...selectedProduct, quantity: qty }];
  closeModal();
  showCheckout();
};

function closeModal() {
  document.getElementById("productModal").classList.add("hidden");
}
window.closeModal = closeModal;

function showCheckout() {
  const checkout = document.getElementById("checkoutSummary");
  const items = document.getElementById("checkoutItems");
  const total = document.getElementById("checkoutTotal");

  items.innerHTML = "";
  let totalPrice = 0;
  cart.forEach(item => {
    const priceNum = parseFloat(item.price.replace(/[₱,]/g, ''));
    items.innerHTML += `<p>${item.name} x${item.quantity} = ₱${(priceNum * item.quantity).toFixed(2)}</p>`;
    totalPrice += priceNum * item.quantity;
  });

  total.textContent = `Total: ₱${totalPrice.toFixed(2)}`;
  checkout.classList.remove("hidden");
}
window.closeCheckout = () => document.getElementById("checkoutSummary").classList.add("hidden");

window.placeOrder = function() {
  alert("Order placed successfully!");
  cart = [];
  closeCheckout();
};

window.filterItems = function(category) {
  const filtered = category === 'all' ? products : products.filter(p => p.category === category);
  displayProducts(filtered);
};

window.searchItems = function() {
  const keyword = document.getElementById("searchBox").value.toLowerCase();
  const filtered = products.filter(p => p.name.toLowerCase().includes(keyword));
  displayProducts(filtered);
};

// Auth functions
window.showLogin = () => document.getElementById("loginModal").classList.remove("hidden");
window.showRegister = () => document.getElementById("registerModal").classList.remove("hidden");
window.closeLogin = () => document.getElementById("loginModal").classList.add("hidden");
window.closeRegister = () => document.getElementById("registerModal").classList.add("hidden");

window.login = function() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      alert("Login successful!");
      closeLogin();
    }).catch(e => alert(e.message));
};

window.register = function() {
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      alert("Registered successfully!");
      closeRegister();
    }).catch(e => alert(e.message));
};

window.logout = function() {
  signOut(auth).then(() => {
    alert("Logged out!");
  });
};

// Detect auth state
onAuthStateChanged(auth, u => {
  user = u;
  document.getElementById("userDisplay").textContent = user ? `Logged in as: ${user.email}` : "";
  document.getElementById("logoutBtn").classList.toggle("hidden", !user);
});

displayProducts();
