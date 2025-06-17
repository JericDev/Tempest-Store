// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
// Add 'where' for filtering the query
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, addDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// Your web app's Firebase configuration
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
const db = getFirestore(app); // Initialize Firestore

let currentUserId = null; // To store the current authenticated user's ID
let isAdmin = false; // Flag to check if the current user is an admin
// IMPORTANT: Replace "YOUR_ADMIN_UID_HERE" with the actual UID of your admin user from Firebase Authentication.
// You can find your UID in the Firebase Console -> Authentication -> Users tab.
const ADMIN_UID = "LigBezoWV9eVo8lglsijoWinKmA2"; // Updated with the provided UID

let cart = []; // Global cart array
let userOrders = []; // Global array to store user's orders (for user history)
let allProducts = []; // Global array to store all products from Firestore

// Global variables to store unsubscribe functions for real-time listeners
let unsubscribeUserOrders = null;
let unsubscribeProducts = null;
// Unsubscribe for allOrders will be handled in admin.js

// Reference to the admin panel initialization function from admin.js
let initAdminPanelModule = null;
let adminCleanupFunction = null;


// --- DOM elements for Authentication ---
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const registerButton = document.getElementById("register-button");
const loginButton = document.getElementById("login-button");
const loginRegisterButton = document.getElementById("login-register-button");
const logoutButton = document.getElementById("logout-button");
const myOrdersButton = document.getElementById("my-orders-button");
// adminPanelButton is now managed by admin.js, but its visibility by script.js
const adminPanelButton = document.getElementById("admin-panel-button");
const authMessage = document.getElementById("auth-message");
const userDisplay = document.getElementById("user-display");
const authModal = document.getElementById("auth-modal");
const closeAuthModalBtn = document.getElementById("close-auth-modal");
const forgotPasswordButton = document.getElementById("forgot-password-button"); // New: Forgot Password button


// --- DOM elements for Cart/Checkout ---
const cartIconBtn = document.getElementById("cart-icon-btn");
const cartCountBadge = document.getElementById("cart-count");
const cartModal = document.getElementById("cart-modal");
const closeCartModalBtn = document.getElementById("close-cart-modal");
const cartItemsContainer = document.getElementById("cart-items-container");
const cartSubtotalSpan = document.getElementById("cart-subtotal");
const cartTotalSpan = document.getElementById("cart-total");
const placeOrderBtn = document.getElementById("place-order-btn");
const robloxUsernameInput = document.getElementById("roblox-username-input");

// --- DOM elements for Order History ---
const orderHistoryModal = document.getElementById("order-history-modal");
const closeOrderHistoryModalBtn = document.getElementById("close-order-history-modal");
const orderHistoryList = document.getElementById("order-history-list");
const orderHistoryTitle = document.getElementById("order-history-title");
const orderDetailsView = document.getElementById("order-details-view");
const detailOrderId = document.getElementById("detail-order-id");
const detailOrderDate = document.getElementById("detail-order-date");
const detailOrderStatus = document.getElementById("detail-order-status");
const detailOrderPrice = document.getElementById("detail-order-price");
const detailPaymentMethod = document.getElementById("detail-payment-method");
const detailRobloxUsername = document.getElementById("detail-roblox-username");
const detailItemsList = document.getElementById("detail-items-list");
const backToOrderListBtn = document.getElementById("back-to-order-list");


// --- Authentication Functions ---
registerButton.addEventListener("click", () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) { authMessage.textContent = "Please enter email and password."; return; }
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            authMessage.textContent = `Registered and logged in as: ${userCredential.user.email}`;
            authMessage.style.color = 'green';
            console.log("User registered:", userCredential.user.email);
            authModal.classList.remove('show');
        })
        .catch((error) => {
            if (error.code === 'auth/email-already-in-use') {
                authMessage.textContent = "Registration failed: This email is already in use. Try logging in.";
            } else {
                authMessage.textContent = `Registration failed: ${error.message}`;
            }
            authMessage.style.color = 'red';
            console.error("Registration error:", error);
        });
});

loginButton.addEventListener("click", () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) { authMessage.textContent = "Please enter email and password."; return; }
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            authMessage.textContent = `Logged in as: ${userCredential.user.email}`;
            authMessage.style.color = 'green';
            console.log("User logged in:", userCredential.user.email);
            authModal.classList.remove('show');
        })
        .catch((error) => {
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
            console.error("Login error:", error);
        });
});

