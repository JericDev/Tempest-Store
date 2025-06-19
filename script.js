// Import necessary Firebase functions
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy, // Re-added orderBy for admin orders where it's explicitly needed and can trigger index suggestions
    serverTimestamp // Import serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- Firebase Initialization and Global Variables ---
let app;
let db;
let auth;
let currentUserId = null; // To store the authenticated user's ID
let unsubscribeProductListener; // To store the unsubscribe function for products
let unsubscribeUserOrderListener; // To store the unsubscribe function for user-specific orders
let unsubscribeAdminOrderListener; // To store the unsubscribe function for admin-specific orders
let unsubscribeStoreSettingsListener; // To store the unsubscribe function for store settings

// Explicitly define appId to match Firebase rules' getAppId() function
const appId = "tempest-store-app";
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// Initialize Firebase
if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Sign in anonymously or with custom token
    if (typeof __initial_auth_token !== 'undefined') {
        signInWithCustomToken(auth, __initial_auth_token)
            .then(() => {
                console.log('Signed in with custom token.');
            })
            .catch((error) => {
                console.error('Error signing in with custom token:', error);
                // Fallback to anonymous if custom token fails
                signInAnonymously(auth)
                    .then(() => console.log('Signed in anonymously.'))
                    .catch((anonError) => console.error('Error signing in anonymously:', anonError));
            });
    } else {
        signInAnonymously(auth)
            .then(() => console.log('Signed in anonymously.'))
            .catch((error) => console.error('Error signing in anonymously:', error));
    }
} else {
    console.error("Firebase config is not provided. Firebase will not be initialized.");
}

// --- Auth State Change Listener ---
onAuthStateChanged(auth, (user) => {
    const userDisplay = document.getElementById('user-display');
    const loginRegisterButton = document.getElementById('login-register-button');
    const logoutButton = document.getElementById('logout-button');
    const myOrdersButton = document.getElementById('my-orders-button');
    const adminPanelButton = document.getElementById('admin-panel-button');

    if (user) {
        currentUserId = user.uid;
        userDisplay.textContent = `Welcome, User ${user.uid.substring(0, 8)}...`; // Displaying a truncated user ID
        loginRegisterButton.style.display = 'none';
        logoutButton.style.display = 'inline-block';
        myOrdersButton.style.display = 'inline-block';

        // Check if the user is an admin
        checkAdminStatus(user.uid).then(isAdmin => {
            if (isAdmin) {
                adminPanelButton.style.display = 'inline-block';
                // Start listening for store settings and admin orders only for admins
                listenForStoreSettings();
                listenForAdminOrders(); // Start admin order listener
            } else {
                adminPanelButton.style.display = 'none';
                if (unsubscribeStoreSettingsListener) {
                    unsubscribeStoreSettingsListener(); // Unsubscribe if not admin
                }
                if (unsubscribeAdminOrderListener) {
                    unsubscribeAdminOrderListener(); // Unsubscribe if not admin
                }
            }
        });

        // Start real-time listeners for products and user-specific orders for all logged-in users
        listenForProducts();
        listenForUserOrders(user.uid);
    } else {
        currentUserId = null;
        userDisplay.textContent = '';
        loginRegisterButton.style.display = 'inline-block';
        logoutButton.style.display = 'none';
        myOrdersButton.style.display = 'none';
        adminPanelButton.style.display = 'none';

        // Clear products and orders display when logged out
        renderProducts([]);
        document.getElementById('admin-products-list').innerHTML = '<tr><td colspan="7" class="empty-message">No products found.</td></tr>';
        document.getElementById('order-history-list').innerHTML = '<p class="empty-message">No orders found.</p>';
        document.getElementById('admin-orders-list').innerHTML = '<tr><td colspan="6" class="empty-message">No orders found.</td></tr>';

        // Unsubscribe from real-time updates when logged out
        if (unsubscribeProductListener) {
            unsubscribeProductListener();
        }
        if (unsubscribeUserOrderListener) { // Corrected variable name
            unsubscribeUserOrderListener();
        }
        if (unsubscribeAdminOrderListener) {
            unsubscribeAdminOrderListener();
        }
        if (unsubscribeStoreSettingsListener) {
            unsubscribeStoreSettingsListener();
        }

        // Reset cart display when logged out
        saveCartItems([]); // Clear cart in local storage
        updateCartDisplay();
        document.getElementById('place-order-btn').textContent = 'Place Order (0 items) ₱0.00';
    }
});

