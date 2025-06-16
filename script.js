import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase config
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

// Login/Logout
document.getElementById("loginBtn").onclick = () => signInWithPopup(auth, provider);
document.getElementById("logoutBtn").onclick = () => signOut(auth);

// Auth state
onAuthStateChanged(auth, user => {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userDisplay = document.getElementById("userDisplay");

  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline";
    userDisplay.textContent = `Hello, ${user.displayName}`;
  } else {
    loginBtn.style.display = "inline";
    logoutBtn.style.display = "none";
    userDisplay.textContent = "";
  }
});

// Products
const products = [
  { name: "Queen Bee", category: "pets", price: 100, stock: 10, image: "queenbee.png", new: true },
  { name: "Godly Sprinkler", category: "gears", price: 50, stock: 5, image: "Godly_Sprinkler.webp", new: true },
  { name: "1T Sheckle", category: "sheckles", price: 5, stock: 999, image: "sheckles.png", new: false }
];

// Cart
let cart = JSON.parse(localStorage.getItem("cart")) || [];

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartUI();
}

function addToCart(product) {
  const found = cart.find(item => item.name === product.name);
  if (found) found.qty++;
  else cart.push({ ...product, qty: 1 });
  saveCart();
}

function updateCartUI() {
  const cartCount = document.getElementById("cartCount");
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  cartCount.textContent = cart.reduce((sum, i) => sum + i.qty, 0);
  cartItems.innerHTML = "";
  let total = 0;
  cart.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.name} x${item.qty} - ₱${item.price * item.qty}`;
    cartItems.appendChild(li);
    total += item.price * item.qty;
  });
  cartTotal.textContent = total;
}

function toggleCart() {
  const panel = document.getElementById("cartPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

// Product Filters
let currentCategory = "all";

function renderProducts(items) {
  const list = document.getElementById("product-list");
  list.innerHTML = "";

  items.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      ${p.new ? `<span class="badge">NEW</span>` : ""}
      <img src="images/${p.image}" alt="${p.name}" />
      <h4>${p.name}</h4>
      <div class="price">₱${p.price}</div>
      <button onclick='addToCart(${JSON.stringify(p)})'>Add to Cart</button>
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
  const filtered = products.filter(p => {
    const matchCat = currentCategory === "all" || p.category === currentCategory;
    const matchSearch = p.name.toLowerCase().includes(query);
    return matchCat && matchSearch;
  });
  renderProducts(filtered);
}

window.addEventListener("DOMContentLoaded", () => {
  renderProducts(products);
  updateCartUI();
});
