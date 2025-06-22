import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, addDoc, getDocs, serverTimestamp, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- Firebase Initialization and Global Variables ---
// MANDATORY: Firebase config and app ID are provided globally by the Canvas environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

let app;
let db;
let auth;
let userId = null;
let userEmail = null; // Store user email for display
let isAdmin = false;
let sellerId = 'placeholder_seller_id'; // This will be the UID of the first authenticated user or a specific admin UID
let currentActiveConversationId = null;
let conversationsSnapshotUnsubscribe = null; // To unsubscribe from conversation listener
let messagesSnapshotUnsubscribe = null; // To unsubscribe from messages listener

// Function to safely get a unique ID for users not logged in (anonymous)
function getAnonymousUserId() {
    let anonId = sessionStorage.getItem('anonUserId');
    if (!anonId) {
        anonId = crypto.randomUUID();
        sessionStorage.setItem('anonUserId', anonId);
    }
    return anonId;
}

// --- Utility Functions for Modals ---
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function showAlert(message, type = 'alert') {
    const modal = document.getElementById('custom-alert-modal');
    document.getElementById('custom-alert-message').textContent = message;
    showModal('custom-alert-modal');
    return new Promise(resolve => {
        document.querySelector('#custom-alert-modal .custom-modal-ok-btn').onclick = () => {
            hideModal('custom-alert-modal');
            resolve(true);
        };
        document.querySelector('#custom-alert-modal .custom-modal-close-btn').onclick = () => {
            hideModal('custom-alert-modal');
            resolve(false);
        };
    });
}

function showConfirm(message) {
    const modal = document.getElementById('custom-confirm-modal');
    document.getElementById('custom-confirm-message').textContent = message;
    showModal('custom-confirm-modal');
    return new Promise(resolve => {
        document.querySelector('#custom-confirm-modal .custom-modal-confirm-btn').onclick = () => {
            hideModal('custom-confirm-modal');
            resolve(true);
        };
        document.querySelector('#custom-confirm-modal .custom-modal-cancel-btn').onclick = () => {
            hideModal('custom-confirm-modal');
            resolve(false);
        };
        document.querySelector('#custom-confirm-modal .custom-modal-close-btn').onclick = () => {
            hideModal('custom-confirm-modal');
            resolve(false);
        };
    });
}

// --- Product Data Management (Firestore) ---
const productsCollectionRef = (db) => collection(db, `artifacts/${appId}/public/products`);

async function saveProduct(product) {
    try {
        if (!product.id) {
            // Add new product
            const docRef = await addDoc(productsCollectionRef(db), product);
            product.id = docRef.id; // Assign the new ID
            // Update the document to include its own ID as a field
            await setDoc(doc(productsCollectionRef(db), docRef.id), { ...product, id: docRef.id });
        } else {
            // Update existing product
            await setDoc(doc(productsCollectionRef(db), product.id), product);
        }
        showAlert('Product saved successfully!');
        await loadProducts(); // Reload products to refresh list
        resetProductForm();
    } catch (error) {
        console.error("Error saving product:", error);
        showAlert('Error saving product: ' + error.message);
    }
}

async function deleteProduct(productId) {
    if (await showConfirm('Are you sure you want to delete this product?')) {
        try {
            await deleteDoc(doc(productsCollectionRef(db), productId));
            showAlert('Product deleted successfully!');
            await loadProducts(); // Reload products to refresh list
        } catch (error) {
            console.error("Error deleting product:", error);
            showAlert('Error deleting product: ' + error.message);
        }
    }
}

let allProducts = []; // Cache for all products
let currentFilter = 'all';

async function loadProducts() {
    try {
        const productsSnapshot = await getDocs(productsCollectionRef(db));
        allProducts = productsSnapshot.docs.map(doc => doc.data());
        renderProducts();
    } catch (error) {
        console.error("Error loading products:", error);
        showAlert('Error loading products: ' + error.message);
    }
}

function renderProducts() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';
    const now = new Date();

    const filteredProducts = allProducts.filter(product => {
        if (currentFilter === 'all') return true;
        return product.category === currentFilter;
    });

    if (filteredProducts.length === 0) {
        productList.innerHTML = '<p class="empty-message">No products found in this category.</p>';
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = `card ${product.stock === 0 ? 'out-of-stock' : ''}`;
        card.dataset.id = product.id; // Store product ID on the card

        let badgesHtml = '';
        if (product.isNew) {
            badgesHtml += `<span class="badge new">NEW</span>`;
        }
        if (product.isOnSale) {
            badgesHtml += `<span class="badge sale">SALE</span>`;
        }
        // Flash Sale logic
        let isFlashSaleActive = false;
        let flashSaleEndTime = null;
        if (product.isFlashSale && product.flashSaleEnd) {
            flashSaleEndTime = new Date(product.flashSaleEnd);
            if (flashSaleEndTime > now) {
                isFlashSaleActive = true;
                const timeRemaining = flashSaleEndTime.getTime() - now.getTime();
                const minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
                const hours = Math.floor((timeRemaining / (1000 * 60 * 60)) % 24);
                const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
                badgesHtml += `
                    <span class="badge flash-sale">
                        <span class="flash-sale-label">Flash Sale</span>
                        <span class="flash-sale-countdown">${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m</span>
                    </span>`;
            }
        }

        const formattedPrice = isFlashSaleActive && product.flashSalePrice ?
            `<span class="price flash-sale-active">$${product.flashSalePrice.toFixed(2)}</span><span class="original-price-strikethrough">$${product.price.toFixed(2)}</span>` :
            `<span class="price">$${product.price.toFixed(2)}</span>`;

        card.innerHTML = `
            ${badgesHtml}
            <img src="${product.imageUrl || 'https://placehold.co/180x180/e9ecef/495057?text=Product'}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            ${formattedPrice}
            <p class="stock-info ${product.stock === 0 ? 'out-of-stock-text' : 'in-stock'}">
                ${product.stock > 0 ? `In Stock: ${product.stock}` : 'Out of Stock'}
            </p>
            <button class="add-to-cart-btn" ${product.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
        `;
        productList.appendChild(card);
    });

    addAddToCartListeners(); // Re-add listeners for new buttons
}

