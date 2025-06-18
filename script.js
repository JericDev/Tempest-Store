import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

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
const db = getFirestore(app);
const storage = getStorage(app);

const adminUID = "LigBezoWV9eVo8lglsijoWinKmA2";

onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("Logged in as:", user.uid);
    
    // Normal user initialization
    initUserFeatures(user); // <- your regular user logic here

    // If admin, load admin.js
    if (user.uid === adminUID) {
      const { initAdminPanel } = await import("./admin.js");
      initAdminPanel(db, auth, storage, user.uid, true);
      document.getElementById("admin-panel-button").style.display = "inline-block";
    }
  } else {
    console.log("Not logged in");
    // Redirect to login or show guest view
  }
});

let cart = [];          // Global array to hold items in the user's shopping cart
window.allProducts = [];   // Global array to hold all products fetched from Firestore. Made global for admin.js access.

// Unsubscribe functions for real-time listeners to prevent memory leaks
let unsubscribeProducts = null;
let unsubscribeSellerStatus = null;
let unsubscribeUserOrders = null;

// References to admin panel functions from admin.js, dynamically loaded
let initAdminPanelModule = null;
let adminCleanupFunction = null; // Function to clean up admin panel listeners/UI

// --- DOM elements (Referenced from index.html) ---
// Authentication & Header
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const registerButton = document.getElementById("register-button");
const loginButton = document.getElementById("login-button");
const loginRegisterButton = document.getElementById("login-register-button");
const logoutButton = document.getElementById("logout-button");
const myOrdersButton = document.getElementById("my-orders-button");
const adminPanelButton = document.getElementById("admin-panel-button");
const authMessage = document.getElementById("auth-message");
const userDisplay = document.getElementById("user-display");
const authModal = document.getElementById("auth-modal");
const closeAuthModalBtn = document.getElementById("close-auth-modal");
const forgotPasswordButton = document.getElementById("forgot-password-button");
const sellerStatusDisplay = document.getElementById("seller-status-display"); // For displaying global seller status

// Cart & Checkout
const cartIconBtn = document.getElementById("cart-icon-btn");
const cartCountBadge = document.getElementById("cart-count");
const cartModal = document.getElementById("cart-modal");
const closeCartModalBtn = document.getElementById("close-cart-modal");
const cartItemsContainer = document.getElementById("cart-items-container");
const cartSubtotalSpan = document.getElementById("cart-subtotal");
const cartTotalSpan = document.getElementById("cart-total");
const placeOrderBtn = document.getElementById("place-order-btn");
const robloxUsernameInput = document.getElementById("roblox-username-input");
const paymentMethodRadios = document.querySelectorAll('input[name="payment-method"]');
const paymentQrImage = document.getElementById("payment-qr-image");
const paymentQrMessage = document.getElementById("payment-qr-message");

// Order History (User-side)
const orderHistoryModal = document.getElementById("order-history-modal");
const closeOrderHistoryModalBtn = document.getElementById("close-order-history-modal");
const orderHistoryList = document.getElementById("order-history-list");
const orderDetailsView = document.getElementById("order-details-view");
const detailOrderId = document.getElementById("detail-order-id");
const detailOrderDate = document.getElementById("detail-order-date");
const detailOrderStatus = document.getElementById("detail-order-status");
const detailOrderPrice = document.getElementById("detail-order-price");
const detailPaymentMethod = document.getElementById("detail-payment-method");
const detailRobloxUsername = document.getElementById("detail-roblox-username");
const detailItemsList = document.getElementById("detail-items-list");
const backToOrderListBtn = document.getElementById("back-to-order-list");

// Product List & Filters
const productListMain = document.getElementById("product-list");
const searchBox = document.getElementById("searchBox");
const filterButtons = document.querySelectorAll(".filters button");

// --- Payment QR Code Image URLs (Placeholder - Update with actual URLs) ---
const paymentImageUrls = {
    'GCash': 'https://placehold.co/300x300/4CAF50/FFFFFF?text=GCash%20QR%0ACode',
    'Maya': 'https://placehold.co/300x300/673AB7/FFFFFF?text=Maya%20QR%0ACode',
    'PayPal': 'https://placehold.co/300x300/0070BA/FFFFFF?text=PayPal%20QR%0ACode'
};

// --- Firestore Collection Paths (Centralized) ---
const APP_ID = 'tempest-store-app';
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`;
const USER_CARTS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/carts`;
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`;
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`;
const SETTINGS_COLLECTION_PATH = `artifacts/${APP_ID}/settings`; // For seller status

