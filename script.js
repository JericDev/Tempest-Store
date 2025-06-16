import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA4xfUevmevaMDxK2_gLgvZUoqm0gmCn_k",
  authDomain: "store-7b9bd.firebaseapp.com",
  projectId: "store-7b9bd",
  storageBucket: "store-7b9bd.appspot.com",
  messagingSenderId: "1015427798898",
  appId: "1:1015427798898:web:a15c71636506fac128afeb",
  measurementId: "G-NR4JS3FLWG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

window.login = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  signInWithEmailAndPassword(auth, email, password)
    .then(() => alert("Logged in!"))
    .catch(err => alert("Login error: " + err.message));
};

window.register = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  createUserWithEmailAndPassword(auth, email, password)
    .then(() => alert("Registered!"))
    .catch(err => alert("Register error: " + err.message));
};

window.logout = function () {
  signOut(auth).then(() => alert("Logged out"));
};

const products = [
  { name: "Queen Bee", category: "pets", price: "₱100", new: true, stock: true, image: "queenbee.png" },
  { name: "Petal Bee", category: "pets", price: "₱10", new: true, stock: true, image: "Petalbee.webp" },
  { name: "Bear Bee", category: "pets", price: "₱10", new: true, stock: true, image: "Bearbeee1.webp" },
  { name: "Dragon Fly", category: "pets", price: "₱150", new: true, stock: true, image: "DragonflyIcon.webp" },
  { name: "1T Sheckle", category: "sheckles", price: "₱5", new: true, stock: true, image: "sheckles.png" },
  { name: "Raccoon", category: "pets", price: "₱250", new: true, stock: true, image: "Raccon_Better_Quality.webp" },
  { name: "Butterfly", category: "pets", price: "₱180", new: true, stock: true, image: "Thy_Butterfly_V2.webp" },
  { name: "Red Fox", category: "pets", price: "₱25", new: true, stock: true, image: "RedFox.webp" },
  { name: "Chicken Zombie", category: "pets", price: "₱25", new: true, stock: true, image: "Chicken_Zombie_Icon.webp" },
  { name: "Disco Bee", category: "pets", price: "₱200", new: true, stock: true, image: "DiscoBeeIcon.webp" },
  { name: "Chocolate Sprinkler", category: "gears", price: "₱25", new: true, stock: true, image: "ChocolateSprinkler.webp" },
  { name: "Master Sprinkler", category: "gears", price: "₱10", new: true, stock: true, image: "MasterSprinkler.webp" },
  { name: "Lightning Rod", category: "gears", price: "₱10", new: true, stock: true, image: "Lightning_Rod.webp" },
  { name: "Turtle", category: "pets", price: "₱10", new: true, stock: true, image: "Turtle_icon.webp" },
  { name: "Honey Sprinkler", category: "gears", price: "₱15", new: true, stock: true, image: "HoneySprinklerRender.webp" },
  { name: "Godly Sprinkler", category: "gears", price: "₱5", new: true, stock: true, image: "Godly_Sprinkler.webp" },
  { name: "Sprinkler Method", category: "gears", price: "₱15", new: true, stock: true, image: "sprinklermethod.png" },
  { name: "Polar Bear", category: "pets", price: "₱10", new: true, stock: true, image: "Polarbear.webp" },
];

let cart = [];
const productList = document.getElementById("product-list");
const cartList = document.getElementById("cart-list");

function renderProducts(items) {
  productList.innerHTML = "";
  items.forEach(product => {
    const card = document.createElement("div");
    card.className = "card";
    const imageName = product.image || product.name.toLowerCase().replace(/ /g, "") + ".png";
    card.innerHTML = `
      ${product.new ? `<span class="badge">NEW</span>` : ""}
      <img src="images/${imageName}" alt="${product.name}">
      <h4>${product.name}</h4>
      <div class="price">${product.price}</div>
      <button onclick="addToCart('${product.name}')">Add to Cart</button>
    `;
    productList.appendChild(card);
  });
}

window.addToCart = function (name) {
  const item = products.find(p => p.name === name);
  cart.push(item);
  updateCart();
};

function updateCart() {
  cartList.innerHTML = "";
  cart.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.name + " - " + item.price;
    cartList.appendChild(li);
  });
}

window.filterItems = function (category) {
  if (category === 'all') {
    renderProducts(products);
  } else {
    renderProducts(products.filter(p => p.category === category));
  }
};

window.searchItems = function () {
  const query = document.getElementById("searchBox").value.toLowerCase();
  const filtered = products.filter(p => p.name.toLowerCase().includes(query));
  renderProducts(filtered);
};

renderProducts(products);