function filterProducts(category) {
    currentFilter = category;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.filter-btn[data-category="${category}"]`).classList.add('active');
    renderProducts();
}

function searchProducts(query) {
    const productList = document.getElementById('product-list');
    productList.innerHTML = ''; // Clear current products

    const searchTerm = query.toLowerCase();
    const filteredProducts = allProducts.filter(product => {
        return product.name.toLowerCase().includes(searchTerm) ||
               product.description.toLowerCase().includes(searchTerm) ||
               product.category.toLowerCase().includes(searchTerm);
    });

    if (filteredProducts.length === 0) {
        productList.innerHTML = '<p class="empty-message">No products found matching your search.</p>';
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = `card ${product.stock === 0 ? 'out-of-stock' : ''}`;
        card.dataset.id = product.id; // Store product ID on the card

        let badgesHtml = '';
        const now = new Date();
        if (product.isNew) {
            badgesHtml += `<span class="badge new">NEW</span>`;
        }
        if (product.isOnSale) {
            badgesHtml += `<span class="badge sale">SALE</span>`;
        }
        let isFlashSaleActive = false;
        if (product.isFlashSale && product.flashSaleEnd) {
            const flashSaleEndTime = new Date(product.flashSaleEnd);
            if (flashSaleEndTime > now) {
                isFlashSaleActive = true;
                const timeRemaining = flashSaleEndTime.getTime() - now.getTime();
                const minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
                const hours = Math.floor((timeRemaining / (1000 * 60 * 60)) % 24);
                const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
                badgesHtml += `
                    <span class="badge flash-sale">
                        <span class="flash-sale-label">Flash Sale</span>
                        <span class="flash-sale-countdown">${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m</span>
                    </span>`;
            }
        }

        const formattedPrice = isFlashSaleActive && product.flashSalePrice ?
            `<span class="price flash-sale-active">$${product.flashSalePrice.toFixed(2)}</span><span class="original-price-strikethrough">$${product.price.toFixed(2)}</span>` :
            `<span class="price">$${product.price.toFixed(2)}</span>`;

        card.innerHTML = `
            ${badgesHtml}
            <img src="${product.imageUrl || 'https://placehold.co/180x180/e9ecef/495057?text=Product'}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            ${formattedPrice}
            <p class="stock-info ${product.stock === 0 ? 'out-of-stock-text' : 'in-stock'}">
                ${product.stock > 0 ? `In Stock: ${product.stock}` : 'Out of Stock'}
            </p>
            <button class="add-to-cart-btn" ${product.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
        `;
        productList.appendChild(card);
    });
    addAddToCartListeners();
}

// --- Cart Functionality ---
let cart = [];

function addAddToCartListeners() {
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.onclick = (event) => {
            const card = event.target.closest('.card');
            const productId = card.dataset.id;
            const product = allProducts.find(p => p.id === productId);

            if (product && product.stock > 0) {
                const existingItem = cart.find(item => item.id === productId);
                if (existingItem) {
                    if (existingItem.quantity < product.stock) {
                        existingItem.quantity++;
                    } else {
                        showAlert(`Maximum stock reached for ${product.name}.`);
                        return;
                    }
                } else {
                    cart.push({ ...product, quantity: 1 });
                }
                updateCartUI();
                showAlert(`${product.name} added to cart!`);
            } else if (product.stock === 0) {
                showAlert(`${product.name} is out of stock.`);
            }
        };
    });
}

function updateCartUI() {
    const cartItemsContainer = document.getElementById('cart-items');
    cartItemsContainer.innerHTML = '';
    let subtotal = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
        document.getElementById('place-order-btn').disabled = true;
    } else {
        document.getElementById('place-order-btn').disabled = false;
        cart.forEach(item => {
            const productInCatalog = allProducts.find(p => p.id === item.id);
            const isOutOfStock = productInCatalog ? item.quantity > productInCatalog.stock : true;
            const actualQuantity = productInCatalog ? Math.min(item.quantity, productInCatalog.stock) : item.quantity;

            // Determine effective price including flash sale if active
            const now = new Date();
            let effectivePrice = item.price;
            if (item.isFlashSale && item.flashSaleEnd) {
                const flashSaleEndTime = new Date(item.flashSaleEnd);
                if (flashSaleEndTime > now) {
                    effectivePrice = item.flashSalePrice;
                }
            }
            subtotal += effectivePrice * actualQuantity;

            const itemDiv = document.createElement('div');
            itemDiv.className = `cart-item ${isOutOfStock ? 'out-of-stock-cart-item' : ''}`;
            itemDiv.innerHTML = `
                <img src="${item.imageUrl || 'https://placehold.co/90x90/e9ecef/495057?text=Product'}" alt="${item.name}">
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p class="cart-item-price">$${effectivePrice.toFixed(2)}</p>
                    ${isOutOfStock && productInCatalog && productInCatalog.stock < item.quantity ?
                        `<p class="cart-item-out-of-stock-message">Only ${productInCatalog.stock} available. Quantity adjusted.</p>` : ''}
                    ${productInCatalog && productInCatalog.stock === 0 ?
                        `<p class="cart-item-out-of-stock-message">Item is out of stock.</p>` : ''}
                </div>
                <div class="cart-item-quantity-control">
                    <button data-id="${item.id}" data-action="decrease">-</button>
                    <input type="number" value="${actualQuantity}" min="1" max="${productInCatalog ? productInCatalog.stock : item.quantity}" data-id="${item.id}" class="cart-quantity-input">
                    <button data-id="${item.id}" data-action="increase">+</button>
                </div>
                <button class="cart-item-remove" data-id="${item.id}">&times;</button>
            `;
            cartItemsContainer.appendChild(itemDiv);
        });
    }

    const tax = subtotal * 0.10;
    const total = subtotal + tax;

    document.getElementById('cart-subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('cart-tax').textContent = tax.toFixed(2);
    document.getElementById('cart-total').textContent = total.toFixed(2);
    document.getElementById('cart-count-badge').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);

    addCartQuantityListeners();
    addCartRemoveListeners();
}

function addCartQuantityListeners() {
    document.querySelectorAll('.cart-item-quantity-control button').forEach(button => {
        button.onclick = (event) => {
            const productId = event.target.dataset.id;
            const action = event.target.dataset.action;
            const item = cart.find(i => i.id === productId);
            const productInCatalog = allProducts.find(p => p.id === productId);

            if (item && productInCatalog) {
                if (action === 'increase') {
                    if (item.quantity < productInCatalog.stock) {
                        item.quantity++;
                    } else {
                        showAlert(`Cannot add more. Max stock available is ${productInCatalog.stock}.`);
                    }
                } else if (action === 'decrease') {
                    if (item.quantity > 1) {
                        item.quantity--;
                    }
                }
                updateCartUI();
            }
        };
    });

    document.querySelectorAll('.cart-quantity-input').forEach(input => {
        input.onchange = (event) => {
            const productId = event.target.dataset.id;
            let newQuantity = parseInt(event.target.value);
            const item = cart.find(i => i.id === productId);
            const productInCatalog = allProducts.find(p => p.id === productId);

            if (item && productInCatalog) {
                if (isNaN(newQuantity) || newQuantity < 1) {
                    newQuantity = 1; // Default to 1 if invalid
                }
                if (newQuantity > productInCatalog.stock) {
                    newQuantity = productInCatalog.stock; // Limit to available stock
                    showAlert(`Cannot add more. Max stock available is ${productInCatalog.stock}.`);
                }
                item.quantity = newQuantity;
                updateCartUI();
            }
        };
    });
}

function addCartRemoveListeners() {
    document.querySelectorAll('.cart-item-remove').forEach(button => {
        button.onclick = (event) => {
            const productId = event.target.dataset.id;
            cart = cart.filter(item => item.id !== productId);
            updateCartUI();
            showAlert('Item removed from cart.');
        };
    });
}

async function placeOrder() {
    if (!auth.currentUser) {
        showAlert('Please log in or register to place an order.');
        return;
    }
    if (cart.length === 0) {
        showAlert('Your cart is empty.');
        return;
    }

    const robloxUsername = document.getElementById('roblox-username').value.trim();
    if (!robloxUsername) {
        showAlert('Please enter your Roblox Username.');
        return;
    }

    const confirmed = await showConfirm('Are you sure you want to place this order?');
    if (!confirmed) return;

    try {
        const orderItems = [];
        let totalAmount = 0;
        const productsToUpdate = [];

        for (const item of cart) {
            const productDoc = await getDoc(doc(productsCollectionRef(db), item.id));
            if (!productDoc.exists()) {
                showAlert(`Product ${item.name} no longer exists.`);
                return;
            }
            const productData = productDoc.data();

            const now = new Date();
            let effectivePrice = productData.price;
            if (productData.isFlashSale && productData.flashSaleEnd) {
                const flashSaleEndTime = new Date(productData.flashSaleEnd);
                if (flashSaleEndTime > now) {
                    effectivePrice = productData.flashSalePrice;
                }
            }

            // Verify stock
            if (productData.stock < item.quantity) {
                showAlert(`Not enough stock for ${item.name}. Available: ${productData.stock}`);
                return;
            }

            orderItems.push({
                productId: item.id,
                name: item.name,
                quantity: item.quantity,
                price: effectivePrice,
                imageUrl: item.imageUrl || 'https://placehold.co/90x90/e9ecef/495057?text=Product'
            });
            totalAmount += effectivePrice * item.quantity;
            productsToUpdate.push({ id: item.id, newStock: productData.stock - item.quantity });
        }

        const tax = totalAmount * 0.10;
        const finalTotal = totalAmount + tax;
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;

        const ordersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/orders`);
        const orderDocRef = await addDoc(ordersCollectionRef, {
            userId: userId,
            robloxUsername: robloxUsername,
            items: orderItems,
            subtotal: totalAmount,
            tax: tax,
            total: finalTotal,
            paymentMethod: paymentMethod,
            status: 'pending',
            orderDate: serverTimestamp()
        });

        // Update product stocks
        for (const productUpdate of productsToUpdate) {
            await updateDoc(doc(productsCollectionRef(db), productUpdate.id), {
                stock: productUpdate.newStock
            });
        }

        showAlert('Order placed successfully!');
        cart = []; // Clear cart
        updateCartUI(); // Refresh cart UI
        hideModal('cart-modal');
        await loadProducts(); // Reload products to update stock display

        // Send an automatic chat message with order details to the seller
        await sendOrderDetailsToSeller(orderDocRef.id, auth.currentUser.email);

    } catch (error) {
        console.error("Error placing order:", error);
        showAlert('Error placing order: ' + error.message);
    }
}