// --- Authentication Event Listeners & Functions ---
registerButton.addEventListener("click", async () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) {
        authMessage.textContent = "Please enter email and password.";
        authMessage.style.color = 'red';
        return;
    }
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        authMessage.textContent = `Registered and logged in as: ${auth.currentUser.email}`;
        authMessage.style.color = 'green';
        authModal.classList.remove('show');
        console.log("[Auth] User registered successfully.");
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            authMessage.textContent = "Registration failed: This email is already in use. Try logging in.";
        } else {
            authMessage.textContent = `Registration failed: ${error.message}`;
        }
        authMessage.style.color = 'red';
        console.error("[Auth] Registration error:", error);
    }
});

loginButton.addEventListener("click", async () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) {
        authMessage.textContent = "Please enter email and password.";
        authMessage.style.color = 'red';
        return;
    }
    try {
        await signInWithEmailAndPassword(auth, email, password);
        authMessage.textContent = `Logged in as: ${auth.currentUser.email}`;
        authMessage.style.color = 'green';
        authModal.classList.remove('show');
        console.log("[Auth] User logged in successfully.");
    } catch (error) {
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                authMessage.textContent = "Login failed: Invalid email or password.";
                break;
            case 'auth/invalid-email':
                authMessage.textContent = "Login failed: The email address is not valid.";
                break;
            case 'auth/user-disabled':
                authMessage.textContent = "Login failed: This account has been disabled.";
                break;
            default:
                authMessage.textContent = `Login failed: ${error.message}`;
        }
        authMessage.style.color = 'red';
        console.error("[Auth] Login error:", error);
    }
});

logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
        authMessage.textContent = "Logged out successfully.";
        authMessage.style.color = 'green';
        console.log("[Auth] User logged out.");
    } catch (error) {
        authMessage.textContent = `Logout failed: ${error.message}`;
        authMessage.style.color = 'red';
        console.error("[Auth] Logout error:", error);
    }
});

forgotPasswordButton.addEventListener('click', async () => {
    const email = authEmailInput.value.trim();
    if (!email) {
        authMessage.textContent = "Please enter your email to reset your password.";
        authMessage.style.color = 'red';
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        authMessage.textContent = `Password reset email sent to ${email}. Check your inbox!`;
        authMessage.style.color = 'green';
        authEmailInput.value = "";
        authPasswordInput.value = "";
    } catch (error) {
        switch (error.code) {
            case 'auth/invalid-email':
                authMessage.textContent = "Password reset failed: The email address is not valid.";
                break;
            case 'auth/user-not-found':
                authMessage.textContent = "Password reset failed: No user found with that email address.";
                break;
            default:
                authMessage.textContent = `Password reset failed: ${error.message}`;
        }
        authMessage.style.color = 'red';
        console.error("[Auth] Password reset error:", error);
    }
});

loginRegisterButton.addEventListener('click', () => {
    authModal.classList.add('show');
    authMessage.textContent = "";
    authMessage.style.color = 'red';
    authEmailInput.value = "";
    authPasswordInput.value = "";
});

closeAuthModalBtn.addEventListener('click', () => authModal.classList.remove('show'));
authModal.addEventListener('click', (event) => {
    if (event.target === authModal) {
        authModal.classList.remove('show');
    }
});

