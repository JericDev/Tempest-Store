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

let currentCategory = "all";

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
      <div style="color:${product.stock ? 'green' : 'red'}; font-weight:bold;">
        ${product.stock ? 'On Stock' : 'Out of Stock'}
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
  const query = document.getElementById("searchBox").value.toLowerCase();

  const filtered = products.filter(product => {
    const matchesCategory = currentCategory === "all" || product.category === currentCategory;
    const matchesSearch = product.name.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  renderProducts(filtered);
}

window.addEventListener("DOMContentLoaded", () => {
  renderProducts(products);
});

