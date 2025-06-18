// script.js
// This file handles the main client-side logic for the e-commerce store,
// including Firebase authentication, product display, cart management,
// order history, and integration with the admin panel.

// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    onSnapshot, 
    collection, 
    query, 
    orderBy, 
    addDoc, 
    deleteDoc,
    where, // Added for querying specific user's orders
    serverTimestamp // Added for order date
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// --- Admin Panel Import ---
import { initAdminPanel, cleanupAdminPanel } from './admin.js';

// --- Firebase Configuration ---
// IMPORTANT: Ensure this configuration matches your Firebase project's config.
const firebaseConfig = {
    apiKey: "AIzaSyA4xfUevmevaMDxK2_gLgvZUoqm0gmCn_k",
    authDomain: "store-7b9bd.firebaseapp.com",
    projectId: "store-7b9bd",
    storageBucket: "store-7b9bd.firebase-storage.app",
    messagingSenderId: "1015427798898",
    appId: "1:1015427798898:web:a15c71636506fac128afeb",
    measurementId: "G-NR4JS3FLWG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Global Variables ---
let currentUserId = null; // Stores the current authenticated user's ID
let isAdmin = false;      // Flag to check if the current user is an admin
// IMPORTANT: Replace "LigBezoWV9eVo8lglsijoWinKmA2" with the actual UID of your admin user from Firebase Authentication.
// You can find your UID in the Firebase Console -> Authentication -> Users tab.
const ADMIN_UID = "LigBezoWV9eVo8lglsijoWinKmA2"; // Your provided admin UID

let allProducts = []; // Stores all products fetched from Firestore
let userCart = [];    // Stores items in the user's current session cart
let userOrders = [];  // Stores orders specific to the current user
let unsubscribeUserOrders = null; // Unsubscribe function for userOrders listener

// --- Firestore Collection Paths ---
const APP_ID = 'tempest-store-app'; // Ensure this matches APP_ID in admin.js
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`;
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`;
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`;


// --- DOM Elements ---
// Auth Modals
const authModal = document.getElementById("auth-modal");
const closeAuthModalBtn = document.getElementById("close-auth-modal");
const loginRegisterButton = document.getElementById("login-register-button");
const logoutButton = document.getElementById("logout-button");
const userDisplay = document.getElementById("user-display");
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const registerButton = document.getElementById("register-button");
const loginButton = document.getElementById("login-button");
const forgotPasswordButton = document.getElementById("forgot-password-button");
const authMessage = document.getElementById("auth-message");

// Product List
const productListContainer = document.getElementById("product-list");
const searchBox = document.getElementById("searchBox");
const filterButtons = document.querySelectorAll('.filters button');

// Cart Modals
const cartModal = document.getElementById("cart-modal");
const closeCartModalBtn = document.getElementById("close-cart-modal");
const cartIconBtn = document.getElementById("cart-icon-btn");
const cartCountBadge = document.getElementById("cart-count");
const cartItemsContainer = document.getElementById("cart-items-container");
const cartSubtotalSpan = document.getElementById("cart-subtotal");
const cartTotalSpan = document.getElementById("cart-total");
const placeOrderBtn = document.getElementById("place-order-btn");
const robloxUsernameInput = document.getElementById("roblox-username-input");
const paymentMethodRadios = document.querySelectorAll('input[name="payment-method"]');
const paymentPreviewImg = document.getElementById("payment-preview-img");


// Order History Modal
const myOrdersButton = document.getElementById("my-orders-button");
const orderHistoryModal = document.getElementById("order-history-modal");
const closeOrderHistoryModalBtn = document.getElementById("close-order-history-modal");
const orderHistoryList = document.getElementById("order-history-list");
const orderDetailsView = document.getElementById("order-details-view");
const backToOrderListBtn = document.getElementById("back-to-order-list");
const detailOrderId = document.getElementById("detail-order-id");
const detailOrderDate = document.getElementById("detail-order-date");
const detailOrderStatus = document.getElementById("detail-order-status");
const detailOrderPrice = document.getElementById("detail-order-price");
const detailPaymentMethod = document.getElementById("detail-payment-method");
const detailRobloxUsername = document.getElementById("detail-roblox-username");
const detailItemsList = document.getElementById("detail-items-list");


// --- Event Listeners Setup ---
document.addEventListener("DOMContentLoaded", () => {
    // Auth Modal Listeners
    loginRegisterButton.addEventListener('click', () => {
        authModal.classList.add('show');
        authMessage.textContent = ''; // Clear previous messages
        authEmailInput.value = ''; // Clear inputs
        authPasswordInput.value = '';
    });
    closeAuthModalBtn.addEventListener('click', () => authModal.classList.remove('show'));
    authModal.addEventListener('click', (event) => {
        if (event.target === authModal) {
            authModal.classList.remove('show');
        }
    });

    registerButton.addEventListener('click', handleRegister);
    loginButton.addEventListener('click', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    forgotPasswordButton.addEventListener('click', handleForgotPassword);

    // Cart Modal Listeners
    cartIconBtn.addEventListener('click', () => {
        cartModal.classList.add('show');
        renderCart(); // Re-render cart every time it opens
        updatePlaceOrderButton();
        // Show/hide Roblox username input based on cart content
        robloxUsernameInput.style.display = userCart.length > 0 ? 'block' : 'none';
    });
    closeCartModalBtn.addEventListener('click', () => cartModal.classList.remove('show'));
    cartModal.addEventListener('click', (event) => {
        if (event.target === cartModal) {
            cartModal.classList.remove('show');
        }
    });
    placeOrderBtn.addEventListener('click', handlePlaceOrder);

    // Listen for changes in payment method radio buttons
    paymentMethodRadios.forEach(radio => {
        radio.addEventListener('change', updatePaymentPreviewImage);
    });
    updatePaymentPreviewImage(); // Set initial image

    // Order History Listeners
    myOrdersButton.addEventListener('click', () => {
        orderHistoryModal.classList.add('show');
        // Make sure to show the list view initially
        orderHistoryList.style.display = 'block';
        orderDetailsView.style.display = 'none';
        renderUserOrders(); // Fetch and render user-specific orders
    });
    closeOrderHistoryModalBtn.addEventListener('click', () => orderHistoryModal.classList.remove('show'));
    orderHistoryModal.addEventListener('click', (event) => {
        if (event.target === orderHistoryModal) {
            orderHistoryModal.classList.remove('show');
        }
    });
    backToOrderListBtn.addEventListener('click', () => {
        orderHistoryList.style.display = 'block';
        orderDetailsView.style.display = 'none';
    });

    // Initial load functions
    fetchProducts(); // Fetch products on page load
});

// --- Firebase Authentication State Listener ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        userDisplay.textContent = `Welcome, ${user.email}`;
        loginRegisterButton.style.display = 'none';
        logoutButton.style.display = 'inline-block';
        myOrdersButton.style.display = 'inline-block';
        
        // Check if the current user is the admin
        isAdmin = (currentUserId === ADMIN_UID);
        if (isAdmin) {
            document.getElementById("admin-panel-button").style.display = 'inline-block';
            initAdminPanel(db, auth, currentUserId, isAdmin); // Initialize admin panel
        } else {
            document.getElementById("admin-panel-button").style.display = 'none';
            cleanupAdminPanel(); // Ensure admin panel is cleaned up if not admin
        }
        
        // Setup user-specific cart and orders listeners
        setupUserCartListener(currentUserId);
        setupUserOrdersListener(currentUserId);

    } else {
        currentUserId = null;
        isAdmin = false;
        userDisplay.textContent = '';
        loginRegisterButton.style.display = 'inline-block';
        logoutButton.style.display = 'none';
        myOrdersButton.style.display = 'none';
        document.getElementById("admin-panel-button").style.display = 'none';
        
        cleanupUserCartAndOrders(); // Clear cart and order data on logout
        cleanupAdminPanel(); // Ensure admin panel is cleaned up
    }
});


// --- Authentication Functions ---
async function handleRegister() {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) {
        authMessage.textContent = "Please enter both email and password.";
        return;
    }
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        authMessage.textContent = "Registration successful! You are now logged in.";
        authModal.classList.remove('show');
        // Optionally, create a user document in Firestore
        await setDoc(doc(db, `artifacts/${APP_ID}/users/${userCredential.user.uid}`), {
            email: userCredential.user.email,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Registration error:", error);
        authMessage.textContent = `Registration failed: ${error.message}`;
    }
}

async function handleLogin() {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) {
        authMessage.textContent = "Please enter both email and password.";
        return;
    }
    try {
        await signInWithEmailAndPassword(auth, email, password);
        authMessage.textContent = "Login successful!";
        authModal.classList.remove('show');
    } catch (error) {
        console.error("Login error:", error);
        authMessage.textContent = `Login failed: ${error.message}`;
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        console.log("User logged out");
        // onAuthStateChanged will handle UI updates
    } catch (error) {
        console.error("Logout error:", error);
        alert("Error logging out: " + error.message); // Using alert here for simplicity, custom modal preferred
    }
}

async function handleForgotPassword() {
    const email = authEmailInput.value;
    if (!email) {
        authMessage.textContent = "Please enter your email to reset password.";
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        authMessage.textContent = "Password reset email sent! Check your inbox.";
    } catch (error) {
        console.error("Forgot password error:", error);
        authMessage.textContent = `Failed to send reset email: ${error.message}`;
    }
}


// --- Product Display Functions ---
let unsubscribeProducts = null; // Listener for products

function fetchProducts() {
    // Detach previous listener if exists
    if (unsubscribeProducts) {
        unsubscribeProducts();
    }

    const productsColRef = collection(db, PRODUCTS_COLLECTION_PATH);
    // Order products by name for consistent display
    const q = query(productsColRef, orderBy("name"));

    unsubscribeProducts = onSnapshot(q, (snapshot) => {
        allProducts = [];
        snapshot.forEach(doc => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });
        applyFilters(); // Re-render products after fetching/updating
    }, (error) => {
        console.error("Error fetching products:", error);
        productListContainer.innerHTML = '<p class="empty-message">Error loading products.</p>';
    });
}

// Global filter state
let currentFilterCategory = 'all';
let currentSearchTerm = '';

function setFilter(category) {
    currentFilterCategory = category;
    // Update active state on filter buttons
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.cat === category) {
            btn.classList.add('active');
        }
    });
    applyFilters();
}

function applyFilters() {
    currentSearchTerm = searchBox.value.toLowerCase().trim();

    const filteredProducts = allProducts.filter(product => {
        const matchesCategory = currentFilterCategory === 'all' || product.category === currentFilterCategory;
        const matchesSearch = product.name.toLowerCase().includes(currentSearchTerm) ||
                              product.category.toLowerCase().includes(currentSearchTerm);
        return matchesCategory && matchesSearch;
    });

    renderProducts(filteredProducts);
}

function renderProducts(productsToRender) {
    productListContainer.innerHTML = ''; // Clear current products

    if (productsToRender.length === 0) {
        productListContainer.innerHTML = '<p class="empty-message">No products found matching your criteria.</p>';
        return;
    }

    productsToRender.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';

        const imageUrl = `images/${product.image}`;
        let priceHtml = '';

        if (product.sale && product.salePrice) {
            priceHtml = `<span class="original-price">${product.price}</span> <span class="sale-price">${product.salePrice}</span>`;
        } else {
            priceHtml = `<span class="price">${product.price}</span>`;
        }

        const newBadge = product.new ? '<span class="badge new">New</span>' : '';
        const saleBadge = product.sale ? '<span class="badge sale">Sale</span>' : '';

        productCard.innerHTML = `
            <img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/200x200/f0f0f0/888?text=Image+N/A';" />
            <h3>${product.name}</h3>
            <p class="category">${product.category}</p>
            <p class="price">${priceHtml}</p>
            <p class="stock">Stock: ${product.stock}</p>
            <div class="status-badges">${newBadge}${saleBadge}</div>
            <button class="add-to-cart-btn" data-id="${product.id}" ${product.stock <= 0 ? 'disabled' : ''}>
                ${product.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
        `;
        productListContainer.appendChild(productCard);
    });

    // Add event listeners for "Add to Cart" buttons
    productListContainer.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.dataset.id;
            const productToAdd = allProducts.find(p => p.id === productId);
            if (productToAdd) {
                addToCart(productToAdd);
            }
        });
    });
}


// --- Cart Functions ---
let unsubscribeUserCart = null; // Listener for user's cart

function setupUserCartListener(userId) {
    if (unsubscribeUserCart) {
        unsubscribeUserCart(); // Detach previous listener
    }
    if (!userId) {
        userCart = [];
        updateCartDisplay();
        return;
    }

    const cartDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/cart/current`);
    unsubscribeUserCart = onSnapshot(cartDocRef, (docSnap) => {
        if (docSnap.exists()) {
            userCart = docSnap.data().items || [];
        } else {
            userCart = [];
        }
        updateCartDisplay();
    }, (error) => {
        console.error("Error listening to user cart:", error);
    });
}