// --- Authentication State Observer (Crucial for UI updates and data loading) ---
onAuthStateChanged(auth, async (user) => {
    console.log("--- Auth State Changed ---");

    // Clean up any active admin panel listeners/UI if they exist
    if (adminCleanupFunction) {
        console.log("[Auth] Cleaning up admin panel from previous state.");
        adminCleanupFunction();
        adminCleanupFunction = null;
        initAdminPanelModule = null; // Reset module reference
    }
    // Clean up user orders listener
    if (unsubscribeUserOrders) {
        console.log("[Auth] Unsubscribing from user orders listener.");
        unsubscribeUserOrders();
        unsubscribeUserOrders = null;
    }

    if (user) {
        currentUserId = user.uid;
        isAdmin = (currentUserId === ADMIN_UID); // Check if the logged-in user is the admin
        console.log(`[Auth] User logged in: ${user.email} (UID: ${currentUserId})`);
        console.log(`[Auth] Is user admin? ${isAdmin}`);

        userDisplay.textContent = `Welcome, ${user.email}`;
        loginRegisterButton.style.display = "none";
        logoutButton.style.display = "inline-block";
        myOrdersButton.style.display = "inline-block"; // Show My Orders button

        if (isAdmin) {
            adminPanelButton.style.display = "inline-block"; // Show Admin Panel button
            console.log("[Auth] Admin Panel button is set to 'inline-block'. Computed style:", window.getComputedStyle(adminPanelButton).display);

            // Dynamically import admin.js only when needed (for admin users)
            if (!initAdminPanelModule) {
                console.log("[Auth] Attempting to dynamically import admin.js...");
                try {
                    const adminModule = await import('./admin.js');
                    initAdminPanelModule = adminModule.initAdminPanel;
                    adminCleanupFunction = adminModule.cleanupAdminPanel;
                    console.log("[Auth] admin.js imported successfully.");
                } catch (error) {
                    console.error("[Auth] Error loading admin.js:", error);
                    adminPanelButton.style.display = "none"; // Hide if import fails
                    alert("Failed to load admin panel features. Check console for errors.");
                }
            }
            if (initAdminPanelModule) {
                console.log("[Auth] Initializing admin panel module.");
                // Pass necessary Firebase instances and user info to the admin module
                initAdminPanelModule(db, auth, storage, currentUserId, isAdmin);
            } else {
                console.warn("[Auth] initAdminPanelModule is not available. Admin panel functionality might be limited.");
            }
        } else {
            console.log("[Auth] User is not an admin. Hiding admin panel button.");
            adminPanelButton.style.display = "none";
        }

        robloxUsernameInput.style.display = "block"; // Show Roblox username input for logged-in users

        // Load and sync cart from Firestore
        console.log("[Cart] Loading cart from Firestore...");
        await loadCartFromFirestore(currentUserId);
        console.log("[Cart] Syncing local cart with Firestore cart (if any)...");
        await syncCartOnLogin(currentUserId);

        // Setup real-time listener for user's own orders
        console.log("[Orders] Setting up user order history listener.");
        setupUserOrderHistoryListener(currentUserId);

    } else {
        // User is logged out
        console.log("[Auth] User is logged out. Resetting UI and state.");
        currentUserId = null;
        isAdmin = false;

        userDisplay.textContent = "";
        loginRegisterButton.style.display = "inline-block";
        logoutButton.style.display = "none";
        myOrdersButton.style.display = "none";
        adminPanelButton.style.display = "none"; // Ensure hidden on logout

        robloxUsernameInput.style.display = "none";

        // Load cart from Local Storage when logged out
        console.log("[Cart] Loading cart from Local Storage (user logged out).");
        cart = loadCartFromLocalStorage();
    }
    // Always clear auth form fields and re-render cart on any auth state change
    authEmailInput.value = "";
    authPasswordInput.value = "";
    authMessage.textContent = "";
    renderCart(); // Update cart UI regardless of login state
    // products are re-rendered by setupProductsListener, which runs on DOMContentLoaded
    // and is triggered by changes in Firestore products collection.
    // No need to call renderProducts here directly.
});

// --- Seller Status Management (Global) ---
// Sets up a real-time listener for the global seller status from Firestore.
// This runs on page load and updates the header status.
function setupSellerStatusListener() {
    if (unsubscribeSellerStatus) {
        unsubscribeSellerStatus(); // Ensure only one listener is active
    }
    const sellerStatusDocRef = doc(db, SETTINGS_COLLECTION_PATH, 'sellerStatus');
    unsubscribeSellerStatus = onSnapshot(sellerStatusDocRef, (docSnap) => {
        console.log("[Seller Status] Global listener triggered.");
        if (docSnap.exists()) {
            const statusData = docSnap.data();
            const isOnline = statusData.isOnline;
            sellerStatusDisplay.textContent = isOnline ? 'Online' : 'Offline';
            sellerStatusDisplay.classList.toggle('online', isOnline);
            sellerStatusDisplay.classList.toggle('offline', !isOnline);
            console.log(`[Seller Status] Display updated: ${isOnline ? 'Online' : 'Offline'}`);
        } else {
            // If the document doesn't exist, create it with a default 'Offline' status
            console.warn("[Seller Status] Document not found. Creating default status 'Offline'.");
            sellerStatusDisplay.textContent = 'Offline';
            sellerStatusDisplay.classList.remove('online');
            sellerStatusDisplay.classList.add('offline');
            setDoc(sellerStatusDocRef, { isOnline: false }, { merge: true })
                .catch(e => console.error("[Seller Status] Error creating default status document:", e));
        }
    }, (error) => {
        console.error("[Seller Status] Error listening to global seller status:", error);
    });
}
setupSellerStatusListener(); // Initialize global seller status listener on script load

// --- Product Display (Main Storefront - Always Visible) ---
// Sets up a real-time listener for product data in Firestore.
// Any changes to products in the database will automatically update the UI.
function setupProductsListener() {
    if (unsubscribeProducts) {
        unsubscribeProducts(); // Ensure only one listener is active
    }
    const productsColRef = collection(db, PRODUCTS_COLLECTION_PATH);
    unsubscribeProducts = onSnapshot(productsColRef, (snapshot) => {
        console.log("[Products] Products listener triggered. Fetching product data...");
        const fetchedProducts = [];
        snapshot.forEach(doc => {
            fetchedProducts.push({ id: doc.id, ...doc.data() });
        });
        window.allProducts = fetchedProducts; // Update global product list
        console.log(`[Products] Fetched ${window.allProducts.length} products.`);
        applyFilters(); // Re-render products on the main page (applies current filters)
        renderCart(); // Re-render cart to update prices/stock info if products changed
    }, (error) => {
        console.error("[Products] Error listening to products:", error);
    });
}
setupProductsListener(); // Initialize products listener on script load (products are always public)