// --- Admin Status Check ---
async function checkAdminStatus(uid) {
    try {
        // Admin ID is hardcoded in rules, so we can just check against that.
        // For a more dynamic admin system, you might fetch from a 'admins' collection.
        // Based on the rules, "LigBezoWV9eVo8lglsijoWinKmA2" is the admin.
        return uid === "LigBezoWV9eVo8lglsijoWinKmA2";
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

// --- Modals and UI Elements ---
const authModal = document.getElementById('auth-modal');
const closeAuthModalBtn = document.getElementById('close-auth-modal');
const loginRegisterButton = document.getElementById('login-register-button');
const registerButton = document.getElementById('register-button');
const loginButton = document.getElementById('login-button');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authMessage = document.getElementById('auth-message');
const logoutButton = document.getElementById('logout-button');
const forgotPasswordButton = document.getElementById('forgot-password-button');

const cartModal = document.getElementById('cart-modal');
const cartIconButton = document.getElementById('cart-icon-btn');
const closeCartModalBtn = document.getElementById('close-cart-modal');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartCountBadge = document.getElementById('cart-count');
const cartSubtotalSpan = document.getElementById('cart-subtotal');
const cartTotalSpan = document.getElementById('cart-total');
const placeOrderBtn = document.getElementById('place-order-btn');
const robloxUsernameInput = document.getElementById('roblox-username-input');

const orderHistoryModal = document.getElementById('order-history-modal');
const myOrdersButton = document.getElementById('my-orders-button');
const closeOrderHistoryModalBtn = document.getElementById('close-order-history-modal');
const orderHistoryList = document.getElementById('order-history-list');
const orderDetailsView = document.getElementById('order-details-view');
const backToOrderListBtn = document.getElementById('back-to-order-list');

const adminPanelModal = document.getElementById('admin-panel-modal');
const adminPanelButton = document.getElementById('admin-panel-button');
const closeAdminPanelModalBtn = document.getElementById('close-admin-panel-modal');
const adminTabs = document.querySelector('.admin-tabs');
const adminProductManagement = document.getElementById('admin-product-management');
const adminOrderManagement = document.getElementById('admin-order-management');
const adminSiteSettings = document.getElementById('admin-site-settings');

const productFormContainer = document.getElementById('product-form-container');
const productIdInput = document.getElementById('product-id-input');
const productNameInput = document.getElementById('product-name');
const productCategorySelect = document.getElementById('product-category');
const productPriceInput = document.getElementById('product-price');
const productSalePriceInput = document.getElementById('product-sale-price'); // New
const productStockInput = document.getElementById('product-stock');
const productImageInput = document.getElementById('product-image');
const productNewCheckbox = document.getElementById('product-new'); // New
const productSaleCheckbox = document.getElementById('product-sale'); // New
const saveProductBtn = document.getElementById('save-product-btn');
const cancelEditProductBtn = document.getElementById('cancel-edit-product');
const productFormTitle = document.getElementById('product-form-title');
const adminProductsList = document.getElementById('admin-products-list');

const adminOrdersList = document.getElementById('admin-orders-list');
const adminOrderDetailsView = document.getElementById('admin-order-details-view');
const adminBackToOrderListBtn = document.getElementById('admin-back-to-order-list');
const orderStatusSelect = document.getElementById('order-status-select');
const updateOrderStatusBtn = document.getElementById('update-order-status-btn');

const sellerOnlineToggle = document.getElementById('seller-online-toggle');
const sellerStatusText = document.getElementById('seller-status-text');
const sellerStatusDisplay = document.getElementById('seller-status-display'); // For the main page display


// --- Event Listeners ---
loginRegisterButton.addEventListener('click', () => {
    authModal.classList.add('show');
    authMessage.textContent = ''; // Clear previous messages
});
closeAuthModalBtn.addEventListener('click', () => authModal.classList.remove('show'));

registerButton.addEventListener('click', handleRegister);
loginButton.addEventListener('click', handleLogin);
logoutButton.addEventListener('click', handleLogout);
forgotPasswordButton.addEventListener('click', handleForgotPassword);

cartIconButton.addEventListener('click', () => {
    cartModal.classList.add('show');
    updateCartDisplay();
});
closeCartModalBtn.addEventListener('click', () => cartModal.classList.remove('show'));

placeOrderBtn.addEventListener('click', placeOrder);

myOrdersButton.addEventListener('click', () => {
    orderHistoryModal.classList.add('show');
    displayUserOrders();
});
closeOrderHistoryModalBtn.addEventListener('click', () => {
    orderHistoryModal.classList.remove('show');
    // Hide details view and show list when closing modal
    orderDetailsView.style.display = 'none';
    orderHistoryList.style.display = 'block';
    document.getElementById('order-history-title').textContent = 'My Orders';
});
backToOrderListBtn.addEventListener('click', () => {
    orderDetailsView.style.display = 'none';
    orderHistoryList.style.display = 'block';
    document.getElementById('order-history-title').textContent = 'My Orders';
});

adminPanelButton.addEventListener('click', () => {
    adminPanelModal.classList.add('show');
    // Ensure product management is the default view
    showAdminTab('products');
});
closeAdminPanelModalBtn.addEventListener('click', () => {
    adminPanelModal.classList.remove('show');
    adminOrderDetailsView.style.display = 'none'; // Hide order details on close
});

adminTabs.addEventListener('click', (event) => {
    if (event.target.classList.contains('admin-tab-btn')) {
        const tab = event.target.dataset.tab;
        showAdminTab(tab);
    }
});

saveProductBtn.addEventListener('click', handleSaveProduct);
cancelEditProductBtn.addEventListener('click', () => {
    resetProductForm();
    cancelEditProductBtn.style.display = 'none';
});

// Event listener for product table actions (edit/delete)
adminProductsList.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('edit')) {
        const productId = target.closest('tr').dataset.productId;
        editProduct(productId);
    } else if (target.classList.contains('delete')) {
        const productId = target.closest('tr').dataset.productId;
        showConfirmModal('Are you sure you want to delete this product?', () => deleteProduct(productId));
    }
});

// Event listener for order table actions (view)
adminOrdersList.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('view')) {
        const orderId = target.closest('tr').dataset.orderId;
        viewAdminOrderDetails(orderId);
    }
    // Prevent default anchor behavior
    event.preventDefault();
});