function cleanupUserCartAndOrders() {
    if (unsubscribeUserCart) {
        unsubscribeUserCart();
        unsubscribeUserCart = null;
    }
    if (unsubscribeUserOrders) {
        unsubscribeUserOrders();
        unsubscribeUserOrders = null;
    }
    userCart = [];
    userOrders = [];
    updateCartDisplay(); // Clear cart display
    orderHistoryList.innerHTML = '<p class="empty-message">No orders found.</p>'; // Clear order history display
}


async function addToCart(product) {
    if (!currentUserId) {
        alert("Please log in to add items to your cart.");
        authModal.classList.add('show'); // Show login modal
        return;
    }

    const cartDocRef = doc(db, `artifacts/${APP_ID}/users/${currentUserId}/cart/current`);
    
    // Check if product is already in cart
    const existingItemIndex = userCart.findIndex(item => item.id === product.id);

    if (existingItemIndex > -1) {
        // Item exists, update quantity
        const currentQty = userCart[existingItemIndex].quantity;
        if (currentQty < product.stock) {
            userCart[existingItemIndex].quantity += 1;
        } else {
            alert(`Cannot add more "${product.name}". Maximum stock reached.`);
            return;
        }
    } else {
        // Item does not exist, add new item
        if (product.stock > 0) {
            userCart.push({ 
                id: product.id, 
                name: product.name, 
                image: product.image, 
                price: product.price, // Original price string
                salePrice: product.salePrice, // Sale price string
                effectivePrice: product.sale && product.salePrice ? product.salePrice : product.price, // The price used for calculation
                stock: product.stock, // Current stock for reference
                quantity: 1 
            });
        } else {
            alert(`"${product.name}" is out of stock.`);
            return;
        }
    }

    try {
        await setDoc(cartDocRef, { items: userCart });
        // The onSnapshot listener will update the UI
        console.log(`Added "${product.name}" to cart.`);
    } catch (e) {
        console.error("Error adding to cart:", e);
        alert("Failed to add to cart: " + e.message);
    }
}

