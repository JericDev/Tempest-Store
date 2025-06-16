import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA4xfUevmevaMDxK2_gLgvZUoqm0gmCn_k",
  authDomain: "store-7b9bd.firebaseapp.com",
  projectId: "store-7b9bd",
  storageBucket: "store-7b9bd.firebasestorage.app",
  messagingSenderId: "1015427798898",
  appId: "1:1015427798898:web:a15c71636506fac128afeb",
  measurementId: "G-NR4JS3FLWG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let cart = JSON.parse(localStorage.getItem("cart")) || [];

const products = [/* same array as before */];

function renderProducts(items) {
  const list = document.getElementById("product-list");
  list.innerHTML = "";

  items.forEach(product => {
    const card = document.createElement("div");
    card.className = "card";
    if (!product.stock) card.classList.add("out-of-stock");

    card.innerHTML = `
      ${product.new ? `<span class="badge">NEW</span>` : ""}
      <img src="images/${product.image}" alt="${product.name}" />
      <h4>${product.name}</h4>
      <div class="price">${product.price}</div>
      <div style="color:${product.stock > 0 ? 'green' : 'red'}; font-weight:bold;">
        ${product.stock > 0 ? `Stock: ${product.stock}` : 'Out of Stock'}
      </div>
      <input type="number" min="1" value="1" class="qty" />
      <button onclick="addToCart('${product.name}')">Add to Cart</button>
      <button onclick="buyNow('${product.name}')">Buy Now</button>
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
  const query = document.getElementById("searchBox").value.toLowerCase();
  const filtered = products.filter(p =>
    (currentCategory === "all" || p.category === currentCategory) &&
    p.name.toLowerCase().includes(query)
  );
  renderProducts(filtered);
}

window.addToCart = function(name) {
  if (!currentUser) return alert("Login required.");
  const qty = parseInt(document.querySelector(`h4:contains('${name}') + .price + div + input`).value);
  const product = products.find(p => p.name === name);
  const existing = cart.find(p => p.name === name);
  if (existing) existing.qty += qty;
  else cart.push({ name, price: product.price, qty });
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartDisplay();
};

window.buyNow = function(name) {
  if (!currentUser) return alert("Login required.");
  const qty = parseInt(document.querySelector(`h4:contains('${name}') + .price + div + input`).value);
  const product = products.find(p => p.name === name);
  alert(`Purchased ${qty}x ${name} for ${product.price}`);
};

function updateCartDisplay() {
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById("cartCount").textContent = cartCount;
  const cartPanel = document.getElementById("cartPanel");
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  cartItems.innerHTML = "";
  let total = 0;
  cart.forEach(item => {
    cartItems.innerHTML += `<li>${item.qty}x ${item.name} - ${item.price}</li>`;
    total += parseFloat(item.price.replace("₱", "")) * item.qty;
  });
  cartTotal.textContent = total.toFixed(2);
  cartPanel.style.display = cart.length > 0 ? "block" : "none";
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  document.getElementById("userDisplay").textContent = user ? user.displayName : "";
  document.getElementById("loginBtn").style.display = user ? "none" : "inline-block";
  document.getElementById("logoutBtn").style.display = user ? "inline-block" : "none";
});

document.getElementById("loginBtn").onclick = () => signInWithPopup(auth, provider);
document.getElementById("logoutBtn").onclick = () => signOut(auth);

let currentCategory = "all";
window.addEventListener("DOMContentLoaded", () => {
  renderProducts(products);
  updateCartDisplay();
});