adminBackToOrderListBtn.addEventListener('click', () => {
    adminOrderDetailsView.style.display = 'none';
    adminOrderManagement.style.display = 'block';
});

updateOrderStatusBtn.addEventListener('click', handleUpdateOrderStatus);

// Payment method image update
document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
    radio.addEventListener('change', (event) => {
        const paymentPreviewImg = document.getElementById('payment-preview-img');
        const selectedMethod = event.target.value;
        if (selectedMethod === 'GCash') {
            paymentPreviewImg.src = 'images/gcash.png';
        } else if (selectedMethod === 'Maya') {
            paymentPreviewImg.src = 'images/maya.png';
        } else if (selectedMethod === 'Paypal') {
            paymentPreviewImg.src = 'images/paypal.png';
        }
    });
});

// Search and Filter functionality
document.getElementById('searchBox').addEventListener('input', filterProducts);
document.querySelectorAll('.filters button').forEach(button => {
    button.addEventListener('click', function() {
        // Remove active class from all filter buttons
        document.querySelectorAll('.filters button').forEach(btn => btn.classList.remove('active'));
        // Add active class to the clicked button
        this.classList.add('active');
        filterProducts();
    });
});

// Seller status toggle listener
if (sellerOnlineToggle) {
    sellerOnlineToggle.addEventListener('change', async function() {
        const newStatus = this.checked;
        await updateStoreSettings({ isSellerOnline: newStatus });
    });
}


// --- Authentication Functions ---
async function handleRegister() {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    authMessage.textContent = ''; // Clear previous messages

    if (!email || !password) {
        showCustomAlert('Please enter both email and password.');
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showCustomAlert('Registration successful! You are now logged in.');
        authModal.classList.remove('show');
    } catch (error) {
        console.error('Error registering:', error.message);
        showCustomAlert(`Registration failed: ${error.message}`);
    }
}

async function handleLogin() {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    authMessage.textContent = ''; // Clear previous messages

    if (!email || !password) {
        showCustomAlert('Please enter both email and password.');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showCustomAlert('Login successful!');
        authModal.classList.remove('show');
    } catch (error) {
        console.error('Error logging in:', error.message);
        showCustomAlert(`Login failed: ${error.message}`);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        console.log('User logged out.');
        // UI will update via onAuthStateChanged listener
    } catch (error) {
        console.error('Error logging out:', error.message);
    }
}

async function handleForgotPassword() {
    const email = authEmailInput.value;
    if (!email) {
        showCustomAlert('Please enter your email to reset password.');
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        showCustomAlert('Password reset email sent! Check your inbox.');
    } catch (error) {
        console.error('Error sending password reset email:', error.message);
        showCustomAlert(`Password reset failed: ${error.message}`);
    }
}

// --- Product Listing and Cart Functions ---
let allProducts = []; // Cache for all products
let currentFilters = { category: 'all', searchTerm: '' };

function listenForProducts() {
    // Unsubscribe from previous listener if it exists
    if (unsubscribeProductListener) {
        unsubscribeProductListener();
    }

    // Updated path to match Firestore rules
    const productsCollectionRef = collection(db, "artifacts", appId, "products");
    unsubscribeProductListener = onSnapshot(productsCollectionRef, (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort products in memory, e.g., by name
        allProducts.sort((a, b) => a.name.localeCompare(b.name));
        filterProducts(); // Re-filter and render products whenever data changes
        renderAdminProducts(allProducts); // Also update admin panel product list
    }, (error) => {
        console.error("Error fetching products:", error);
    });
}

function renderProducts(productsToRender) {
    const productList = document.getElementById('product-list');
    productList.innerHTML = ''; // Clear existing products

    if (productsToRender.length === 0) {
        productList.innerHTML = '<p class="empty-message">No products match your criteria.</p>';
        return;
    }

    productsToRender.forEach(product => {
        const card = document.createElement('div');
        card.classList.add('card');
        if (product.stock === 0) {
            card.classList.add('out-of-stock');
        }

        const priceDisplay = product.onSale && product.salePrice !== undefined && product.salePrice < product.price
            ? `<span style="text-decoration: line-through; color: #888;">₱${product.price.toFixed(2)}</span> <span class="price">₱${product.salePrice.toFixed(2)}</span>`
            : `<span class="price">₱${product.price.toFixed(2)}</span>`;

        const stockInfoClass = product.stock > 0 ? 'in-stock' : 'out-of-stock-text';
        const stockInfoText = product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock';

        card.innerHTML = `
            ${product.isNew ? '<span class="badge new">NEW</span>' : ''}
            ${product.onSale ? '<span class="badge sale" style="left:auto; right:15px;">SALE</span>' : ''}
            <img src="images/${product.image}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/160x160/cccccc/000000?text=No+Image';" />
            <h3>${product.name}</h3>
            <p>${priceDisplay}</p>
            <p class="stock-info ${stockInfoClass}">${stockInfoText}</p>
            <button class="add-to-cart-btn" data-product-id="${product.id}" ${product.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
        `;
        productList.appendChild(card);
    });

    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            addToCart(productId);
        });
    });
}

function filterProducts() {
    const activeCategoryButton = document.querySelector('.filters button.active');
    const category = activeCategoryButton ? activeCategoryButton.dataset.cat : 'all';
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();

    let filtered = allProducts;

    if (category !== 'all') {
        filtered = filtered.filter(product => product.category === category);
    }

    if (searchTerm) {
        filtered = filtered.filter(product =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.category.toLowerCase().includes(searchTerm)
        );
    }
    renderProducts(filtered);
}