async function updateCartItemQuantity(productId, newQuantity) {
    if (!currentUserId) return; // Should not happen if user is logged in
    
    const itemIndex = userCart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        const product = allProducts.find(p => p.id === productId); // Get full product data for stock check
        if (!product) {
            console.error("Product not found in allProducts:", productId);
            return;
        }

        if (newQuantity > 0 && newQuantity <= product.stock) {
            userCart[itemIndex].quantity = newQuantity;
        } else if (newQuantity <= 0) {
            // If quantity is 0 or less, remove item
            userCart.splice(itemIndex, 1);
        } else {
            // newQuantity > product.stock
            alert(`Cannot set quantity to ${newQuantity} for "${product.name}". Only ${product.stock} in stock.`);
            // Reset to max available stock
            userCart[itemIndex].quantity = product.stock; 
        }

        try {
            const cartDocRef = doc(db, `artifacts/${APP_ID}/users/${currentUserId}/cart/current`);
            await setDoc(cartDocRef, { items: userCart });
            // UI will update via onSnapshot
        } catch (e) {
            console.error("Error updating cart quantity:", e);
            alert("Failed to update cart quantity: " + e.message);
        }
    }
}

async function removeCartItem(productId) {
    if (!currentUserId) return;

    const itemIndex = userCart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        userCart.splice(itemIndex, 1);
        try {
            const cartDocRef = doc(db, `artifacts/${APP_ID}/users/${currentUserId}/cart/current`);
            await setDoc(cartDocRef, { items: userCart });
            // UI will update via onSnapshot
        } catch (e) {
            console.error("Error removing cart item:", e);
            alert("Failed to remove item from cart: " + e.message);
        }
    }
}