// --- Order History Functionality (Firestore) ---
async function loadOrderHistory() {
    if (!userId) {
        document.getElementById('order-history-list').innerHTML = '<p class="empty-message">Please log in to view your orders.</p>';
        return;
    }
    document.getElementById('order-history-list').innerHTML = '<p class="empty-message">Loading orders...</p>';
    document.getElementById('order-history-title').textContent = 'My Orders';
    document.getElementById('order-history-list').style.display = 'block';
    document.getElementById('order-details-view').style.display = 'none';

    try {
        const ordersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/orders`);
        // Note: orderBy is commented out due to potential Firestore index issues in some environments.
        // If sorting is critical, you can fetch all and sort in JS, or ensure indexes are set up in Firebase.
        const q = query(ordersCollectionRef); // , orderBy('orderDate', 'desc'));
        const querySnapshot = await getDocs(q);

        const ordersList = document.getElementById('order-history-list');
        ordersList.innerHTML = '';

        if (querySnapshot.empty) {
            ordersList.innerHTML = '<p class="empty-message">You have no orders yet.</p>';
            return;
        }

        querySnapshot.forEach(doc => {
            const order = doc.data();
            const orderId = doc.id;
            const orderDate = order.orderDate ? new Date(order.orderDate.seconds * 1000).toLocaleDateString() : 'N/A';

            const orderItemDiv = document.createElement('div');
            orderItemDiv.className = 'order-item';
            orderItemDiv.innerHTML = `
                <div class="order-item-info">
                    <strong>Order ID: ${orderId}</strong>
                    <span>Date: ${orderDate}</span>
                    <span>Total: $${order.total.toFixed(2)}</span>
                    <span class="order-item-status status-${order.status}">${order.status.replace('-', ' ')}</span>
                </div>
                <button class="view-details-btn" data-order-id="${orderId}">View Details</button>
            `;
            ordersList.appendChild(orderItemDiv);
        });

        document.querySelectorAll('.view-details-btn').forEach(button => {
            button.onclick = (e) => showOrderDetails(e.target.dataset.orderId);
        });

    } catch (error) {
        console.error("Error loading order history:", error);
        showAlert('Error loading order history: ' + error.message);
    }
}

async function showOrderDetails(orderId) {
    document.getElementById('order-history-list').style.display = 'none';
    document.getElementById('order-details-view').style.display = 'block';

    try {
        const orderDocRef = doc(db, `artifacts/${appId}/users/${userId}/orders`, orderId);
        const orderDoc = await getDoc(orderDocRef);

        if (orderDoc.exists()) {
            const order = orderDoc.data();
            document.getElementById('order-details-id').textContent = orderId;
            document.getElementById('order-details-date').textContent = order.orderDate ? new Date(order.orderDate.seconds * 1000).toLocaleDateString() : 'N/A';
            document.getElementById('order-details-total').textContent = order.total.toFixed(2);
            document.getElementById('order-details-status').textContent = order.status.replace('-', ' ');
            document.getElementById('order-details-payment').textContent = order.paymentMethod;
            document.getElementById('order-details-roblox-username').textContent = order.robloxUsername;

            const itemsContainer = document.getElementById('order-details-items');
            itemsContainer.innerHTML = '';
            order.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'order-detail-item';
                itemDiv.innerHTML = `
                    <span class="order-detail-item-name">${item.name}</span>
                    <span class="order-detail-item-qty-price">${item.quantity} x $${item.price.toFixed(2)}</span>
                `;
                itemsContainer.appendChild(itemDiv);
            });
        } else {
            showAlert('Order not found.');
            document.getElementById('back-to-orders-btn').click(); // Go back to list
        }
    } catch (error) {
        console.error("Error fetching order details:", error);
        showAlert('Error fetching order details: ' + error.message);
    }
}

// --- Admin Panel Functionality ---
function setupAdminPanel() {
    document.getElementById('admin-product-new-badge').checked = false;
    document.getElementById('admin-product-sale-badge').checked = false;
    document.getElementById('admin-product-flash-sale-badge').checked = false;
    document.getElementById('admin-product-flash-sale-badge').onchange = (event) => {
        document.querySelector('.flash-sale-details').style.display = event.target.checked ? 'block' : 'none';
    };
    document.getElementById('save-product-btn').onclick = async () => {
        const productId = document.getElementById('product-id').value;
        const productName = document.getElementById('product-name').value;
        const productDescription = document.getElementById('product-description').value;
        const productPrice = parseFloat(document.getElementById('product-price').value);
        const productStock = parseInt(document.getElementById('product-stock').value);
        const productCategory = document.getElementById('product-category').value;
        const isNew = document.getElementById('product-new-badge').checked;
        const isOnSale = document.getElementById('product-sale-badge').checked;
        const isFlashSale = document.getElementById('product-flash-sale-badge').checked;
        const flashSaleEnd = document.getElementById('flash-sale-end-time').value;

        if (!productName || isNaN(productPrice) || isNaN(productStock)) {
            showAlert('Please fill in all product fields correctly.');
            return;
        }

        const productData = {
            name: productName,
            description: productDescription,
            price: productPrice,
            stock: productStock,
            category: productCategory,
            isNew: isNew,
            isOnSale: isOnSale,
            isFlashSale: isFlashSale,
            flashSaleEnd: isFlashSale ? flashSaleEnd : null,
            flashSalePrice: isFlashSale ? (productPrice * 0.8).toFixed(2) : null, // Example: 20% off for flash sale
            imageUrl: `https://placehold.co/180x180/${Math.floor(Math.random()*16777215).toString(16)}/ffffff?text=${encodeURIComponent(productName.substring(0,2))}` // Random placeholder image
        };

        if (productId) productData.id = productId; // Keep ID if editing

        await saveProduct(productData);
    };

    document.getElementById('cancel-edit-product').onclick = resetProductForm;
    loadAdminProducts();
    loadAdminOrders();
    loadSellerStatusToggle();
}