function getCartItems() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    return cart;
}

function saveCartItems(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartDisplay();
}

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }

    let cart = getCartItems();
    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        // Check if adding more would exceed stock
        if (existingItem.quantity + 1 > product.stock) {
            showCustomAlert(`Cannot add more "${product.name}". Only ${product.stock} left in stock.`);
            return;
        }
        existingItem.quantity++;
    } else {
        // Check if initial add exceeds stock (should be handled by disabled button, but good to double check)
        if (product.stock === 0) {
            showCustomAlert(`"${product.name}" is out of stock and cannot be added to cart.`);
            return;
        }
        cart.push({
            id: product.id,
            name: product.name,
            price: product.onSale && product.salePrice !== undefined && product.salePrice < product.price ? product.salePrice : product.price,
            quantity: 1,
            image: product.image,
            category: product.category // Include category for order processing
        });
    }
    saveCartItems(cart);
}

function updateCartItemQuantity(productId, newQuantity) {
    let cart = getCartItems();
    const product = allProducts.find(p => p.id === productId);
    const itemIndex = cart.findIndex(item => item.id === productId);

    if (itemIndex > -1 && product) {
        if (newQuantity <= 0) {
            // Remove item if quantity is 0 or less
            cart.splice(itemIndex, 1);
        } else if (newQuantity > product.stock) {
            // Prevent increasing quantity beyond stock
            showCustomAlert(`Cannot set quantity to ${newQuantity} for "${product.name}". Only ${product.stock} left in stock.`);
            cart[itemIndex].quantity = product.stock; // Set to max available stock
        } else {
            cart[itemIndex].quantity = newQuantity;
        }
    }
    saveCartItems(cart);
}

function removeCartItem(productId) {
    let cart = getCartItems();
    cart = cart.filter(item => item.id !== productId);
    saveCartItems(cart);
}

function updateCartDisplay() {
    const cart = getCartItems();
    cartItemsContainer.innerHTML = ''; // Clear current display
    let subtotal = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
        robloxUsernameInput.style.display = 'none'; // Hide Roblox username input if cart is empty
    } else {
        robloxUsernameInput.style.display = 'block'; // Show Roblox username input if cart has items
        cart.forEach(item => {
            const cartItemDiv = document.createElement('div');
            cartItemDiv.classList.add('cart-item');
            const itemTotalPrice = item.price * item.quantity;
            subtotal += itemTotalPrice;

            cartItemDiv.innerHTML = `
                <img src="images/${item.image}" alt="${item.name}" onerror="this.onerror=null;this.src='https://placehold.co/80x80/cccccc/000000?text=No+Image';">
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p class="cart-item-price">₱${item.price.toFixed(2)}</p>
                </div>
                <div class="cart-item-quantity-control">
                    <button class="decrease-qty" data-product-id="${item.id}">-</button>
                    <input type="number" value="${item.quantity}" min="1" data-product-id="${item.id}">
                    <button class="increase-qty" data-product-id="${item.id}">+</button>
                </div>
                <button class="cart-item-remove" data-product-id="${item.id}">&times;</button>
            `;
            cartItemsContainer.appendChild(cartItemDiv);
        });
    }

    // Add event listeners for quantity controls and remove buttons
    cartItemsContainer.querySelectorAll('.decrease-qty').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const input = event.target.nextElementSibling;
            let newQuantity = parseInt(input.value) - 1;
            updateCartItemQuantity(productId, newQuantity);
        });
    });

    cartItemsContainer.querySelectorAll('.increase-qty').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const input = event.target.previousElementSibling;
            let newQuantity = parseInt(input.value) + 1;
            updateCartItemQuantity(productId, newQuantity);
        });
    });

    cartItemsContainer.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('change', (event) => {
            const productId = event.target.dataset.productId;
            let newQuantity = parseInt(event.target.value);
            if (isNaN(newQuantity) || newQuantity < 1) {
                newQuantity = 1; // Default to 1 if invalid input
            }
            updateCartItemQuantity(productId, newQuantity);
        });
    });

    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            removeCartItem(productId);
        });
    });

    const total = subtotal; // For now, total is same as subtotal, add taxes/shipping later if needed
    cartSubtotalSpan.textContent = `₱${subtotal.toFixed(2)}`;
    cartTotalSpan.textContent = `₱${total.toFixed(2)}`;
    cartCountBadge.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);

    placeOrderBtn.textContent = `Place Order (${cart.reduce((sum, item) => sum + item.quantity, 0)} items) ₱${total.toFixed(2)}`;
}

// --- Stock Deduction Function ---
async function deductProductStock(productId, quantityOrdered) {
    try {
        // Updated path to match Firestore rules
        const productRef = doc(db, "artifacts", appId, "products", productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            const currentStock = productSnap.data().stock;
            // This check should ideally be redundant due to the pre-check in placeOrder,
            // but it acts as a safeguard.
            if (currentStock >= quantityOrdered) {
                const newStock = currentStock - quantityOrdered;
                await updateDoc(productRef, {
                    stock: newStock
                });
                console.log(`Stock for product ${productId} updated to ${newStock}`);
            } else {
                console.warn(`Attempted to deduct stock for product ${productId} but insufficient stock. Current: ${currentStock}, Ordered: ${quantityOrdered}`);
                // This shouldn't happen if the pre-check works, but good to log.
            }
        } else {
            console.error(`Product with ID ${productId} not found for stock deduction.`);
        }
    } catch (error) {
        console.error("Error deducting stock:", error);
    }
}