function updateCartDisplay() {
    cartItemsContainer.innerHTML = ''; // Clear existing items
    let subtotal = 0;
    let totalItems = 0;

    if (userCart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
        robloxUsernameInput.style.display = 'none'; // Hide Roblox username input if cart is empty
    } else {
        robloxUsernameInput.style.display = 'block'; // Show Roblox username input if cart has items
        userCart.forEach(item => {
            // Ensure effectivePrice is a number before calculation
            const priceValue = parseFloat(item.effectivePrice.replace('₱', ''));
            const itemTotal = priceValue * item.quantity;
            subtotal += itemTotal;
            totalItems += item.quantity;

            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'cart-item';
            const imageUrl = `images/${item.image}`;
            cartItemDiv.innerHTML = `
                <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='https://placehold.co/60x60/f0f0f0/888?text=N/A';"/>
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p class="price">${item.effectivePrice}</p>
                </div>
                <div class="cart-item-quantity">
                    <button class="qty-minus" data-id="${item.id}">-</button>
                    <input type="number" value="${item.quantity}" min="1" max="${item.stock}" data-id="${item.id}" />
                    <button class="qty-plus" data-id="${item.id}">+</button>
                </div>
                <button class="cart-item-remove" data-id="${item.id}">Remove</button>
            `;
            cartItemsContainer.appendChild(cartItemDiv);
        });

        // Add event listeners for quantity buttons and remove buttons
        cartItemsContainer.querySelectorAll('.qty-minus').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                const input = e.target.nextElementSibling;
                const newQty = parseInt(input.value) - 1;
                updateCartItemQuantity(productId, newQty);
            });
        });

        cartItemsContainer.querySelectorAll('.qty-plus').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                const input = e.target.previousElementSibling;
                const newQty = parseInt(input.value) + 1;
                updateCartItemQuantity(productId, newQty);
            });
        });

        cartItemsContainer.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const productId = e.target.dataset.id;
                const newQty = parseInt(e.target.value);
                updateCartItemQuantity(productId, newQty);
            });
        });

        cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                removeCartItem(productId);
            });
        });
    }

    cartSubtotalSpan.textContent = `₱${subtotal.toFixed(2)}`;
    cartTotalSpan.textContent = `₱${subtotal.toFixed(2)}`; // Assuming no tax/shipping for now
    cartCountBadge.textContent = totalItems;
    updatePlaceOrderButton(subtotal, totalItems);
}