// Renders the products on the main storefront based on the provided array.
function renderProducts(items) {
    const list = productListMain; // Use the renamed variable
    if (!list) {
        console.error("Error: #product-list element not found.");
        return;
    }
    list.innerHTML = ""; // Clear existing product cards

    if (items.length === 0) {
        list.innerHTML = '<p class="empty-message" style="width: 100%; text-align: center; padding: 50px;">No products available. Please add some from the Admin Panel!</p>';
        console.log("[Product UI] No products to display.");
        return;
    }

    items.forEach(product => {
        const card = document.createElement("div");
        card.className = "card";
        const isOutOfStock = !product.stock || product.stock <= 0;
        if (isOutOfStock) card.classList.add("out-of-stock");

        // Determine price to display: salePrice if on sale, else regular price
        const priceNum = parseFloat(product.price.replace('₱', ''));
        const salePriceNum = product.salePrice ? parseFloat(product.salePrice.replace('₱', '')) : null;
        
        let displayPriceHtml = `₱${priceNum.toFixed(2)}`;
        if (product.sale && salePriceNum !== null) {
            displayPriceHtml = `<span style="text-decoration: line-through; color: #888; font-size: 0.9em;">₱${priceNum.toFixed(2)}</span> ₱${salePriceNum.toFixed(2)}`;
        }
        
        const imageUrl = `images/${product.image}`; // Assuming images are in an 'images' folder

        card.innerHTML = `
            ${product.new ? `<span class="badge">NEW</span>` : ""}
            ${product.sale ? `<span class="badge sale" style="${product.new ? 'left: 60px;' : ''}">SALE</span>` : ""}
            <img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/150x150/f0f0f0/888?text=Image%20N/A';" />
            <h4>${product.name}</h4>
            <div class="price">${displayPriceHtml}</div>
            <div class="stock-info ${isOutOfStock ? 'out-of-stock-text' : 'in-stock'}">
                ${isOutOfStock ? 'Out of Stock' : `Stock: ${product.stock}`}
            </div>
            <button class="add-to-cart-btn" ${isOutOfStock ? 'disabled' : ''} data-product-id="${product.id}">
                ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
        `;
        list.appendChild(card);
    });

    // Attach event listeners for "Add to Cart" buttons
    list.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const productToAdd = window.allProducts.find(p => p.id === productId);
            if (productToAdd && productToAdd.stock > 0) {
                addToCart(productToAdd);
            } else if (productToAdd && productToAdd.stock <= 0) {
                alert("This item is currently out of stock.");
            }
        });
    });
    console.log("[Product UI] Products rendered successfully.");
}

// Global functions for filters
let currentCategory = "all"; // Initialize default category

window.setFilter = function(category) {
    currentCategory = category;
    filterButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.cat === category);
    });
    applyFilters();
    console.log("[Filter] Category filter set to:", category);
}

window.applyFilters = function() {
    const query = searchBox.value.toLowerCase();

    const filtered = window.allProducts.filter(product => { // Use window.allProducts
        const matchesCategory = currentCategory === "all" || product.category === currentCategory;
        const matchesSearch = product.name.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
    });
    renderProducts(filtered); // Render filtered products
    console.log(`[Filter] Applied filters. Search query: "${query}", Category: "${currentCategory}". Found ${filtered.length} products.`);
}

// --- Cart Management Functions & Event Listeners ---
function addToCart(product) {
    // Find the current actual price from allProducts to ensure consistency
    const productDetails = window.allProducts.find(p => p.id === product.id); // Use window.allProducts
    if (!productDetails || productDetails.stock <= 0) {
        alert(`${product.name} is out of stock!`);
        return;
    }

    const priceToUse = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        if (existingItem.quantity < productDetails.stock) {
            existingItem.quantity++;
            existingItem.effectivePrice = priceToUse; // Update price in cart item
        } else {
            alert(`You cannot add more ${product.name}. Max stock reached!`);
        }
    } else {
        cart.push({ ...product, quantity: 1, effectivePrice: priceToUse });
    }
    saveCart(); // Persist changes to Firestore/Local Storage
    renderCart(); // Update cart UI
    console.log("[Cart] Added/Updated item in cart:", product.name, "Current cart:", cart);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
    console.log("[Cart] Removed item from cart:", productId);
}