// --- Place Order Function ---
async function placeOrder() {
    const cartItems = getCartItems();
    const robloxUsername = robloxUsernameInput.value.trim();
    const selectedPaymentMethod = document.querySelector('input[name="payment-method"]:checked');

    if (!currentUserId) {
        showCustomAlert('You must be logged in to place an order.');
        return;
    }

    if (cartItems.length === 0) {
        showCustomAlert('Your cart is empty. Please add items before placing an order.');
        return;
    }

    if (robloxUsernameInput.style.display !== 'none' && !robloxUsername) {
        showCustomAlert('Please enter your Roblox Username.');
        return;
    }

    if (!selectedPaymentMethod) {
        showCustomAlert('Please select a payment method.');
        return;
    }

    // --- NEW: Pre-order stock validation ---
    for (const item of cartItems) {
        const productInCache = allProducts.find(p => p.id === item.id);
        if (!productInCache) {
            showCustomAlert(`Error: Product "${item.name}" not found in our catalog. Please try refreshing.`);
            return;
        }
        if (productInCache.stock === 0) {
            showCustomAlert(`"${item.name}" is out of stock. Please remove it from your cart or reduce quantity.`);
            return;
        }
        if (productInCache.stock < item.quantity) {
            showCustomAlert(`Insufficient stock for "${item.name}". Only ${productInCache.stock} available. Please reduce quantity.`);
            return;
        }
    }
    // --- END NEW: Pre-order stock validation ---


    // Show confirmation modal before placing the order
    showConfirmModal('Are you sure you want to place this order?', async () => {
        try {
            // Prepare order data
            const orderData = {
                userId: currentUserId,
                items: cartItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image,
                    category: item.category,
                })),
                totalPrice: parseFloat(cartTotalSpan.textContent.replace('₱', '')),
                paymentMethod: selectedPaymentMethod.value,
                robloxUsername: robloxUsername,
                status: 'Pending',
                timestamp: serverTimestamp() // Use server timestamp for consistency
            };

            // Add order to user's specific orders collection
            const userOrderDocRef = await addDoc(collection(db, "artifacts", appId, "users", currentUserId, "orders"), orderData);
            const orderId = userOrderDocRef.id; // Get the ID generated by Firestore

            // Add the same order to the allOrders collection for admin view
            // Using setDoc with doc() to ensure the same ID is used for both
            await setDoc(doc(db, "artifacts", appId, "allOrders", orderId), {
                ...orderData, // Spread existing order data
                orderId: orderId // Explicitly add orderId to the allOrders document
            });


            // Deduct stock for each item in the order
            // This is done AFTER the order is successfully saved to ensure data integrity
            for (const item of cartItems) {
                await deductProductStock(item.id, item.quantity);
            }

            // Clear the cart after successful order
            saveCartItems([]);
            robloxUsernameInput.value = ''; // Clear username input

            showCustomAlert('Order placed successfully!');
            cartModal.classList.remove('show');
        } catch (error) {
            console.error('Error placing order:', error);
            showCustomAlert('Failed to place order. Please try again.');
        }
    });
}


// --- Order History Functions (User View) ---
function listenForUserOrders(uid) {
    if (unsubscribeUserOrderListener) { // Corrected variable name
        unsubscribeUserOrderListener();
    }

    const q = query(
        collection(db, "artifacts", appId, "users", uid, "orders")
    );

    unsubscribeUserOrderListener = onSnapshot(q, (snapshot) => { // Corrected variable name
        let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort orders in memory by timestamp in descending order (newest first)
        orders.sort((a, b) => {
            const dateA = a.timestamp ? a.timestamp.toDate() : new Date(0); // Handle potential missing timestamp
            const dateB = b.timestamp ? b.timestamp.toDate() : new Date(0);
            return dateB.getTime() - dateA.getTime(); // Sort descending
        });

        displayUserOrders(orders); // Re-render orders when data changes
        // Admin orders are now rendered by listenForAdminOrders, not here
    }, (error) => {
        console.error("Error fetching user orders:", error);
    });
}

function displayUserOrders(orders = []) {
    orderHistoryList.innerHTML = ''; // Clear existing orders

    if (orders.length === 0) {
        orderHistoryList.innerHTML = '<p class="empty-message">No orders found.</p>';
        return;
    }

    orders.forEach(order => {
        const orderItemDiv = document.createElement('div');
        orderItemDiv.classList.add('order-item');
        orderItemDiv.dataset.orderId = order.id;

        const timestampDate = order.timestamp ? new Date(order.timestamp.toDate()) : new Date(); // Convert Firestore Timestamp to Date object
        const formattedDate = timestampDate.toLocaleString(); // Format as local string

        const statusClass = order.status.toLowerCase().replace(/\s/g, '-');

        orderItemDiv.innerHTML = `
            <div class="order-item-info">
                <strong>Order ID: ${order.id.substring(0, 8)}...</strong>
                <span>Date: ${formattedDate}</span>
                <span>Total: ₱${order.totalPrice.toFixed(2)}</span>
                <span class="order-item-status status-${statusClass}">${order.status}</span>
            </div>
            <button class="view-details-btn" data-order-id="${order.id}">View Details</button>
        `;
        orderHistoryList.appendChild(orderItemDiv);
    });

    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const orderId = event.target.dataset.orderId;
            viewOrderDetails(orderId);
        });
    });
}