logoutButton.addEventListener("click", () => {
    signOut(auth)
        .then(() => {
            authMessage.textContent = "Logged out successfully.";
            authMessage.style.color = 'green';
            console.log("User logged out.");
        })
        .catch((error) => {
            authMessage.textContent = `Logout failed: ${error.message}`;
            authMessage.style.color = 'red';
            console.error("Logout error:", error);
        });
});

loginRegisterButton.addEventListener('click', () => {
    authModal.classList.add('show');
    authMessage.textContent = "";
    authMessage.style.color = 'red';
    authEmailInput.value = "";
    authPasswordInput.value = "";
});

closeAuthModalBtn.addEventListener('click', () => {
    authModal.classList.remove('show');
});

authModal.addEventListener('click', (event) => {
    if (event.target === authModal) {
        authModal.classList.remove('show');
    }
});

// --- Forgot Password Functionality ---
forgotPasswordButton.addEventListener('click', () => {
    const email = authEmailInput.value.trim();
    if (!email) {
        authMessage.textContent = "Please enter your email to reset your password.";
        authMessage.style.color = 'red';
        return;
    }

    sendPasswordResetEmail(auth, email)
        .then(() => {
            authMessage.textContent = `Password reset email sent to ${email}. Check your inbox!`;
            authMessage.style.color = 'green';
            authEmailInput.value = "";
            authPasswordInput.value = "";
        })
        .catch((error) => {
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
            console.error("Password reset error:", error);
        });
});


// --- Authentication State Observer (Crucial for loading user data) ---
onAuthStateChanged(auth, async (user) => {
    // Unsubscribe from any existing listeners that are managed here
    if (unsubscribeUserOrders) {
        unsubscribeUserOrders();
        unsubscribeUserOrders = null;
    }
    // Product listener is always active, no need to unsubscribe here.

    // Clean up admin panel if currently active
    if (adminCleanupFunction) {
        adminCleanupFunction();
        adminCleanupFunction = null;
    }

    if (user) {
        currentUserId = user.uid; // Set current user ID
        isAdmin = (currentUserId === ADMIN_UID); // Check if current user is admin

        userDisplay.textContent = `Welcome, ${user.email}`;
        loginRegisterButton.style.display = "none";
        logoutButton.style.display = "inline-block";
        myOrdersButton.style.display = "inline-block";

        if (isAdmin) {
            adminPanelButton.style.display = "inline-block"; // Show Admin Panel button
            // Dynamically import and initialize admin module
            if (!initAdminPanelModule) {
                try {
                    // Ensure the path is correct relative to script.js
                    const adminModule = await import('./admin.js');
                    initAdminPanelModule = adminModule.initAdminPanel;
                    adminCleanupFunction = adminModule.cleanupAdminPanel; // Get cleanup function
                } catch (error) {
                    console.error("Error loading admin.js:", error);
                    // Hide admin button if load fails
                    adminPanelButton.style.display = "none";
                }
            }
            if (initAdminPanelModule) {
                // Pass Firestore and Auth instances, plus user info to admin module
                initAdminPanelModule(db, auth, currentUserId, isAdmin);
            }
        } else {
            adminPanelButton.style.display = "none";
        }

        robloxUsernameInput.style.display = "block";

        await loadCartFromFirestore(currentUserId);
        await syncCartOnLogin(currentUserId);

        // FIX: Change the listener for user orders to the ALL_ORDERS_COLLECTION_PATH
        // and filter by userId. This ensures updates from admin.js (which likely
        // updates only the allOrders collection) are reflected for the user.
        unsubscribeUserOrders = setupUserOrderHistoryListener(currentUserId);

    } else {
        currentUserId = null;
        isAdmin = false;

        userDisplay.textContent = "";
        loginRegisterButton.style.display = "inline-block";
        logoutButton.style.display = "none";
        myOrdersButton.style.display = "none";
        adminPanelButton.style.display = "none";

        robloxUsernameInput.style.display = "none";

        cart = loadCartFromLocalStorage();
        userOrders = [];
    }
    authEmailInput.value = "";
    authPasswordInput.value = "";
    authMessage.textContent = "";
    authMessage.style.color = 'red';
    renderCart();
    // Products are always rendered via the setupProductsListener called globally.
});

// --- Firestore Collection Paths ---
const APP_ID = 'tempest-store-app';
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`;
const USER_CARTS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/carts`;
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`; // Kept for reference, but not directly used by listener now
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`;