function updateCartQuantity(productId, newQuantity) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        const productDetails = window.allProducts.find(p => p.id === productId); // Use window.allProducts
        if (!productDetails) {
            console.error(`Product details not found for ID: ${productId}`);
            return;
        }

        const effectiveQuantity = Math.max(0, newQuantity); // Quantity cannot be negative

        if (effectiveQuantity === 0) {
            removeFromCart(productId); // Remove if quantity becomes 0
        } else if (effectiveQuantity <= productDetails.stock) {
            item.quantity = effectiveQuantity;
            item.effectivePrice = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price; // Update price
            saveCart();
            renderCart();
            console.log("[Cart] Updated quantity for", productId, "to", newQuantity);
        } else {
            alert(`Cannot set quantity for ${item.name} to ${newQuantity}. Only ${productDetails.stock} in stock.`);
            item.quantity = productDetails.stock; // Set to max available stock
            saveCart();
            renderCart();
        }
    }
}

function saveCart() {
    if (currentUserId) {
        saveCartToFirestore(currentUserId, cart);
    } else {
        saveCartToLocalStorage(cart);
    }
    updateCartCountBadge();
}

async function saveCartToFirestore(userId, cartData) {
    try {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        await setDoc(userCartRef, { items: JSON.stringify(cartData) });
        console.log("[Cart] Cart saved to Firestore for user:", userId);
    } catch (e) {
        console.error("[Cart] Error saving cart to Firestore:", e);
    }
}

async function loadCartFromFirestore(userId) {
    try {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        const docSnap = await getDoc(userCartRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            cart = JSON.parse(data.items || '[]');
            console.log("[Cart] Cart loaded from Firestore for user:", userId, cart);
        } else {
            cart = [];
            console.log("[Cart] No cart found in Firestore for user:", userId);
        }
    } catch (e) {
        console.error("[Cart] Error loading cart from Firestore:", e);
        cart = [];
    }
}

function saveCartToLocalStorage(cartData) {
    localStorage.setItem('tempestStoreCart', JSON.stringify(cartData));
    console.log("[Cart] Cart saved to Local Storage.");
}

function loadCartFromLocalStorage() {
    const storedCart = localStorage.getItem('tempestStoreCart');
    const loadedCart = storedCart ? JSON.parse(storedCart) : [];
    console.log("[Cart] Cart loaded from Local Storage:", loadedCart);
    return loadedCart;
}

async function syncCartOnLogin(userId) {
    const localCart = loadCartFromLocalStorage();
    if (localCart.length > 0) {
        console.log("[Cart] Local cart found. Syncing with Firestore...");
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        const docSnap = await getDoc(userCartRef);
        let firestoreCart = [];
        if (docSnap.exists()) {
            firestoreCart = JSON.parse(docSnap.data().items || '[]');
            console.log("[Cart] Existing Firestore cart found:", firestoreCart);
        }

        localCart.forEach(localItem => {
            const existingItemIndex = firestoreCart.findIndex(item => item.id === localItem.id);
            const productDetails = window.allProducts.find(p => p.id === localItem.id); // Use window.allProducts
            if (productDetails) {
                const priceToUse = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                if (existingItemIndex > -1) {
                    // Only add up to available stock
                    const newQuantity = Math.min(productDetails.stock, firestoreCart[existingItemIndex].quantity + localItem.quantity);
                    firestoreCart[existingItemIndex].quantity = newQuantity;
                    firestoreCart[existingItemIndex].effectivePrice = priceToUse;
                } else {
                    // Add new item with current effective price, up to stock
                    const quantityToAdd = Math.min(productDetails.stock, localItem.quantity);
                    if (quantityToAdd > 0) {
                         firestoreCart.push({ ...localItem, quantity: quantityToAdd, effectivePrice: priceToUse });
                    }
                }
            } else {
                console.warn(`[Cart] Product ${localItem.name} (ID: ${localItem.id}) not found in current product list during sync. Skipping or adding with old price.`);
                // If product no longer exists, we might still add it with its old price, or skip.
                // A better approach for a real store would be to remove non-existent items.
                if (existingItemIndex > -1) {
                    // If it existed in firestoreCart, keep its current state there.
                } else {
                     firestoreCart.push(localItem); // Add with its original data if not found in current products
                }
            }
        });
        cart = firestoreCart;
        await saveCartToFirestore(userId, cart);
        localStorage.removeItem('tempestStoreCart');
        console.log("[Cart] Local cart cleared after sync.");
        renderCart();
    } else {
        console.log("[Cart] No local cart found to sync.");
    }
}