async function viewOrderDetails(orderId) {
    try {
        const orderDocRef = doc(db, "artifacts", appId, "users", currentUserId, "orders", orderId);
        const orderDocSnap = await getDoc(orderDocRef);

        if (orderDocSnap.exists()) {
            const order = { id: orderDocSnap.id, ...orderDocSnap.data() };
            document.getElementById('detail-order-id').textContent = order.id;
            document.getElementById('detail-order-date').textContent = order.timestamp ? new Date(order.timestamp.toDate()).toLocaleString() : 'N/A';
            document.getElementById('detail-order-status').textContent = order.status;
            document.getElementById('detail-order-price').textContent = `₱${order.totalPrice.toFixed(2)}`;
            document.getElementById('detail-payment-method').textContent = order.paymentMethod;
            document.getElementById('detail-roblox-username').textContent = order.robloxUsername || 'Not provided';

            const detailItemsList = document.getElementById('detail-items-list');
            detailItemsList.innerHTML = '';
            order.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('order-detail-item');
                itemDiv.innerHTML = `
                    <span class="order-detail-item-name">${item.name}</span>
                    <span class="order-detail-item-qty-price">${item.quantity} x ₱${item.price.toFixed(2)}</span>
                `;
                detailItemsList.appendChild(itemDiv);
            });

            orderHistoryList.style.display = 'none';
            orderDetailsView.style.display = 'block';
            document.getElementById('order-history-title').textContent = 'Order Details';

        } else {
            console.log("No such order!");
            showCustomAlert("Order details not found.");
        }
    } catch (error) {
        console.error("Error fetching order details:", error);
        showCustomAlert("Failed to load order details.");
    }
}


// --- Admin Panel Functions ---
function showAdminTab(tabName) {
    // Hide all tab contents
    adminProductManagement.style.display = 'none';
    adminOrderManagement.style.display = 'none';
    adminSiteSettings.style.display = 'none';

    // Remove active class from all buttons
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));

    // Show the selected tab content and add active class to its button
    if (tabName === 'products') {
        adminProductManagement.style.display = 'block';
        document.querySelector('.admin-tab-btn[data-tab="products"]').classList.add('active');
    } else if (tabName === 'orders') {
        adminOrderManagement.style.display = 'block';
        document.querySelector('.admin-tab-btn[data-tab="orders"]').classList.add('active');
        // Ensure admin order details view is hidden when switching to order list
        adminOrderDetailsView.style.display = 'none';
        listenForAdminOrders(); // Start listening for admin orders when tab is active
    } else if (tabName === 'settings') {
        adminSiteSettings.style.display = 'block';
        document.querySelector('.admin-tab-btn[data-tab="settings"]').classList.add('active');
    }
}

// Product Management
function resetProductForm() {
    productIdInput.value = '';
    productNameInput.value = '';
    productCategorySelect.value = 'pets';
    productPriceInput.value = '';
    productSalePriceInput.value = '';
    productStockInput.value = '';
    productImageInput.value = '';
    productNewCheckbox.checked = false;
    productSaleCheckbox.checked = false;
    saveProductBtn.textContent = 'Add Product';
    productFormTitle.textContent = 'Add New Product';
    cancelEditProductBtn.style.display = 'none';
}

async function handleSaveProduct() {
    const id = productIdInput.value;
    const name = productNameInput.value.trim();
    const category = productCategorySelect.value;
    const price = parseFloat(productPriceInput.value);
    const salePrice = productSalePriceInput.value ? parseFloat(productSalePriceInput.value) : null;
    const stock = parseInt(productStockInput.value);
    const image = productImageInput.value.trim();
    const isNew = productNewCheckbox.checked;
    const onSale = productSaleCheckbox.checked;

    if (!name || !category || isNaN(price) || isNaN(stock) || !image) {
        showCustomAlert('Please fill in all required product fields (Name, Category, Price, Stock, Image).');
        return;
    }
    if (salePrice !== null && isNaN(salePrice)) {
        showCustomAlert('Please enter a valid number for Sale Price.');
        return;
    }

    try {
        const productData = { name, category, price, stock, image, isNew, onSale };
        if (salePrice !== null) {
            productData.salePrice = salePrice;
        }

        if (id) {
            // Updated path to match Firestore rules
            await updateDoc(doc(db, "artifacts", appId, "products", id), productData);
            showCustomAlert('Product updated successfully!');
        } else {
            // Updated path to match Firestore rules
            await addDoc(collection(db, "artifacts", appId, "products"), productData);
            showCustomAlert('Product added successfully!');
        }
        resetProductForm();
    } catch (error) {
        console.error("Error saving product:", error);
        showCustomAlert('Failed to save product. Please try again.');
    }
}