// --- Product Display (Accessible to all) ---
function setupProductsListener() {
    const productsColRef = collection(db, PRODUCTS_COLLECTION_PATH);
    return onSnapshot(productsColRef, (snapshot) => {
        const fetchedProducts = [];
        snapshot.forEach(doc => {
            fetchedProducts.push({ id: doc.id, ...doc.data() });
        });
        allProducts = fetchedProducts;
        renderProducts(allProducts);
        // Re-render cart on product changes to update prices
        renderCart();
    }, (error) => {
        console.error("Error listening to products:", error);
    });
}

// Call setupProductsListener once when the script loads to always show products
unsubscribeProducts = setupProductsListener();

// --- Cart Persistence (Customer-side) ---
async function saveCartToFirestore(userId, cartData) {
    try {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        await setDoc(userCartRef, { items: JSON.stringify(cartData) });
        console.log("Cart saved to Firestore for user:", userId);
    } catch (e) {
        console.error("Error saving cart to Firestore:", e);
    }
}

async function loadCartFromFirestore(userId) {
    try {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        const docSnap = await getDoc(userCartRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            cart = JSON.parse(data.items || '[]');
            console.log("Cart loaded from Firestore for user:", userId, cart);
        } else {
            cart = [];
            console.log("No cart found in Firestore for user:", userId);
        }
    } catch (e) {
        console.error("Error loading cart from Firestore:", e);
        cart = [];
    }
}

function saveCartToLocalStorage(cartData) {
    localStorage.setItem('tempestStoreCart', JSON.stringify(cartData));
}

function loadCartFromLocalStorage() {
    const storedCart = localStorage.getItem('tempestStoreCart');
    return storedCart ? JSON.parse(storedCart) : [];
}

async function syncCartOnLogin(userId) {
    const localCart = loadCartFromLocalStorage();
    if (localCart.length > 0) {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        const docSnap = await getDoc(userCartRef);
        let firestoreCart = [];
        if (docSnap.exists()) {
            firestoreCart = JSON.parse(docSnap.data().items || '[]');
        }

        localCart.forEach(localItem => {
            const existingItemIndex = firestoreCart.findIndex(item => item.id === localItem.id);
            if (existingItemIndex > -1) {
                firestoreCart[existingItemIndex].quantity += localItem.quantity;
            } else {
                // When syncing, ensure effectivePrice is correctly set based on current product data.
                const productDetails = allProducts.find(p => p.id === localItem.id);
                if (productDetails) {
                    const priceToUse = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                    firestoreCart.push({ ...localItem, effectivePrice: priceToUse });
                } else {
                    // Fallback if product not found (e.g., deleted by admin)
                    firestoreCart.push(localItem);
                }
            }
        });
        cart = firestoreCart;
        await saveCartToFirestore(userId, cart);
        localStorage.removeItem('tempestStoreCart');
        renderCart();
    }
}

// --- Customer Order History (User-side) ---
// FIX: Modified this function to listen to ALL_ORDERS_COLLECTION_PATH
// and filter by the currentUserId. This is the key change for real-time updates.
function setupUserOrderHistoryListener(userId) {
    // Listen to the main 'allOrders' collection
    const allOrdersCollectionRef = collection(db, ALL_ORDERS_COLLECTION_PATH);
    // Query orders that belong to the current user and order them by date
    const q = query(allOrdersCollectionRef, where("userId", "==", userId), orderBy("orderDate", "desc"));

    return onSnapshot(q, (snapshot) => {
        const fetchedOrders = [];
        snapshot.forEach(doc => {
            fetchedOrders.push({ id: doc.id, ...doc.data() });
        });
        userOrders = fetchedOrders;
        renderOrderHistory();
    }, (error) => {
        console.error("Error listening to user order history:", error);
    });
}

// --- Cart Management Functions ---
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        // Ensure effectivePrice is based on product's current sale status/price
        const productDetails = allProducts.find(p => p.id === product.id);
        const priceToUse = productDetails && productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
        cart.push({ ...product, quantity: 1, effectivePrice: priceToUse });
    }
    saveCart();
    renderCart();
    console.log("Cart contents:", cart);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

function updateCartQuantity(productId, newQuantity) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = Math.max(1, newQuantity);
        saveCart();
        renderCart();
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

function updateCartCountBadge() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountBadge.textContent = totalItems;
    cartCountBadge.style.display = totalItems > 0 ? 'inline-block' : 'none';

    const { total } = calculateCartTotals();
    placeOrderBtn.textContent = `Place Order (${totalItems} item${totalItems !== 1 ? 's' : ''}) ₱${total.toFixed(2)}`;

    placeOrderBtn.disabled = totalItems === 0 || (currentUserId && robloxUsernameInput.value.trim() === '');
}