function resetProductForm() {
    document.getElementById('product-id').value = '';
    document.getElementById('product-name').value = '';
    document.getElementById('product-description').value = '';
    document.getElementById('product-price').value = '0.00';
    document.getElementById('product-stock').value = '0';
    document.getElementById('product-category').value = 'consoles';
    document.getElementById('product-new-badge').checked = false;
    document.getElementById('product-sale-badge').checked = false;
    document.getElementById('product-flash-sale-badge').checked = false;
    document.querySelector('.flash-sale-details').style.display = 'none';
    document.getElementById('flash-sale-end-time').value = '';
    document.getElementById('save-product-btn').textContent = 'Save Product';
    document.getElementById('cancel-edit-product').style.display = 'none';
}

async function loadAdminProducts() {
    const productListBody = document.getElementById('admin-product-list');
    productListBody.innerHTML = '<tr><td colspan="7">Loading products...</td></tr>';
    try {
        const productsSnapshot = await getDocs(productsCollectionRef(db));
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        productListBody.innerHTML = '';

        if (products.length === 0) {
            productListBody.innerHTML = '<tr><td colspan="7" class="empty-message">No products added yet.</td></tr>';
            return;
        }

        products.forEach(product => {
            const row = productListBody.insertRow();
            const now = new Date();
            let displayPrice = `$${product.price.toFixed(2)}`;
            if (product.isFlashSale && product.flashSaleEnd) {
                const flashSaleEndTime = new Date(product.flashSaleEnd);
                if (flashSaleEndTime > now) {
                    displayPrice = `<span style="color:red;">$${product.flashSalePrice.toFixed(2)}</span> (was $${product.price.toFixed(2)})`;
                }
            }
            row.innerHTML = `
                <td><img src="${product.imageUrl}" alt="${product.name}" width="50"></td>
                <td>${product.name}</td>
                <td>${displayPrice}</td>
                <td>${product.stock}</td>
                <td>${product.category}</td>
                <td>
                    ${product.isNew ? '<span class="badge new" style="position:relative;top:auto;left:auto;margin-right:5px;padding:3px 6px;">NEW</span>' : ''}
                    ${product.isOnSale ? '<span class="badge sale" style="position:relative;top:auto;left:auto;padding:3px 6px;">SALE</span>' : ''}
                    ${product.isFlashSale && new Date(product.flashSaleEnd) > now ? '<span class="badge flash-sale" style="position:relative;top:auto;left:auto;padding:3px 6px;">FLASH</span>' : ''}
                </td>
                <td class="admin-product-actions">
                    <button class="edit" data-id="${product.id}">Edit</button>
                    <button class="delete" data-id="${product.id}">Delete</button>
                </td>
            `;
        });

        document.querySelectorAll('#admin-product-list .edit').forEach(button => {
            button.onclick = (e) => editProduct(e.target.dataset.id);
        });
        document.querySelectorAll('#admin-product-list .delete').forEach(button => {
            button.onclick = (e) => deleteProduct(e.target.dataset.id);
        });

    } catch (error) {
        console.error("Error loading admin products:", error);
        showAlert('Error loading admin products: ' + error.message);
    }
}

async function editProduct(productId) {
    try {
        const productDoc = await getDoc(doc(productsCollectionRef(db), productId));
        if (productDoc.exists()) {
            const product = productDoc.data();
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-description').value = product.description;
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-stock').value = product.stock;
            document.getElementById('product-category').value = product.category;
            document.getElementById('product-new-badge').checked = product.isNew || false;
            document.getElementById('product-sale-badge').checked = product.isOnSale || false;
            document.getElementById('product-flash-sale-badge').checked = product.isFlashSale || false;
            if (product.isFlashSale) {
                document.querySelector('.flash-sale-details').style.display = 'block';
                document.getElementById('flash-sale-end-time').value = product.flashSaleEnd ? new Date(product.flashSaleEnd).toISOString().slice(0, 16) : '';
            } else {
                document.querySelector('.flash-sale-details').style.display = 'none';
            }

            document.getElementById('save-product-btn').textContent = 'Update Product';
            document.getElementById('cancel-edit-product').style.display = 'inline-block';
        } else {
            showAlert('Product not found for editing.');
        }
    } catch (error) {
        console.error("Error editing product:", error);
        showAlert('Error loading product for edit: ' + error.message);
    }
}

async function loadAdminOrders() {
    const orderListBody = document.getElementById('admin-order-list');
    orderListBody.innerHTML = '<tr><td colspan="5">Loading orders...</td></tr>';
    document.getElementById('admin-order-list').style.display = 'table-row-group';
    document.getElementById('admin-order-details-view').style.display = 'none';

    try {
        const usersCollectionRef = collection(db, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        const allOrders = [];

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const ordersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/orders`);
            const ordersSnapshot = await getDocs(ordersCollectionRef);
            ordersSnapshot.forEach(doc => {
                allOrders.push({ id: doc.id, ...doc.data() });
            });
        }

        // Sort orders by date descending
        allOrders.sort((a, b) => (b.orderDate?.seconds || 0) - (a.orderDate?.seconds || 0));

        orderListBody.innerHTML = '';
        if (allOrders.length === 0) {
            orderListBody.innerHTML = '<tr><td colspan="5" class="empty-message">No orders placed yet.</td></tr>';
            return;
        }

        allOrders.forEach(order => {
            const row = orderListBody.insertRow();
            const orderDate = order.orderDate ? new Date(order.orderDate.seconds * 1000).toLocaleDateString() : 'N/A';
            row.innerHTML = `
                <td>${order.id}</td>
                <td>${order.userId}</td>
                <td>$${order.total.toFixed(2)}</td>
                <td><span class="order-item-status status-${order.status}">${order.status.replace('-', ' ')}</span></td>
                <td class="admin-order-actions">
                    <button class="view" data-order-id="${order.id}">View</button>
                </td>
            `;
        });

        document.querySelectorAll('#admin-order-list .view').forEach(button => {
            button.onclick = (e) => showAdminOrderDetails(e.target.dataset.orderId);
        });

    } catch (error) {
        console.error("Error loading admin orders:", error);
        showAlert('Error loading admin orders: ' + error.message);
    }
}

async function showAdminOrderDetails(orderId) {
    document.getElementById('admin-order-list').style.display = 'none';
    document.getElementById('admin-order-details-view').style.display = 'block';

    try {
        // Find the user ID associated with this order
        const usersCollectionRef = collection(db, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        let orderData = null;
        let customerId = null;

        for (const userDoc of usersSnapshot.docs) {
            const currentUserId = userDoc.id;
            const orderDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/orders`, orderId);
            const orderDoc = await getDoc(orderDocRef);
            if (orderDoc.exists()) {
                orderData = orderDoc.data();
                customerId = currentUserId;
                break;
            }
        }

        if (orderData) {
            document.getElementById('admin-order-details-id').textContent = orderId;
            document.getElementById('admin-order-customer-id').textContent = customerId;
            document.getElementById('admin-order-roblox-username').textContent = orderData.robloxUsername || 'N/A';
            document.getElementById('admin-order-details-date').textContent = orderData.orderDate ? new Date(orderData.orderDate.seconds * 1000).toLocaleDateString() : 'N/A';
            document.getElementById('admin-order-details-total').textContent = orderData.total.toFixed(2);
            document.getElementById('admin-order-details-payment').textContent = orderData.paymentMethod;
            document.getElementById('admin-order-status-select').value = orderData.status;

            const itemsContainer = document.getElementById('admin-order-details-items');
            itemsContainer.innerHTML = '';
            orderData.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'admin-order-detail-item';
                itemDiv.innerHTML = `
                    <span class="admin-order-detail-item-name">${item.name}</span>
                    <span class="admin-order-detail-item-qty-price">${item.quantity} x $${item.price.toFixed(2)}</span>
                `;
                itemsContainer.appendChild(itemDiv);
            });

            document.getElementById('update-order-status-btn').onclick = async () => {
                const newStatus = document.getElementById('admin-order-status-select').value;
                await updateOrderStatus(customerId, orderId, newStatus);
            };

        } else {
            showAlert('Order details not found.');
            document.getElementById('admin-back-to-orders-btn').click(); // Go back to list
        }
    } catch (error) {
        console.error("Error fetching admin order details:", error);
        showAlert('Error fetching admin order details: ' + error.message);
    }
}