function updateCartCountBadge() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountBadge.textContent = totalItems;
    cartCountBadge.style.display = totalItems > 0 ? 'inline-block' : 'none';

    const { total } = calculateCartTotals();
    placeOrderBtn.textContent = `Place Order (${totalItems} item${totalItems !== 1 ? 's' : ''}) ₱${total.toFixed(2)}`;

    // Place Order button disabled if cart is empty OR (logged in AND Roblox username is empty)
    const isRobloxUsernameMissing = currentUserId && robloxUsernameInput.value.trim() === '';
    placeOrderBtn.disabled = totalItems === 0 || isRobloxUsernameMissing;
    console.log(`[Cart UI] Cart badge: ${totalItems} items, Place Order button state: ${placeOrderBtn.disabled ? 'disabled' : 'enabled'}`);
}

function renderCart() {
    cartItemsContainer.innerHTML = '';

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
    } else {
        cart.forEach(item => {
            // Re-fetch product details to ensure current stock and price
            const productDetails = window.allProducts.find(p => p.id === item.id); // Use window.allProducts
            let displayPrice;
            let currentStock = productDetails ? productDetails.stock : 0;
            if (productDetails) {
                displayPrice = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                item.effectivePrice = displayPrice; // Update the effective price in cart
            } else {
                displayPrice = item.effectivePrice || item.price; // Fallback to stored price
                currentStock = 0; // Assume out of stock if product doesn't exist anymore
                console.warn(`[Cart UI] Product ${item.name} (ID: ${item.id}) not found in allProducts during render. Showing existing price.`);
            }

            const isItemOutOfStock = item.quantity > currentStock;
            const imageUrl = `images/${item.image}`;

            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'cart-item';
            cartItemDiv.innerHTML = `
                <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/f0f0f0/888?text=Image%20N/A';" />
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <div class="cart-item-price">${displayPrice}</div>
                    ${isItemOutOfStock ? '<p style="color: red; font-size: 0.8em; margin: 5px 0 0;">(Quantity exceeds stock!)</p>' : ''}
                </div>
                <div class="cart-item-quantity-control">
                    <button data-id="${item.id}" data-action="decrease" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                    <input type="number" value="${item.quantity}" min="1" data-id="${item.id}" readonly>
                    <button data-id="${item.id}" data-action="increase" ${item.quantity >= currentStock ? 'disabled' : ''}>+</button>
                </div>
                <button class="cart-item-remove" data-id="${item.id}">&times;</button>
            `;
            cartItemsContainer.appendChild(cartItemDiv);
        });

        // Add event listeners for quantity controls
        cartItemsContainer.querySelectorAll('.cart-item-quantity-control button').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.target.dataset.id;
                const action = event.target.dataset.action;
                const input = event.target.parentElement.querySelector('input');
                let newQuantity = parseInt(input.value);

                if (action === 'increase') {
                    newQuantity++;
                } else if (action === 'decrease') {
                    newQuantity--;
                }
                updateCartQuantity(productId, newQuantity);
            });
        });

        cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.target.dataset.id;
                removeFromCart(productId);
            });
        });
    }

    calculateCartTotals();
    updateCartCountBadge();
    displayPaymentQrCode(); // Update QR code based on selected method
    console.log("[Cart UI] Cart items rendered and totals updated.");
}

function calculateCartTotals() {
    let subtotal = 0;
    let totalItemsInCart = 0;
    cart.forEach(item => {
        // Use effectivePrice which is updated in renderCart based on latest product data
        const priceValue = parseFloat(item.effectivePrice.replace('₱', ''));
        subtotal += priceValue * item.quantity;
        totalItemsInCart += item.quantity;
    });

    const total = subtotal; // No shipping fee in current requirements

    cartSubtotalSpan.textContent = `₱${subtotal.toFixed(2)}`;
    cartTotalSpan.textContent = `₱${total.toFixed(2)}`;

    return { subtotal, total, totalItemsInCart };
}

// Cart modal event listeners
cartIconBtn.addEventListener('click', () => {
    cartModal.classList.add('show');
    renderCart(); // Render cart when opening modal
    robloxUsernameInput.style.display = currentUserId ? 'block' : 'none';
    updateCartCountBadge(); // Ensure button text is updated

    // Display QR for the currently checked payment method on modal open
    const checkedPaymentMethod = document.querySelector('input[name="payment-method"]:checked');
    if (checkedPaymentMethod) {
        displayPaymentQrCode(checkedPaymentMethod.value);
    } else {
        paymentQrImage.style.display = 'none';
        paymentQrMessage.style.display = 'block';
        paymentQrMessage.textContent = 'Please select a payment method.';
    }
    console.log("[Cart Modal] Opened cart modal.");
});
closeCartModalBtn.addEventListener('click', () => cartModal.classList.remove('show'));
cartModal.addEventListener('click', (event) => {
    if (event.target === cartModal) {
        cartModal.classList.remove('show');
    }
});