function renderAdminProducts(products) {
    adminProductsList.innerHTML = '';
    if (products.length === 0) {
        adminProductsList.innerHTML = '<tr><td colspan="7" class="empty-message">No products found.</td></tr>';
        return;
    }

    products.forEach(product => {
        const row = document.createElement('tr');
        row.dataset.productId = product.id;
        row.innerHTML = `
            <td><img src="images/${product.image}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/60x60/cccccc/000000?text=No+Image';"></td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>₱${product.price.toFixed(2)} ${product.onSale && product.salePrice ? ` (Sale: ₱${product.salePrice.toFixed(2)})` : ''}</td>
            <td>${product.stock}</td>
            <td>${product.isNew ? 'New' : ''}${product.isNew && product.onSale ? '/' : ''}${product.onSale ? 'Sale' : ''}</td>
            <td class="admin-product-actions">
                <button class="edit">Edit</button>
                <button class="delete">Delete</button>
            </td>
        `;
        adminProductsList.appendChild(row);
    });
}

async function editProduct(productId) {
    try {
        // Updated path to match Firestore rules
        const productDocRef = doc(db, "artifacts", appId, "products", productId);
        const productDocSnap = await getDoc(productDocRef);

        if (productDocSnap.exists()) {
            const product = { id: productDocSnap.id, ...productDocSnap.data() };
            productIdInput.value = product.id;
            productNameInput.value = product.name;
            productCategorySelect.value = product.category;
            productPriceInput.value = product.price;
            productSalePriceInput.value = product.salePrice || ''; // Set to empty string if no sale price
            productStockInput.value = product.stock;
            productImageInput.value = product.image;
            productNewCheckbox.checked = product.isNew || false;
            productSaleCheckbox.checked = product.onSale || false;

            saveProductBtn.textContent = 'Update Product';
            productFormTitle.textContent = 'Edit Product';
            cancelEditProductBtn.style.display = 'inline-block';
        } else {
            showCustomAlert('Product not found for editing.');
        }
    } catch (error) {
        console.error("Error fetching product for edit:", error);
        showCustomAlert('Failed to load product for editing.');
    }
}

async function deleteProduct(productId) {
    try {
        // Updated path to match Firestore rules
        await deleteDoc(doc(db, "artifacts", appId, "products", productId));
        showCustomAlert('Product deleted successfully!');
    } catch (error) {
        console.error("Error deleting product:", error);
        showCustomAlert('Failed to delete product. Please try again.');
    }
}

// --- Admin Order Management ---
function listenForAdminOrders() {
    if (unsubscribeAdminOrderListener) {
        unsubscribeAdminOrderListener();
    }
    // Listen to the allOrders collection as per new rules
    const q = query(
        collection(db, "artifacts", appId, "allOrders"),
        orderBy("timestamp", "desc") // Order by timestamp, newest first
    );

    unsubscribeAdminOrderListener = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAdminOrders(orders); // Render these orders in the admin table
    }, (error) => {
        console.error("Error fetching admin orders:", error);
    });
}

function renderAdminOrders(orders) {
    adminOrdersList.innerHTML = '';
    if (orders.length === 0) {
        adminOrdersList.innerHTML = '<tr><td colspan="6" class="empty-message">No orders found.</td></tr>';
        return;
    }

    orders.forEach(order => {
        const row = document.createElement('tr');
        // Use the orderId from the document itself, as it's consistent with user orders
        row.dataset.orderId = order.id;

        const timestampDate = order.timestamp ? new Date(order.timestamp.toDate()) : new Date();
        const formattedDate = timestampDate.toLocaleString();
        const statusClass = order.status.toLowerCase().replace(/\s/g, '-');

        row.innerHTML = `
            <td>${order.id.substring(0, 8)}...</td>
            <td>${order.userId ? order.userId.substring(0, 8) + '...' : 'N/A'}</td>
            <td>${formattedDate}</td>
            <td>₱${order.totalPrice.toFixed(2)}</td>
            <td><span class="order-item-status status-${statusClass}">${order.status}</span></td>
            <td class="admin-order-actions">
                <button class="view">View</button>
            </td>
        `;
        adminOrdersList.appendChild(row);
    });
}

async function viewAdminOrderDetails(orderId) {
    try {
        // Fetch directly from allOrders collection
        const orderDocRef = doc(db, "artifacts", appId, "allOrders", orderId);
        const orderDocSnap = await getDoc(orderDocRef);

        if (orderDocSnap.exists()) {
            const order = { id: orderDocSnap.id, ...orderDocSnap.data() };
            document.getElementById('admin-detail-order-id').textContent = order.id;
            document.getElementById('admin-detail-user-id').textContent = order.userId || 'N/A';
            document.getElementById('admin-detail-roblox-username').textContent = order.robloxUsername || 'Not provided';
            document.getElementById('admin-detail-order-date').textContent = order.timestamp ? new Date(order.timestamp.toDate()).toLocaleString() : 'N/A';
            document.getElementById('admin-detail-order-price').textContent = `₱${order.totalPrice.toFixed(2)}`;
            document.getElementById('admin-detail-payment-method').textContent = order.paymentMethod;
            document.getElementById('admin-detail-order-status').textContent = order.status; // Display current status
            orderStatusSelect.value = order.status; // Set dropdown to current status
            orderStatusSelect.dataset.currentOrderId = order.id; // Store order ID on select for update
            orderStatusSelect.dataset.currentOrderUserId = order.userId; // Store user ID too for updating user-specific order

            const adminDetailItemsList = document.getElementById('admin-detail-items-list');
            adminDetailItemsList.innerHTML = '';
            order.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('admin-order-detail-item');
                itemDiv.innerHTML = `
                    <span class="admin-order-detail-item-name">${item.name}</span>
                    <span class="admin-order-detail-item-qty-price">${item.quantity} x ₱${item.price.toFixed(2)}</span>
                `;
                adminDetailItemsList.appendChild(itemDiv);
            });

            adminOrderManagement.style.display = 'none';
            adminOrderDetailsView.style.display = 'block';

        } else {
            console.log("No such order found for admin view!");
            showCustomAlert("Order details not found for admin view.");
        }
    } catch (error) {
        console.error("Error fetching admin order details:", error);
        showCustomAlert("Failed to load admin order details.");
    }
}