async function updateOrderStatus(customerId, orderId, newStatus) {
    try {
        const orderDocRef = doc(db, `artifacts/${appId}/users/${customerId}/orders`, orderId);
        await updateDoc(orderDocRef, {
            status: newStatus
        });
        showAlert('Order status updated successfully!');
        await loadAdminOrders(); // Refresh admin orders list
        document.getElementById('admin-order-details-view').style.display = 'none';
        document.getElementById('admin-order-list').style.display = 'table-row-group';
    } catch (error) {
        console.error("Error updating order status:", error);
        showAlert('Error updating order status: ' + error.message);
    }
}

// --- Site Settings (Seller Status) ---
const siteSettingsDocRef = (db) => doc(db, `artifacts/${appId}/public/settings/site`);

async function loadSellerStatusToggle() {
    try {
        const docSnap = await getDoc(siteSettingsDocRef(db));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const isOnline = data.sellerOnlineStatus === true;
            document.getElementById('seller-online-toggle').checked = isOnline;
            document.getElementById('seller-status-text').textContent = isOnline ? 'Online' : 'Offline';
            document.getElementById('seller-status-display').textContent = isOnline ? 'Online' : 'Offline';
            document.getElementById('seller-status-display').className = isOnline ? 'status-online' : 'status-offline';
        } else {
            // If no setting exists, default to online and create it
            await setDoc(siteSettingsDocRef(db), { sellerOnlineStatus: true });
            document.getElementById('seller-online-toggle').checked = true;
            document.getElementById('seller-status-text').textContent = 'Online';
            document.getElementById('seller-status-display').textContent = 'Online';
            document.getElementById('seller-status-display').className = 'status-online';
        }
    } catch (error) {
        console.error("Error loading seller status:", error);
    }
}

async function updateSellerStatus(isOnline) {
    try {
        await setDoc(siteSettingsDocRef(db), { sellerOnlineStatus: isOnline }, { merge: true });
        document.getElementById('seller-status-text').textContent = isOnline ? 'Online' : 'Offline';
        document.getElementById('seller-status-display').textContent = isOnline ? 'Online' : 'Offline';
        document.getElementById('seller-status-display').className = isOnline ? 'status-online' : 'status-offline';
        console.log("Seller status updated to:", isOnline);
    } catch (error) {
        console.error("Error updating seller status:", error);
        showAlert('Error updating seller status: ' + error.message);
    }
}

// --- Chat System Functions ---
const chatsCollectionRef = (db) => collection(db, `artifacts/${appId}/public/chats`);

async function createOrGetConversation(participant1Id, participant2Id) {
    // Ensure consistent sorting of participant IDs to find existing conversation
    const participants = [participant1Id, participant2Id].sort();
    const q = query(chatsCollectionRef(db), where('participants', 'array-contains-any', participants));

    const querySnapshot = await getDocs(q);

    let conversationDoc = null;
    querySnapshot.forEach(doc => {
        const data = doc.data();
        const docParticipants = data.participants.sort();
        // Check if both arrays contain the same participants (order doesn't matter after sort)
        if (docParticipants.length === participants.length && docParticipants.every((value, index) => value === participants[index])) {
            conversationDoc = doc;
        }
    });

    if (conversationDoc) {
        return conversationDoc.id; // Return existing conversation ID
    } else {
        // Create new conversation
        const newConversationRef = await addDoc(chatsCollectionRef(db), {
            participants: participants,
            lastMessage: { text: 'Conversation started.', senderId: 'system', timestamp: serverTimestamp() },
            lastMessageTimestamp: serverTimestamp(),
            unreadCounts: {
                [participant1Id]: 0,
                [participant2Id]: 0
            }
        });
        return newConversationRef.id;
    }
}

async function sendMessage(conversationId, messageText, messageType = 'text', orderDetails = null) {
    if (!auth.currentUser || !conversationId || !messageText.trim()) {
        document.getElementById('chat-message').textContent = 'Cannot send empty message or not logged in.';
        return;
    }

    const messagesCollectionRef = collection(db, `artifacts/${appId}/public/chats/${conversationId}/messages`);
    const chatDocRef = doc(chatsCollectionRef(db), conversationId);

    try {
        const message = {
            senderId: userId,
            receiverId: currentActiveConversationId === sellerId ? userId : sellerId, // This might need refinement based on actual chat design
            text: messageText,
            timestamp: serverTimestamp(),
            type: messageType
        };
        if (orderDetails) {
            message.orderDetails = orderDetails;
        }

        await addDoc(messagesCollectionRef, message);

        // Update last message and unread counts in conversation document
        const chatDoc = await getDoc(chatDocRef);
        if (chatDoc.exists()) {
            const data = chatDoc.data();
            const updatedUnreadCounts = { ...data.unreadCounts };
            data.participants.forEach(pId => {
                if (pId !== userId) { // Increment unread count for the other participant
                    updatedUnreadCounts[pId] = (updatedUnreadCounts[pId] || 0) + 1;
                }
            });

            await updateDoc(chatDocRef, {
                lastMessage: { text: messageText, senderId: userId, timestamp: serverTimestamp() },
                lastMessageTimestamp: serverTimestamp(),
                unreadCounts: updatedUnreadCounts
            });
        }
        document.getElementById('chat-message-input').value = ''; // Clear input
        document.getElementById('chat-message').textContent = ''; // Clear status message

    } catch (error) {
        console.error("Error sending message:", error);
        document.getElementById('chat-message').textContent = 'Error sending message: ' + error.message;
    }
}

