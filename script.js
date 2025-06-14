const products = [
  { name: "Queen Bee", price: "₱500.00", category: "pets", new: true, stock: false },
  { name: "Petal Bee", price: "₱30.00", category: "pets", new: true, stock: false },
  { name: "Bear Bee", price: "₱30.00", category: "pets", new: true, stock: true },
  { name: "Honey Bee", price: "₱13.00", category: "pets", new: true, stock: true },
  { name: "Basic Gear", price: "₱100.00", category: "gears", new: false, stock: true },
  { name: "Golden Gear", price: "₱300.00", category: "gears", new: true, stock: false },
  { name: "Sheckle Charm", price: "₱45.00", category: "sheckles", new: true, stock: true },
  { name: "Mystic Sheckle", price: "₱99.00", category: "sheckles", new: false, stock: false },
];

function displayProducts(filter = "all") {
  const list = document.getElementById("product-list");
  list.innerHTML = "";

  let filtered = products;

  if (filter !== "all") {
    filtered = products.filter(p => p.category === filter);
  }

  const search = document.getElementById("searchBox").value.toLowerCase();
  if (search) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
  }

  for (const p of filtered) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="placeholder.png" alt="${p.name}" />
      <h4>${p.name}</h4>
      <div class="price">${p.price}</div>
    `;

    if (p.new) {
      const newBadge = document.createElement("div");
      newBadge.className = "badge new";
      newBadge.textContent = "NEW";
      card.appendChild(newBadge);
    }

    if (!p.stock) {
      const stockBadge = document.createElement("div");
      stockBadge.className = "badge nostock";
      stockBadge.textContent = "NO STOCK";
      card.appendChild(stockBadge);
    }

    list.appendChild(card);
  }
}

function filterItems(category) {
  displayProducts(category);
}

function searchItems() {
  displayProducts(document.querySelector(".filters button.active")?.dataset.cat || "all");
}

displayProducts();