function renderCart() {
    cartItemsContainer.innerHTML = '';

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
    } else {
        cart.forEach(item => {
            // Find the latest product details from allProducts
            const productDetails = allProducts.find(p => p.id === item.id);
            let priceToDisplay;
            if (productDetails) {
                priceToDisplay = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                // Update item's effectivePrice in cart to match latest
                item.effectivePrice = priceToDisplay;
            } else {
                // Fallback if product is no longer found (e.g., deleted by admin)
                priceToDisplay = item.effectivePrice || item.price;
            }

            const imageUrl = `images/${item.image}`;
            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'cart-item';
            cartItemDiv.innerHTML = `
                        <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/f0f0f0/888?text=Image%20N/A';" />
                        <div class="cart-item-details">
                            <h4>${item.name}</h4>
                            <div class="cart-item-price">${priceToDisplay}</div>
                        </div>
                        <div class="cart-item-quantity-control">
                            <button data-id="${item.id}" data-action="decrease">-</button>
                            <input type="number" value="${item.quantity}" min="1" data-id="${item.id}">
                            <button data-id="${item.id}" data-action="increase">+</button>
                        </div>
                        <button class="cart-item-remove" data-id="${item.id}">&times;</button>
                    `;
            cartItemsContainer.appendChild(cartItemDiv);
        });

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
}

function calculateCartTotals() {
    let subtotal = 0;
    let totalItemsInCart = 0;
    cart.forEach(item => {
        // IMPORTANT: Use the effectivePrice from the cart item, which is updated in renderCart()
        // or fall back to item.price if effectivePrice isn't set (shouldn't happen with updated logic)
        const priceValue = parseFloat((item.effectivePrice || item.price).toString().replace('₱', '')); // Ensure price is a string before replace
        subtotal += priceValue * item.quantity;
        totalItemsInCart += item.quantity;
    });

    const total = subtotal;

    cartSubtotalSpan.textContent = `₱${total.toFixed(2)}`; // Updated to use total consistently
    cartTotalSpan.textContent = `₱${total.toFixed(2)}`;

    return { subtotal, total, totalItemsInCart };
}

// --- Cart Modal Event Listeners ---
cartIconBtn.addEventListener('click', () => {
    cartModal.classList.add('show');
    renderCart();
    robloxUsernameInput.style.display = currentUserId ? 'block' : 'none';
    updateCartCountBadge();
});

closeCartModalBtn.addEventListener('click', () => {
    cartModal.classList.remove('show');
});

cartModal.addEventListener('click', (event) => {
    if (event.target === cartModal) {
        cartModal.classList.remove('show');
    }
});

robloxUsernameInput.addEventListener('input', updateCartCountBadge);

// Handles the process of placing an order.
placeOrderBtn.addEventListener('click', async () => {
    if (cart.length === 0) {
        alert("Your cart is empty. Please add items before placing an order.");
        return;
    }

    const robloxUsername = robloxUsernameInput.value.trim();

    placeOrderBtn.disabled = true;

    try {
        if (!currentUserId) {
            authModal.classList.add('show');
            authMessage.textContent = "Please login or register to complete your order.";
            authEmailInput.value = "";
            authPasswordInput.value = "";
            placeOrderBtn.disabled = false;
            return;
        }

        if (robloxUsername === '') {
            alert("Please enter your Roblox Username to proceed with the order.");
            placeOrderBtn.disabled = false;
            return;
        }

        // Recalculate totals right before placing order with latest effective prices
        const { subtotal, total } = calculateCartTotals();
        const orderDetails = {
            userId: currentUserId,
            // Deep copy cart items to ensure order details are immutable if cart changes later
            // Items in cart will have updated effectivePrice from renderCart()
            items: JSON.parse(JSON.stringify(cart)),
            subtotal: subtotal,
            total: total,
            orderDate: new Date().toISOString(),
            status: 'Pending',
            paymentMethod: document.querySelector('input[name="payment-method"]:checked').value,
            robloxUsername: robloxUsername
        };

        console.log("Placing Order:", orderDetails);

        // Add to user-specific orders collection
        const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(currentUserId));
        const userOrderDocRef = await addDoc(userOrdersColRef, orderDetails);

        // Add to allOrders collection with the same ID
        const allOrdersColRef = collection(db, ALL_ORDERS_COLLECTION_PATH);
        // Using setDoc with userOrderDocRef.id to ensure both documents have the same ID
        await setDoc(doc(allOrdersColRef, userOrderDocRef.id), orderDetails);

        alert("Successfully Placed Order!");
        console.log("Order saved to Firestore!");

        cart = [];
        saveCart();
        renderCart();
        cartModal.classList.remove('show');
        robloxUsernameInput.value = '';

    } catch (e) {
        console.error("Error placing order to Firestore:", e);
        alert("There was an error placing your order. Please try again.");
    } finally {
        placeOrderBtn.disabled = false;
    }
});