async function loadConversations() {
    if (!userId) return; // Cannot load conversations if not authenticated

    const chatListElement = document.getElementById('chat-conversations-list');
    chatListElement.innerHTML = '<p class="empty-message" style="margin: 20px;">Loading conversations...</p>';

    // Unsubscribe from previous listener if exists
    if (conversationsSnapshotUnsubscribe) {
        conversationsSnapshotUnsubscribe();
    }

    const q = query(chatsCollectionRef(db), where('participants', 'array-contains', userId));

    conversationsSnapshotUnsubscribe = onSnapshot(q, async (snapshot) => {
        chatListElement.innerHTML = '';
        let totalUnread = 0;
        if (snapshot.empty) {
            chatListElement.innerHTML = '<p class="empty-message" style="margin: 20px;">No conversations yet.</p>';
            document.getElementById('unread-messages-badge').style.display = 'none';
            return;
        }

        const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort by last message timestamp (most recent first)
        conversations.sort((a, b) => (b.lastMessageTimestamp?.seconds || 0) - (a.lastMessageTimestamp?.seconds || 0));

        for (const convo of conversations) {
            const otherParticipantId = convo.participants.find(pId => pId !== userId);
            let contactName = 'Unknown User';
            let contactEmail = '';
            let avatarUrl = 'https://placehold.co/45x45/cccccc/333333?text=?';

            // Get user data for other participant
            if (otherParticipantId === sellerId) { // If chatting with the seller/admin
                contactName = 'Seller';
                contactEmail = 'Seller'; // Or a designated seller email if available
                avatarUrl = 'https://placehold.co/45x45/FFA500/FFFFFF?text=SHOP'; // Generic shop icon
            } else { // If chatting with a buyer (from seller's perspective)
                // Try to get user email from Firebase Auth if possible, or display User ID
                // For this mock-up, we'll assume a way to resolve userId to email/name
                // In a real app, you'd store display names or derive from user profiles
                const userDocRef = doc(db, `artifacts/${appId}/users/${otherParticipantId}/profile`);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    contactEmail = userDocSnap.data().email || otherParticipantId;
                    contactName = userDocSnap.data().displayName || contactEmail.split('@')[0]; // Use display name or email username
                    avatarUrl = userDocSnap.data().avatarUrl || 'https://placehold.co/45x45/cccccc/333333?text=?';
                } else {
                    contactName = otherParticipantId; // Fallback to UID
                    contactEmail = otherParticipantId;
                }
            }


            const lastMessageText = convo.lastMessage?.text || '';
            const unreadCount = convo.unreadCounts?.[userId] || 0;
            totalUnread += unreadCount;

            const conversationItem = document.createElement('li');
            conversationItem.className = `chat-conversation-item ${currentActiveConversationId === convo.id ? 'active-chat' : ''}`;
            conversationItem.dataset.conversationId = convo.id;
            conversationItem.dataset.contactName = contactName;
            conversationItem.dataset.contactEmail = contactEmail;
            conversationItem.dataset.contactId = otherParticipantId; // Store contact ID for message sending

            conversationItem.innerHTML = `
                <img src="${avatarUrl}" alt="${contactName} Avatar">
                <div class="chat-info">
                    <span class="chat-contact-name-list">${contactName}</span>
                    <span class="chat-last-message">${lastMessageText}</span>
                </div>
                ${unreadCount > 0 ? `<span class="chat-unread-badge">${unreadCount}</span>` : ''}
            `;
            chatListElement.appendChild(conversationItem);

            conversationItem.onclick = () => openConversation(convo.id, contactName, contactEmail, otherParticipantId);
        }

        if (totalUnread > 0) {
            document.getElementById('unread-messages-badge').textContent = totalUnread;
            document.getElementById('unread-messages-badge').style.display = 'block';
        } else {
            document.getElementById('unread-messages-badge').style.display = 'none';
        }
    }, (error) => {
        console.error("Error loading conversations:", error);
        chatListElement.innerHTML = '<p class="empty-message" style="margin: 20px; color: red;">Failed to load conversations.</p>';
    });
}

function displaySellerStatusInChat(status) {
    const chatSellerStatusSpan = document.getElementById('chat-seller-status');
    if (status === 'Online') {
        chatSellerStatusSpan.textContent = 'Online';
        chatSellerStatusSpan.className = 'chat-seller-status online';
    } else {
        chatSellerStatusSpan.textContent = 'Offline';
        chatSellerStatusSpan.className = 'chat-seller-status offline';
    }
}

// Listener for real-time seller status in chat header
let sellerStatusUnsubscribe = null;
async function listenToSellerStatus() {
    // Unsubscribe from previous listener if exists
    if (sellerStatusUnsubscribe) {
        sellerStatusUnsubscribe();
    }
    sellerStatusUnsubscribe = onSnapshot(siteSettingsDocRef(db), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const isOnline = data.sellerOnlineStatus === true;
            displaySellerStatusInChat(isOnline ? 'Online' : 'Offline');
        } else {
            displaySellerStatusInChat('Offline'); // Default if doc doesn't exist
        }
    }, (error) => {
        console.error("Error listening to seller status:", error);
        displaySellerStatusInChat('Error');
    });
}


