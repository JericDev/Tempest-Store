import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA4xfUevmevaMDxK2_gLgvZUoqm0gmCn_k",
  authDomain: "store-7b9bd.firebaseapp.com",
  projectId: "store-7b9bd",
  storageBucket: "store-7b9bd.appspot.com",
  messagingSenderId: "1015427798898",
  appId: "1:1015427798898:web:a15c71636506fac128afeb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let selectedProduct = null;
let cart = [];

const products = [
  { name: "Queen Bee", category: "pets", price: "₱100", image: "queenbee.png" },
  { name: "Petal Bee", category: "pets", price: "₱10", image: "Petalbee.webp" },
  { name: "Godly Sprinkler", category: "gears", price: "₱5", image: "Godly_Sprinkler.webp" },
  { name: "1T Sheckle", category: "sheckles", price: "₱5", image: "sheckles.png" },
  // Add more as needed...
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
      <button onclick="${auth.currentUser ? `showProductModal('${product.name}')` : `openAuthModal()`}">Add to Cart / Buy</button>
    `;
    container.appendChild(card);
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
  if (!auth.currentUser) {
    alert("Please log in to buy.");
    closeModal();
    openAuthModal();
    return;
  }
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
  if (!auth.currentUser) {
    alert("Please log in to place your order.");
    return;
  }
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

// Firebase Auth Functions
function openAuthModal() {
  document.getElementById("authModal").classList.remove("hidden");
}
function closeAuthModal() {
  document.getElementById("authModal").classList.add("hidden");
}
function login() {
  const email = document.getElementById("authEmail").value;
  const pass = document.getElementById("authPassword").value;
  signInWithEmailAndPassword(auth, email, pass)
    .then(() => {
      closeAuthModal();
      alert("Logged in!");
    })
    .catch(e => alert("Login failed: " + e.message));
}
function register() {
  const email = document.getElementById("authEmail").value;
  const pass = document.getElementById("authPassword").value;
  createUserWithEmailAndPassword(auth, email, pass)
    .then(() => {
      closeAuthModal();
      alert("Registered and logged in!");
    })
    .catch(e => alert("Register failed: " + e.message));
}
function logout() {
  signOut(auth);
}

// Auth state changes
onAuthStateChanged(auth, user => {
  document.getElementById("userEmail").textContent = user ? user.email : "";
  document.getElementById("logoutBtn").classList.toggle("hidden", !user);
  document.getElementById("loginBtn").classList.toggle("hidden", !!user);
  displayProducts();
});

window.onload = () => displayProducts();