// --- Order History Functions (User-side) ---
myOrdersButton.addEventListener('click', () => {
    if (!currentUserId) {
        alert("Please log in to view your order history.");
        return;
    }
    orderHistoryModal.classList.add('show');
    orderHistoryTitle.textContent = "My Orders";
    orderHistoryList.style.display = 'block';
    orderDetailsView.style.display = 'none';
    renderOrderHistory();
});

closeOrderHistoryModalBtn.addEventListener('click', () => {
    orderHistoryModal.classList.remove('show');
});

orderHistoryModal.addEventListener('click', (event) => {
    if (event.target === orderHistoryModal) {
        orderHistoryModal.classList.remove('show');
    }
});

backToOrderListBtn.addEventListener('click', () => {
    orderHistoryList.style.display = 'block';
    orderDetailsView.style.display = 'none';
    orderHistoryTitle.textContent = "My Orders";
    renderOrderHistory();
});

function renderOrderHistory() {
    orderHistoryList.innerHTML = '';

    if (userOrders.length === 0) {
        orderHistoryList.innerHTML = '<p class="empty-message">No orders found.</p>';
        return;
    }

    userOrders.forEach(order => {
        const orderItemDiv = document.createElement('div');
        orderItemDiv.className = 'order-item';
        // Add a class based on status for styling
        orderItemDiv.classList.add(`order-status-${order.status.toLowerCase().replace(/\s/g, '-')}`);

        const orderDate = new Date(order.orderDate);
        const formattedDate = orderDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = orderDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

        orderItemDiv.innerHTML = `
                    <div class="order-item-info">
                        <strong>Order ID: ${order.id.substring(0, 8)}...</strong>
                        <span>Date: ${formattedDate} ${formattedTime}</span>
                        <span class="order-status ${order.status.toLowerCase().replace(/\s/g, '-')}">Status: ${order.status}</span>
                        <span>Total: ₱${order.total.toFixed(2)}</span>
                    </div>
                    <button class="view-order-details-btn" data-order-id="${order.id}">View Details</button>
                `;
        orderHistoryList.appendChild(orderItemDiv);
    });

    orderHistoryList.querySelectorAll('.view-order-details-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const orderId = event.target.dataset.orderId;
            showOrderDetails(orderId);
        });
    });
}

function showOrderDetails(orderId) {
    const order = userOrders.find(o => o.id === orderId);
    if (!order) {
        console.error("Order not found:", orderId);
        return;
    }

    orderHistoryList.style.display = 'none';
    orderDetailsView.style.display = 'block';
    orderHistoryTitle.textContent = `Order Details #${order.id.substring(0, 8)}...`;

    detailOrderId.textContent = order.id;
    const orderDate = new Date(order.orderDate);
    detailOrderDate.textContent = orderDate.toLocaleDateString() + ' ' + orderDate.toLocaleTimeString();
    detailOrderStatus.textContent = order.status;
    // Add class for status styling
    detailOrderStatus.className = `status-badge ${order.status.toLowerCase().replace(/\s/g, '-')}`;
    detailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
    detailPaymentMethod.textContent = order.paymentMethod;
    detailRobloxUsername.textContent = order.robloxUsername;

    detailItemsList.innerHTML = '';
    order.items.forEach(item => {
        const listItem = document.createElement('li');
        listItem.textContent = `${item.name} x ${item.quantity} (₱${(parseFloat(item.effectivePrice.toString().replace('₱', '')) * item.quantity).toFixed(2)})`;
        detailItemsList.appendChild(listItem);
    });
}


// --- Initial calls ---
// Initial rendering of cart based on local storage before authentication state is known
// This is moved inside onAuthStateChanged for better flow, but can be kept here too
// if you want to ensure the cart icon badge is accurate even before login check completes fully.
// renderCart(); // This call is now primarily handled by onAuthStateChanged.
updateCartCountBadge(); // Ensure cart count is displayed correctly on initial load