async function openConversation(conversationId, contactName, contactEmail, contactId) {
    currentActiveConversationId = conversationId;
    document.getElementById('chat-contact-name').textContent = contactName;
    document.getElementById('chat-contact-avatar').src = `https://placehold.co/40x40/cccccc/333333?text=${encodeURIComponent(contactName.charAt(0))}`; // Simple avatar placeholder
    document.getElementById('chat-contact-avatar').alt = contactName;

    // Show/hide buttons based on user role and contact
    const sendProductBtn = document.getElementById('send-product-btn');
    const visitStoreBtn = document.getElementById('visit-store-btn');
    if (isAdmin && contactId !== sellerId) { // If admin chatting with a buyer
        sendProductBtn.style.display = 'inline-flex';
        visitStoreBtn.style.display = 'inline-flex';
    } else {
        sendProductBtn.style.display = 'none';
        visitStoreBtn.style.display = 'none';
    }

    // Handle mobile view: hide list, show conversation
    if (window.innerWidth <= 480) {
        document.getElementById('chat-list-sidebar').style.display = 'none';
        document.getElementById('chat-conversation-view').style.display = 'flex';
        document.querySelector('.back-to-chats-btn').style.display = 'block'; // Show back button
    }


    const messagesContainer = document.getElementById('chat-messages-container');
    messagesContainer.innerHTML = '<p class="empty-message" style="margin: 20px;">Loading messages...</p>';

    // Unsubscribe from previous messages listener if exists
    if (messagesSnapshotUnsubscribe) {
        messagesSnapshotUnsubscribe();
    }

    const messagesQuery = query(collection(db, `artifacts/${appId}/public/chats/${conversationId}/messages`)); // Order by timestamp?
    messagesSnapshotUnsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
        messagesContainer.innerHTML = '';
        if (snapshot.empty) {
            messagesContainer.innerHTML = '<p class="empty-message" style="margin: 20px;">Say hello!</p>';
            return;
        }

        snapshot.docs.forEach(doc => {
            const msg = doc.data();
            const messageElement = document.createElement('div');
            messageElement.className = `message-bubble ${msg.senderId === userId ? 'sent' : 'received'}`;

            if (msg.type === 'order' && msg.orderDetails) {
                messageElement.className = 'order-message-bubble'; // Special styling for order messages
                const orderId = msg.orderDetails.orderId;
                messageElement.innerHTML = `
                    <h4>Order Details</h4>
                    <p>Order ID: <span class="order-id">${orderId}</span></p>
                    <p>Items: ${msg.orderDetails.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</p>
                    <p>Total: $${msg.orderDetails.total.toFixed(2)}</p>
                    <p>Status: <span class="order-status status-${msg.orderDetails.status}">${msg.orderDetails.status.replace('-', ' ')}</span></p>
                    <button class="view-order-details-btn" data-order-id="${orderId}">View</button>
                    ${msg.text ? `<p class="order-message-text">${msg.text}</p>` : ''}
                `;
                const viewButton = messageElement.querySelector('.view-order-details-btn');
                if (viewButton) {
                    viewButton.onclick = () => {
                        hideModal('chat-modal');
                        showModal('order-history-modal');
                        showOrderDetails(orderId); // Use existing order details function
                    };
                }
            } else {
                // Regular text message
                messageElement.textContent = msg.text;
                // Add timestamp if needed. Format example:
                const timestamp = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                if (timestamp) {
                    const timestampSpan = document.createElement('span');
                    timestampSpan.className = 'message-timestamp';
                    timestampSpan.textContent = timestamp;
                    messageElement.appendChild(timestampSpan);
                }
            }
            messagesContainer.appendChild(messageElement);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom

        // Mark messages as read for the current user in this conversation
        await updateDoc(doc(chatsCollectionRef(db), conversationId), {
            [`unreadCounts.${userId}`]: 0 // Set unread count for current user to 0
        });
        await loadConversations(); // Reload sidebar to update unread badge
    }, (error) => {
        console.error("Error loading messages:", error);
        messagesContainer.innerHTML = '<p class="empty-message" style="margin: 20px; color: red;">Failed to load messages.</p>';
    });
}

// Function to send order details from seller to buyer chat
async function sendOrderDetailsToSeller(orderId, buyerEmail) {
    // In a real system, the seller ID would be fixed, or the system sends it automatically
    // For this example, let's assume the seller's UID is 'seller_uid' or identified as admin.
    if (!sellerId) {
        console.error("Seller ID not defined. Cannot send order details to seller chat.");
        return;
    }

    try {
        const orderDocRef = doc(db, `artifacts/${appId}/users/${userId}/orders`, orderId);
        const orderDoc = await getDoc(orderDocRef);

        if (!orderDoc.exists()) {
            console.error("Order not found for chat message:", orderId);
            return;
        }
        const orderData = orderDoc.data();

        // Ensure current user (buyer) has a conversation with seller
        const conversationId = await createOrGetConversation(userId, sellerId);

        // Prepare simplified order details for the chat message
        const simplifiedOrderDetails = {
            orderId: orderId,
            items: orderData.items.map(item => ({ name: item.name, quantity: item.quantity })),
            total: orderData.total,
            status: orderData.status,
            buyerId: userId,
            buyerEmail: buyerEmail
        };

        // Send message with type 'order' and include orderDetails
        await sendMessage(conversationId, `New order received from ${buyerEmail.split('@')[0]}`, 'order', simplifiedOrderDetails);
        console.log("Order details message sent to seller.");

    } catch (error) {
        console.error("Error sending order details to seller chat:", error);
        showAlert('Error sending order details to seller chat: ' + error.message);
    }
}