async function handleUpdateOrderStatus() {
    const orderId = orderStatusSelect.dataset.currentOrderId;
    const orderOwnerUserId = orderStatusSelect.dataset.currentOrderUserId; // Get user ID
    const newStatus = orderStatusSelect.value;

    if (!orderId || !orderOwnerUserId) {
        showCustomAlert('No order or user ID selected for status update.');
        return;
    }

    try {
        // Update order in allOrders collection
        const allOrdersDocRef = doc(db, "artifacts", appId, "allOrders", orderId);
        await updateDoc(allOrdersDocRef, {
            status: newStatus
        });

        // Update order in user's specific orders collection
        const userOrderDocRef = doc(db, "artifacts", appId, "users", orderOwnerUserId, "orders", orderId);
        await updateDoc(userOrderDocRef, {
            status: newStatus
        });

        showCustomAlert(`Order ${orderId.substring(0,8)}... status updated to ${newStatus}!`);

    } catch (error) {
        console.error('Error updating order status:', error);
        showCustomAlert('Failed to update order status. Please try again.');
    }
}


// --- Store Settings Functions (Admin Only) ---
async function listenForStoreSettings() {
    if (unsubscribeStoreSettingsListener) {
        unsubscribeStoreSettingsListener();
    }

    // Updated path to match Firestore rules
    const storeSettingsDocRef = doc(db, "artifacts", appId, "settings", "global");

    unsubscribeStoreSettingsListener = onSnapshot(storeSettingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const settings = docSnap.data();
            // Update seller status display on main page
            if (sellerStatusDisplay) {
                if (settings.isSellerOnline) {
                    sellerStatusDisplay.textContent = 'Seller Status: Online';
                    sellerStatusDisplay.classList.remove('status-offline');
                    sellerStatusDisplay.classList.add('status-online');
                } else {
                    sellerStatusDisplay.textContent = 'Seller Status: Offline';
                    sellerStatusDisplay.classList.remove('status-online');
                    sellerStatusDisplay.classList.add('status-offline');
                }
            }
            // Update toggle in admin panel
            if (sellerOnlineToggle) {
                sellerOnlineToggle.checked = settings.isSellerOnline;
                sellerStatusText.textContent = settings.isSellerOnline ? 'Online' : 'Offline';
            }
        } else {
            console.log("No store settings found, initializing default.");
            // Initialize default settings if not present
            setDoc(storeSettingsDocRef, { isSellerOnline: false });
        }
    }, (error) => {
        console.error("Error listening to store settings:", error);
    });
}

async function updateStoreSettings(settingsData) {
    try {
        // Updated path to match Firestore rules
        const storeSettingsDocRef = doc(db, "artifacts", appId, "settings", "global");
        await setDoc(storeSettingsDocRef, settingsData, { merge: true });
        console.log("Store settings updated.");
    } catch (error) {
        console.error("Error updating store settings:", error);
        showCustomAlert("Failed to update store settings.");
    }
}


// --- Custom Modals (Alert and Confirm) ---
function showCustomAlert(message) {
    const modalId = 'custom-alert-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        // Create modal if it doesn't exist
        modal = document.createElement('div');
        modal.id = modalId;
        modal.classList.add('custom-modal');
        modal.innerHTML = `
            <div class="custom-modal-content">
                <button class="custom-modal-close-btn">&times;</button>
                <p id="custom-alert-message"></p>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-ok-btn">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.custom-modal-ok-btn').addEventListener('click', () => modal.classList.remove('show'));
        modal.querySelector('.custom-modal-close-btn').addEventListener('click', () => modal.classList.remove('show'));
    }
    modal.querySelector('#custom-alert-message').textContent = message;
    modal.classList.add('show');
}

function showConfirmModal(message, onConfirmCallback) {
    const modalId = 'custom-confirm-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        // Create modal if it doesn't exist
        modal = document.createElement('div');
        modal.id = modalId;
        modal.classList.add('custom-modal');
        modal.innerHTML = `
            <div class="custom-modal-content">
                <button class="custom-modal-close-btn">&times;</button>
                <p id="custom-confirm-message"></p>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-cancel-btn">Cancel</button>
                    <button class="custom-modal-confirm-btn">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const confirmBtn = modal.querySelector('.custom-modal-confirm-btn');
    const cancelBtn = modal.querySelector('.custom-modal-cancel-btn');
    const closeBtn = modal.querySelector('.custom-modal-close-btn');

    // Clear previous listeners to prevent multiple calls
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    closeBtn.onclick = null;

    confirmBtn.onclick = () => {
        modal.classList.remove('show');
        onConfirmCallback();
    };
    cancelBtn.onclick = () => modal.classList.remove('show');
    closeBtn.onclick = () => modal.classList.remove('show');

    modal.querySelector('#custom-confirm-message').textContent = message;
    modal.classList.add('show');
}