robloxUsernameInput.addEventListener('input', updateCartCountBadge); // Update button state on input

// Payment method selection & QR display
paymentMethodRadios.forEach(radio => {
    radio.addEventListener('change', (event) => {
        displayPaymentQrCode(event.target.value);
        console.log("[Payment] Payment method changed to:", event.target.value);
    });
});

function displayPaymentQrCode(method) {
    const imageUrl = paymentImageUrls[method];
    if (imageUrl) {
        paymentQrImage.src = imageUrl;
        paymentQrImage.style.display = 'block';
        paymentQrMessage.style.display = 'none';
    } else {
        paymentQrImage.style.display = 'none';
        paymentQrMessage.style.display = 'block';
        paymentQrMessage.textContent = 'QR code not available for this payment method.';
    }
}

// Place Order button functionality
placeOrderBtn.addEventListener('click', async () => {
    console.log("[Order] Place order button clicked.");
    if (cart.length === 0) {
        alert("Your cart is empty. Please add items before placing an order.");
        console.log("[Order] Cart is empty. Order not placed.");
        return;
    }

    const robloxUsername = robloxUsernameInput.value.trim();

    if (!currentUserId) {
        authModal.classList.add('show');
        authMessage.textContent = "Please login or register to complete your order.";
        authMessage.style.color = 'red';
        console.log("[Order] User not logged in. Prompting for login/registration.");
        return;
    }

    if (robloxUsername === '') {
        alert("Please enter your Roblox Username to proceed with the order.");
        console.log("[Order] Roblox username is empty. Order not placed.");
        return;
    }

    placeOrderBtn.disabled = true; // Disable button to prevent double-click

    try {
        // Validate stock availability one last time before placing order
        for (const item of cart) {
            const productDetails = window.allProducts.find(p => p.id === item.id); // Use window.allProducts
            if (!productDetails || productDetails.stock < item.quantity) {
                alert(`Insufficient stock for ${item.name}. Available: ${productDetails ? productDetails.stock : 0}, In Cart: ${item.quantity}. Please adjust your cart.`);
                placeOrderBtn.disabled = false;
                return;
            }
        }

        const { subtotal, total } = calculateCartTotals();
        const orderDetails = {
            userId: currentUserId,
            // Deep copy cart items to ensure order details are immutable if cart changes later
            // Use item.effectivePrice which is updated during renderCart()
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                image: item.image,
                quantity: item.quantity,
                effectivePrice: item.effectivePrice,
                price: item.price // Keep original price for reference if needed
            })),
            subtotal: subtotal,
            total: total,
            orderDate: new Date().toISOString(),
            status: 'Pending', // Initial status
            paymentMethod: document.querySelector('input[name="payment-method"]:checked').value,
            robloxUsername: robloxUsername
        };

        console.log("[Order] Attempting to place order with details:", orderDetails);

        const batch = writeBatch(db); // Use Firestore batch for atomic updates

        // 1. Add order to user's personal collection
        const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(currentUserId));
        const userOrderDocRef = doc(userOrdersColRef); // Auto-generate ID for user's order
        batch.set(userOrderDocRef, orderDetails);
        console.log("[Order] Batch: Adding order to user's collection.");

        // 2. Add order to central 'allOrders' collection using the same ID
        const allOrdersColRef = collection(db, ALL_ORDERS_COLLECTION_PATH);
        batch.set(doc(allOrdersColRef, userOrderDocRef.id), orderDetails);
        console.log("[Order] Batch: Adding order to allOrders collection.");

        // Note: Stock deduction on order placement is not happening here,
        // it will happen when the admin marks the order as "Completed" in admin.js.

        await batch.commit(); // Commit all batch operations
        console.log("[Order] Batch commit successful!");

        alert("Successfully Placed Order!");
        console.log("Order saved to Firestore!");

        cart = []; // Clear the cart
        saveCart(); // Save empty cart
        renderCart(); // Update cart UI
        cartModal.classList.remove('show'); // Close cart modal
        robloxUsernameInput.value = ''; // Clear Roblox username field

    } catch (e) {
        console.error("[Order] Error placing order:", e);
        alert("There was an error placing your order. Please try again. Check console for details.");
    } finally {
        placeOrderBtn.disabled = false; // Re-enable button
        console.log("[Order] Place Order button re-enabled.");
    }
});


// --- Order History Functions (Customer Side) ---
let userOrders = []; // Ensure this is accessible to renderUserOrdersList