function updatePlaceOrderButton(total = 0, itemCount = 0) {
    if (total === 0 || itemCount === 0) {
        placeOrderBtn.textContent = `Place Order (0 items) ₱0.00`;
        placeOrderBtn.disabled = true;
    } else {
        placeOrderBtn.textContent = `Place Order (${itemCount} items) ₱${total.toFixed(2)}`;
        placeOrderBtn.disabled = false;
    }
}

function updatePaymentPreviewImage() {
    const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;
    let imagePath = '';
    switch (selectedMethod) {
        case 'GCash':
            imagePath = 'images/gcash.png';
            break;
        case 'Maya':
            imagePath = 'images/maya.png';
            break;
        case 'Paypal':
            imagePath = 'images/paypal.png';
            break;
        default:
            imagePath = 'https://placehold.co/200x200/f0f0f0/888?text=Payment'; // Fallback
    }
    paymentPreviewImg.src = imagePath;
}

async function handlePlaceOrder() {
    if (userCart.length === 0) {
        alert("Your cart is empty. Please add items before placing an order.");
        return;
    }
    if (!currentUserId) {
        alert("You must be logged in to place an order.");
        authModal.classList.add('show');
        return;
    }

    const robloxUsername = robloxUsernameInput.value.trim();
    if (!robloxUsername) {
        alert("Please enter your Roblox Username to complete the order.");
        robloxUsernameInput.focus();
        return;
    }

    const total = parseFloat(cartTotalSpan.textContent.replace('₱', ''));
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;

    const orderData = {
        userId: currentUserId,
        robloxUsername: robloxUsername,
        items: userCart.map(item => ({
            id: item.id,
            name: item.name,
            image: item.image,
            price: item.price, // Original string price
            salePrice: item.salePrice, // Original sale price string
            effectivePrice: item.effectivePrice, // The string price used for this order
            quantity: item.quantity
        })),
        total: total,
        paymentMethod: paymentMethod,
        orderDate: Date.now(), // Store as a timestamp
        status: "Pending" // Initial status
    };

    try {
        // 1. Add order to user-specific subcollection
        const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(currentUserId));
        const userOrderDocRef = await addDoc(userOrdersColRef, orderData);
        console.log("Order added to user's history:", userOrderDocRef.id);

        // 2. Add order to a central 'allOrders' collection for admin view
        const allOrdersColRef = collection(db, ALL_ORDERS_COLLECTION_PATH);
        // Use the same ID for the central order document for easier cross-referencing
        await setDoc(doc(allOrdersColRef, userOrderDocRef.id), orderData);
        console.log("Order mirrored to allOrders for admin view:", userOrderDocRef.id);

        // 3. Clear user's cart in Firestore
        await deleteDoc(doc(db, `artifacts/${APP_ID}/users/${currentUserId}/cart/current`));
        userCart = []; // Clear local cart
        updateCartDisplay(); // Update UI to reflect empty cart

        alert("Order placed successfully! Your order ID is: " + userOrderDocRef.id.substring(0, 8) + '...');
        cartModal.classList.remove('show'); // Close cart modal
        robloxUsernameInput.value = ''; // Clear Roblox username input
        
    } catch (e) {
        console.error("Error placing order:", e);
        alert("Failed to place order: " + e.message);
    }
}