// --- Event Listeners and Initial Load ---
window.onload = async () => {
    // Initialize Firebase
    if (!app) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    }

    // Set sellerId on initial load/auth state change
    // For demonstration, the first authenticated user to log in will be considered the admin/seller.
    // In a production app, sellerId would likely be a hardcoded UID or fetched from a config.
    const siteSettingsSnap = await getDoc(siteSettingsDocRef(db));
    if (siteSettingsSnap.exists() && siteSettingsSnap.data().sellerUid) {
        sellerId = siteSettingsSnap.data().sellerUid;
    } else {
        // If no seller UID is explicitly set, the first user to auth can become it (for testing)
        // Or, keep 'placeholder_seller_id' and require manual Firebase setup.
        // For this task, we will assume an admin can be designated.
    }


    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            userEmail = user.email;
            document.getElementById('user-display').textContent = `Welcome, ${userEmail.split('@')[0]}!`;
            document.getElementById('user-display').style.display = 'inline-block';
            document.getElementById('login-register-button').style.display = 'none';
            document.getElementById('logout-button').style.display = 'inline-block';
            document.getElementById('my-orders-button').style.display = 'inline-block';
            document.getElementById('messages-button').style.display = 'inline-flex'; // Show messages button

            // Check if current user is the designated seller/admin
            const siteSettingsDoc = await getDoc(siteSettingsDocRef(db));
            if (!siteSettingsDoc.exists() || !siteSettingsDoc.data().sellerUid) {
                // If no sellerUid, make the first authenticated user the seller
                await setDoc(siteSettingsDocRef(db), { sellerUid: userId }, { merge: true });
                sellerId = userId;
                isAdmin = true;
                document.getElementById('admin-panel-button').style.display = 'inline-block';
                console.log("Current user set as seller/admin.");
            } else if (userId === siteSettingsDoc.data().sellerUid) {
                sellerId = userId;
                isAdmin = true;
                document.getElementById('admin-panel-button').style.display = 'inline-block';
            } else {
                isAdmin = false;
                document.getElementById('admin-panel-button').style.display = 'none';
                sellerId = siteSettingsDoc.data().sellerUid; // Ensure sellerId is set for buyers too
            }

            // For non-admin users, if no profile exists, create one with email as display name
            if (!isAdmin) {
                const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile`);
                const userProfileSnap = await getDoc(userProfileRef);
                if (!userProfileSnap.exists()) {
                    await setDoc(userProfileRef, { email: userEmail, displayName: userEmail.split('@')[0] });
                }
            }


        } else {
            // Anonymous user
            userId = getAnonymousUserId(); // Use anonymous ID if not logged in
            userEmail = 'Guest';
            document.getElementById('user-display').style.display = 'none';
            document.getElementById('login-register-button').style.display = 'inline-block';
            document.getElementById('logout-button').style.display = 'none';
            document.getElementById('my-orders-button').style.display = 'none';
            document.getElementById('admin-panel-button').style.display = 'none';
            document.getElementById('messages-button').style.display = 'none'; // Hide messages button for guests
            isAdmin = false;
            sellerId = (await getDoc(siteSettingsDocRef(db)))?.data()?.sellerUid || 'placeholder_seller_id'; // Get sellerId even if anonymous
        }
        // Load initial data after auth state is determined
        await loadProducts();
        await loadSellerStatusToggle();
        if (userId && (isAdmin || userId !== 'placeholder_seller_id')) { // Only load chat for logged-in or identified non-anonymous users
            loadConversations();
            listenToSellerStatus(); // Start listening for seller status updates
        }
    });

    // Event Listeners for existing UI
    document.getElementById('login-register-button').onclick = () => showModal('auth-modal');
    document.getElementById('logout-button').onclick = async () => {
        try {
            await signOut(auth);
            showAlert('Logged out successfully!');
            // Revert UI to guest state (handled by onAuthStateChanged)
            // Clear any user-specific data like cart, order history
            cart = [];
            updateCartUI();
            document.getElementById('order-history-list').innerHTML = ''; // Clear order history
            document.getElementById('chat-conversations-list').innerHTML = ''; // Clear chat list
            if (conversationsSnapshotUnsubscribe) conversationsSnapshotUnsubscribe();
            if (messagesSnapshotUnsubscribe) messagesSnapshotUnsubscribe();
            if (sellerStatusUnsubscribe) sellerStatusUnsubscribe();
            currentActiveConversationId = null;
        } catch (error) {
            console.error("Error logging out:", error);
            showAlert('Error logging out: ' + error.message);
        }
    };

    document.getElementById('register-button').onclick = async () => {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            showAlert('Registration successful!');
            hideModal('auth-modal');
        } catch (error) {
            document.getElementById('auth-message').textContent = error.message;
        }
    };

    document.getElementById('login-button').onclick = async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showAlert('Login successful!');
            hideModal('auth-modal');
        } catch (error) {
            document.getElementById('auth-message').textContent = error.message;
        }
    };

    document.getElementById('cart-icon-container').onclick = () => {
        showModal('cart-modal');
        updateCartUI();
    };

    document.getElementById('place-order-btn').onclick = placeOrder;
    document.getElementById('my-orders-button').onclick = () => {
        showModal('order-history-modal');
        loadOrderHistory();
    };
    document.getElementById('back-to-orders-btn').onclick = () => {
        document.getElementById('order-history-list').style.display = 'block';
        document.getElementById('order-details-view').style.display = 'none';
    };

    // Admin Panel Listeners
    document.getElementById('admin-panel-button').onclick = () => {
        showModal('admin-panel-modal');
        // Ensure correct tab is active by default or last selected
        document.querySelector('.admin-tab-btn[data-tab="products"]').click();
    };
    document.querySelectorAll('.admin-tab-btn').forEach(button => {
        button.onclick = (event) => {
            document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            document.querySelectorAll('.admin-tab-content').forEach(content => content.style.display = 'none');
            document.getElementById(`admin-${event.target.dataset.tab}`).style.display = 'block';

            // Load content based on tab
            if (event.target.dataset.tab === 'products') {
                loadAdminProducts();
            } else if (event.target.dataset.tab === 'orders') {
                loadAdminOrders();
            } else if (event.target.dataset.tab === 'settings') {
                loadSellerStatusToggle(); // Reload seller status for the admin setting
            }
        };
    });
    document.getElementById('admin-back-to-orders-btn').onclick = () => {
        document.getElementById('admin-order-details-view').style.display = 'none';
        document.getElementById('admin-order-list').style.display = 'table-row-group';
    };

    document.getElementById('seller-online-toggle').onchange = (event) => {
        updateSellerStatus(event.target.checked);
    };

    // Filter & Search listeners
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.onclick = (e) => filterProducts(e.target.dataset.category);
    });
    document.getElementById('search-bar').oninput = (event) => {
        searchProducts(event.target.value);
    };


    // Close modal listeners
    document.querySelectorAll('.modal-close-btn').forEach(button => {
        button.onclick = (event) => {
            const modalId = event.target.dataset.closeModal;
            hideModal(modalId);
            // On closing chat modal, if on mobile and not on chat list view, reset to chat list
            if (modalId === 'chat-modal') {
                if (window.innerWidth <= 480) {
                    document.getElementById('chat-list-sidebar').style.display = 'flex';
                    document.getElementById('chat-conversation-view').style.display = 'none';
                    document.querySelector('.back-to-chats-btn').style.display = 'none';
                }
                currentActiveConversationId = null; // Clear active conversation
                if (messagesSnapshotUnsubscribe) messagesSnapshotUnsubscribe(); // Unsubscribe messages
                loadConversations(); // Reload conversations to update unread counts
            }
        };
    });
    document.querySelector('#custom-alert-modal .custom-modal-close-btn').onclick = () => hideModal('custom-alert-modal');
    document.querySelector('#custom-confirm-modal .custom-modal-close-btn').onclick = () => hideModal('custom-confirm-modal');


    // --- Chat System Specific Event Listeners ---
    document.getElementById('messages-button').onclick = () => {
        if (!userId || userId === 'placeholder_seller_id') {
            showAlert('Please log in to use the chat system.');
            return;
        }
        showModal('chat-modal');
        loadConversations();
        // If on desktop, ensure both views are visible
        if (window.innerWidth > 480) {
            document.getElementById('chat-list-sidebar').style.display = 'flex';
            document.getElementById('chat-conversation-view').style.display = 'flex'; // Default to flex for desktop
            document.querySelector('.back-to-chats-btn').style.display = 'none';
        } else {
            // On mobile, show list view initially
            document.getElementById('chat-list-sidebar').style.display = 'flex';
            document.getElementById('chat-conversation-view').style.display = 'none';
            document.querySelector('.back-to-chats-btn').style.display = 'none';
        }
    };

    document.getElementById('send-chat-message-btn').onclick = () => {
        const messageInput = document.getElementById('chat-message-input');
        const messageText = messageInput.value;
        if (messageText.trim() && currentActiveConversationId) {
            sendMessage(currentActiveConversationId, messageText);
        } else if (!currentActiveConversationId) {
            document.getElementById('chat-message').textContent = 'Please select a conversation first.';
        }
    };

    document.getElementById('chat-message-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            document.getElementById('send-chat-message-btn').click();
        }
    });

    document.querySelector('.back-to-chats-btn').onclick = () => {
        document.getElementById('chat-list-sidebar').style.display = 'flex';
        document.getElementById('chat-conversation-view').style.display = 'none';
        document.querySelector('.back-to-chats-btn').style.display = 'none';
        currentActiveConversationId = null; // Clear active conversation
        if (messagesSnapshotUnsubscribe) messagesSnapshotUnsubscribe(); // Unsubscribe messages
        loadConversations(); // Reload conversations to update unread counts
    };

    // Placeholder actions for chat header buttons
    document.getElementById('send-product-btn').onclick = async () => {
        if (currentActiveConversationId) {
            showAlert("Send Product functionality would be implemented here, e.g., prompt for product ID to send.");
            // Example:
            // const productIdToSend = prompt("Enter product ID to send:");
            // if (productIdToSend) {
            //     const product = allProducts.find(p => p.id === productIdToSend);
            //     if (product) {
            //         const orderDetailsPlaceholder = {
            //             orderId: 'N/A', // Or generate a dummy ID
            //             items: [{ name: product.name, quantity: 1, price: product.price }],
            //             total: product.price,
            //             status: 'sent', // Or a custom status like 'product-sent'
            //             productId: productIdToSend // Include product ID for reference
            //         };
            //         await sendMessage(currentActiveConversationId, `Here's a product: ${product.name}`, 'order', orderDetailsPlaceholder);
            //     } else {
            //         showAlert("Product not found.");
            //     }
            // }
        }
    };

    document.getElementById('visit-store-btn').onclick = () => {
        showAlert("Visit Store functionality would redirect to user's public profile/store page.");
        // Example: window.open(`yourstore.com/user/${contactId}`, '_blank');
    };
};