myOrdersButton.addEventListener('click', () => {
    console.log("[My Orders] My Orders button clicked.");
    if (!currentUserId) {
        alert("Please log in to view your orders.");
        console.log("[My Orders] User not logged in. Cannot view orders.");
        return;
    }
    orderHistoryModal.classList.add('show');
    // The listener `setupUserOrderHistoryListener` already keeps `userOrders` updated.
    // Just need to ensure the list is rendered when modal opens.
    renderUserOrdersList();
    console.log("[My Orders] Showing order history modal.");
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
    console.log("[My Orders] Back to order list view.");
});

// Sets up a real-time listener for a specific user's order history.
function setupUserOrderHistoryListener(userId) {
    if (unsubscribeUserOrders) {
        unsubscribeUserOrders(); // Unsubscribe from previous listener if it exists
        console.log("[Orders] Existing user orders listener unsubscribed for new user/logout.");
    }
    const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(userId));
    const q = query(userOrdersColRef, orderBy("orderDate", "desc")); // Order by most recent

    unsubscribeUserOrders = onSnapshot(q, (snapshot) => {
        console.log("[Orders] User orders listener triggered. Fetching user orders...");
        const fetchedOrders = [];
        snapshot.forEach(docSnap => {
            fetchedOrders.push({ id: docSnap.id, ...docSnap.data() });
        });
        userOrders = fetchedOrders; // Update the global userOrders array
        renderUserOrdersList(); // Re-render the list whenever data changes
        console.log(`[Orders] Fetched ${fetchedOrders.length} user orders.`);
    }, (error) => {
        console.error("[Orders] Error listening to user order history:", error);
        orderHistoryList.innerHTML = '<p class="empty-message">Error loading your orders.</p>';
    });
}

function renderUserOrdersList() {
    orderHistoryList.innerHTML = '';
    orderDetailsView.style.display = 'none'; // Ensure details view is hidden by default

    if (userOrders.length === 0) {
        orderHistoryList.innerHTML = '<p class="empty-message">You have no past orders.</p>';
        console.log("[My Orders UI] No user orders to render.");
        return;
    }

    userOrders.forEach(order => {
        const orderDate = new Date(order.orderDate).toLocaleDateString();
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-summary-item';
        orderDiv.innerHTML = `
            <p><strong>Order ID:</strong> ${order.id.substring(0, 8)}...</p>
            <p><strong>Date:</strong> ${orderDate}</p>
            <p><strong>Total:</strong> ₱${order.total.toFixed(2)}</p>
            <p><strong>Status:</strong> <span class="order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}}">${order.status}</span></p>
            <button class="view-order-details" data-order-id="${order.id}">View Details</button>
        `;
        orderHistoryList.appendChild(orderDiv);
    });

    orderHistoryList.querySelectorAll('.view-order-details').forEach(button => {
        button.addEventListener('click', (e) => {
            const orderId = e.target.dataset.orderId;
            const selectedOrder = userOrders.find(order => order.id === orderId);
            if (selectedOrder) {
                showOrderDetails(selectedOrder);
            }
        });
    });
    console.log("[My Orders UI] User orders list rendered.");
}

async function showOrderDetails(order) {
    console.log("[My Orders] Showing details for order ID:", order.id);
    orderHistoryList.style.display = 'none';
    orderDetailsView.style.display = 'block';

    detailOrderId.textContent = order.id;
    detailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
    detailOrderStatus.textContent = order.status;
    detailOrderStatus.className = `order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}`;
    detailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
    detailPaymentMethod.textContent = order.paymentMethod;
    detailRobloxUsername.textContent = order.robloxUsername || 'N/A';

    detailItemsList.innerHTML = '';
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'order-detail-item';
            // Use effectivePrice as this is what was charged in the order
            const itemPriceToDisplay = item.effectivePrice || item.price;
            itemDiv.innerHTML = `
                <span>${item.name}</span>
                <span>Qty: ${item.quantity}</span>
                <span>${itemPriceToDisplay}</span>
            `;
            detailItemsList.appendChild(itemDiv);
        });
    } else {
        detailItemsList.innerHTML = '<p>No items found for this order.</p>';
    }
    console.log("[My Orders] Order details populated for order ID:", order.id);
}

// --- Initial setup on DOM Content Loaded ---
window.addEventListener("DOMContentLoaded", () => {
    // Set 'All' filter button as active initially
    const allFilterButton = document.querySelector('.filters button[data-cat="all"]');
    if (allFilterButton) {
        allFilterButton.classList.add('active');
    }

    updateCartCountBadge();
    // This will set the initial QR image based on the default checked radio button
    const checkedPaymentMethod = document.querySelector('input[name="payment-method"]:checked');
    if (checkedPaymentMethod) {
        displayPaymentQrCode(checkedPaymentMethod.value);
    }
    console.log("[Init] DOM Content Loaded. Initial UI setup complete.");
});