// --- Order History Functions (User View) ---
function setupUserOrdersListener(userId) {
    if (unsubscribeUserOrders) {
        unsubscribeUserOrders(); // Detach previous listener
    }
    if (!userId) {
        userOrders = [];
        renderUserOrders(); // Clear display
        return;
    }

    const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(userId));
    const q = query(userOrdersColRef, orderBy("orderDate", "desc"));

    unsubscribeUserOrders = onSnapshot(q, (snapshot) => {
        userOrders = [];
        snapshot.forEach(doc => {
            userOrders.push({ id: doc.id, ...doc.data() });
        });
        renderUserOrders();
    }, (error) => {
        console.error("Error listening to user orders:", error);
    });
}

function renderUserOrders() {
    orderHistoryList.innerHTML = '';
    if (userOrders.length === 0) {
        orderHistoryList.innerHTML = '<p class="empty-message">No orders found.</p>';
        return;
    }

    userOrders.forEach(order => {
        const orderItemDiv = document.createElement('div');
        orderItemDiv.className = 'order-item';
        orderItemDiv.innerHTML = `
            <div class="order-item-info">
                <p><strong>Order ID:</strong> ${order.id.substring(0, 8)}...</p>
                <p><strong>Date:</strong> ${new Date(order.orderDate).toLocaleDateString()}</p>
                <p><strong>Total:</strong> ₱${order.total.toFixed(2)}</p>
                <p><strong>Status:</strong> <span class="order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}">${order.status}</span></p>
            </div>
            <div class="order-item-actions">
                <button class="view-order-details" data-id="${order.id}">View Details</button>
            </div>
        `;
        orderHistoryList.appendChild(orderItemDiv);
    });

    orderHistoryList.querySelectorAll('.view-order-details').forEach(button => {
        button.addEventListener('click', (e) => {
            const orderId = e.target.dataset.id;
            const selectedOrder = userOrders.find(order => order.id === orderId);
            if (selectedOrder) {
                showOrderDetails(selectedOrder);
            }
        });
    });
}

function showOrderDetails(order) {
    orderHistoryList.style.display = 'none';
    orderDetailsView.style.display = 'block';

    detailOrderId.textContent = order.id;
    detailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
    detailOrderStatus.textContent = order.status;
    detailOrderStatus.className = `status-info order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}`;
    detailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
    detailPaymentMethod.textContent = order.paymentMethod;
    detailRobloxUsername.textContent = order.robloxUsername || 'N/A';

    detailItemsList.innerHTML = '';
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'order-detail-item';
            itemDiv.innerHTML = `
                <span>${item.name} (x${item.quantity})</span>
                <span>${item.effectivePrice}</span>
            `;
            detailItemsList.appendChild(itemDiv);
        });
    } else {
        detailItemsList.innerHTML = '<p>No items found for this order.</p>';
    }
}


// --- Export functions for global access if needed (e.g., for inline HTML onClick attributes) ---
// This ensures functions called directly from HTML (like setFilter, applyFilters) are accessible.
// In a more modern setup, all event listeners would be added via JS, removing the need for global exposure.
window.setFilter = setFilter;
window.applyFilters = applyFilters;
// Any other functions referenced in index.html's onclick should be exposed here.


