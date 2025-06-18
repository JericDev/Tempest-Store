// admin.js
// This file contains all logic and DOM manipulations specific to the admin panel.
// It is designed to be dynamically imported by script.js when an admin user logs in.

import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, addDoc, deleteDoc, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

// Global variables for admin-specific data and Firebase instances
let allOrders = []; // Stores all orders fetched from Firestore for admin view
let unsubscribeAllOrders = null; // Unsubscribe function for the all orders listener
let unsubscribeAdminSellerStatus = null; // Unsubscribe for admin seller status listener

// Firebase instances will be passed from script.js during initialization
let dbInstance = null;
let authInstance = null;
let storageInstance = null;
let adminUserId = null;
let isAdminUser = false; // Flag to confirm admin status within this module

// --- DOM elements for Admin Panel (Referenced from index.html) ---
const adminPanelModal = document.getElementById("admin-panel-modal");
const closeAdminPanelModalBtn = document.getElementById("close-admin-panel-modal");
const adminTabButtons = document.querySelectorAll(".admin-tab-btn");
const adminProductManagement = document.getElementById("admin-product-management");
const adminOrderManagement = document.getElementById("admin-order-management");
const adminSellerStatusTab = document.getElementById("admin-seller-status");

// Product Management elements
const productFormTitle = document.getElementById("product-form-title");
const productIdInput = document.getElementById("product-id-input");
const productNameInput = document.getElementById("product-name");
const productCategorySelect = document.getElementById("product-category");
const productPriceInput = document.getElementById("product-price");
const productSalePriceInput = document.getElementById("product-sale-price");
const productStockInput = document.getElementById("product-stock");
const productImageInput = document.getElementById("product-image");
const productNewCheckbox = document.getElementById("product-new");
const productSaleCheckbox = document.getElementById("product-sale");
const saveProductBtn = document.getElementById("save-product-btn");
const cancelEditProductBtn = document.getElementById("cancel-edit-product");
const adminProductsList = document.getElementById("admin-products-list");

// Order Management elements
const adminOrdersList = document.getElementById("admin-orders-list");
const adminOrderDetailsView = document.getElementById("admin-order-details-view");
const adminDetailOrderId = document.getElementById("admin-detail-order-id");
const adminDetailUserId = document.getElementById("admin-detail-user-id");
const adminDetailRobloxUsername = document.getElementById("admin-detail-roblox-username");
const adminDetailOrderDate = document.getElementById("admin-detail-order-date");
const adminDetailOrderPrice = document.getElementById("admin-detail-order-price");
const adminDetailPaymentMethod = document.getElementById("admin-detail-payment-method");
const adminDetailOrderStatus = document.getElementById("admin-detail-order-status");
const adminDetailItemsList = document.getElementById("admin-detail-items-list");
const orderStatusSelect = document.getElementById("order-status-select");
const updateOrderStatusBtn = document.getElementById("update-order-status-btn");
const adminBackToOrderListBtn = document.getElementById("admin-back-to-order-list");
let currentEditingOrderId = null; // Stores the ID of the order currently being viewed/edited

// Seller Status elements
const adminSellerStatusDisplay = document.getElementById("admin-seller-status-display");
const toggleSellerStatusBtn = document.getElementById("toggle-seller-status-btn");

// --- Firestore Collection Paths (Centralized and consistent with script.js) ---
const APP_ID = 'tempest-store-app';
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`;
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`;
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`;
const SETTINGS_COLLECTION_PATH = `artifacts/${APP_ID}/settings`;

// --- Initialization Function (Called by script.js) ---
function initAdminPanel(db, auth, storage, userId, adminFlag) {
    console.log("[Admin Module] initAdminPanel called. Initializing admin features.");
    // Assign passed Firebase instances and user info to local module variables
    dbInstance = db;
    authInstance = auth;
    storageInstance = storage;
    adminUserId = userId;
    isAdminUser = adminFlag;

    // Ensure listeners are only attached once for buttons
    const adminPanelButton = document.getElementById("admin-panel-button");
    if (adminPanelButton && !adminPanelButton._adminListenerAttached) {
        adminPanelButton._adminListenerAttached = true; // Mark as attached
        adminPanelButton.addEventListener('click', () => {
            if (!isAdminUser) {
                alert("You are not authorized to access the Admin Panel.");
                console.warn("[Admin Module] Unauthorized access attempt to Admin Panel.");
                return;
            }
            adminPanelModal.classList.add('show');
            showAdminTab('products'); // Default to products tab on open
            console.log("[Admin Module] Admin Panel modal shown, defaulting to products tab.");
        });
    }

    // Attach listeners for modal close and tab switching
    if (!closeAdminPanelModalBtn._listenerAttached) {
        closeAdminPanelModalBtn._listenerAttached = true;
        closeAdminPanelModalBtn.addEventListener('click', () => {
            adminPanelModal.classList.remove('show');
            cleanupAdminPanelListeners(); // Clean up specific listeners on modal close
            console.log("[Admin Module] Admin Panel modal closed by button.");
        });

        adminPanelModal._overlayListenerAttached = true; // For clicking outside
        adminPanelModal.addEventListener('click', (event) => {
            if (event.target === adminPanelModal) {
                adminPanelModal.classList.remove('show');
                cleanupAdminPanelListeners();
                console.log("[Admin Module] Admin Panel modal closed by clicking outside.");
            }
        });
    }

    adminTabButtons.forEach(button => {
        if (!button._tabListenerAttached) {
            button._tabListenerAttached = true;
            button.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                showAdminTab(tab);
                console.log("[Admin Module] Switched admin tab to:", tab);
            });
        }
    });

    // Attach form/action button listeners if not already attached
    if (!saveProductBtn._listenerAttached) {
        saveProductBtn._listenerAttached = true;
        saveProductBtn.addEventListener('click', saveProduct);
    }
    if (!cancelEditProductBtn._listenerAttached) {
        cancelEditProductBtn._listenerAttached = true;
        cancelEditProductBtn.addEventListener('click', resetProductForm);
    }
    if (!adminBackToOrderListBtn._listenerAttached) {
        adminBackToOrderListBtn._listenerAttached = true;
        adminBackToOrderListBtn.addEventListener('click', () => {
            adminOrdersList.parentElement.style.display = 'table';
            adminOrderDetailsView.style.display = 'none';
            currentEditingOrderId = null;
            console.log("[Admin Order] Back to order list from details view.");
        });
    }
    if (!updateOrderStatusBtn._listenerAttached) {
        updateOrderStatusBtn._listenerAttached = true;
        updateOrderStatusBtn.addEventListener('click', updateOrderStatus);
    }
    if (!toggleSellerStatusBtn._listenerAttached) {
        toggleSellerStatusBtn._listenerAttached = true;
        toggleSellerStatusBtn.addEventListener('click', toggleSellerStatus);
    }

    // Set up initial real-time listeners for admin data
    console.log("[Admin Module] Setting up real-time listeners for all orders and seller status.");
    setupAllOrdersListener();
    setupAdminSellerStatusListener();
}

// --- Cleanup Function (Called by script.js on logout or modal close) ---
function cleanupAdminPanel() {
    console.log("[Admin Module] Initiating full admin panel cleanup.");
    cleanupAdminPanelListeners(); // Clean up specific Firebase listeners
    // Reset any state or UI elements that should not persist after admin session ends
    currentEditingOrderId = null;
    adminPanelModal.classList.remove('show');
    // For general button listeners, they are often left on the element if they don't leak memory,
    // but the logic inside them should check `isAdminUser` or `currentUserId`.
    // Since initAdminPanel adds check for `_adminListenerAttached`, they won't duplicate.
    console.log("[Admin Module] Admin panel cleanup complete.");
}

// Function to unsubscribe Firestore listeners within the admin module
function cleanupAdminPanelListeners() {
    if (unsubscribeAllOrders) {
        unsubscribeAllOrders();
        unsubscribeAllOrders = null;
        console.log("[Admin Module] Unsubscribed from allOrders listener.");
    }
    if (unsubscribeAdminSellerStatus) {
        unsubscribeAdminSellerStatus();
        unsubscribeAdminSellerStatus = null;
        console.log("[Admin Module] Unsubscribed from admin seller status listener.");
    }
}

// --- Product Management Functions ---
// Handles saving a new product or updating an existing one.
async function saveProduct() {
    console.log("[Admin Product] Save Product button clicked.");
    const productId = productIdInput.value;
    const name = productNameInput.value.trim();
    const category = productCategorySelect.value;
    const price = parseFloat(productPriceInput.value);
    const salePrice = productSalePriceInput.value.trim() === '' ? null : parseFloat(productSalePriceInput.value);
    const stock = parseInt(productStockInput.value);
    const image = productImageInput.value.trim();
    const isNew = productNewCheckbox.checked;
    const isSale = productSaleCheckbox.checked;

    // Basic validation
    if (!name || !image || isNaN(price) || isNaN(stock) || stock < 0) {
        alert("Please fill in all product fields correctly (Name, Image Filename, Price, Stock).");
        console.warn("[Admin Product] Product form validation failed: missing/invalid basic fields.");
        return;
    }
    if (isSale && (isNaN(salePrice) || salePrice === null || salePrice >= price)) {
        alert("Please enter a valid Sale Price lower than the regular price if 'On Sale' is checked.");
        console.warn("[Admin Product] Product form validation failed: invalid sale price.");
        return;
    }

    const productData = {
        name: name,
        category: category,
        price: `₱${price.toFixed(2)}`,
        salePrice: salePrice !== null ? `₱${salePrice.toFixed(2)}` : null,
        stock: stock,
        image: image,
        new: isNew,
        sale: isSale
    };

    try {
        if (productId) {
            if (!confirm("Are you sure you want to save changes to this product?")) {
                console.log("[Admin Product] Save changes cancelled by user.");
                return;
            }
            const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, productId);
            await updateDoc(productRef, productData);
            console.log("[Admin Product] Product updated in Firestore:", productId);
        } else {
            const productsColRef = collection(dbInstance, PRODUCTS_COLLECTION_PATH);
            await addDoc(productsColRef, productData);
            console.log("[Admin Product] New product added to Firestore:", productData.name);
        }
        resetProductForm();
        alert("Product saved successfully!");
    } catch (e) {
        console.error("[Admin Product] Error saving product to Firestore:", e);
        alert("Error saving product: " + e.message);
    }
}

// Deletes a product from Firestore.
async function deleteProductFromFirestore(productId) {
    if (confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
        try {
            const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, productId);
            await deleteDoc(productRef);
            console.log("[Admin Product] Product deleted from Firestore:", productId);
            alert("Product deleted successfully!");
        } catch (e) {
            console.error("[Admin Product] Error deleting product from Firestore:", e);
            alert("Error deleting product: " + e.message);
        }
    } else {
        console.log("[Admin Product] Product deletion cancelled by user.");
    }
}

// Populates the product form with data of a selected product for editing.
function editProduct(product) {
    console.log("[Admin Product UI] Populating form for editing product:", product.id);
    productFormTitle.textContent = "Edit Product";
    productIdInput.value = product.id;
    productNameInput.value = product.name;
    productCategorySelect.value = product.category;
    productPriceInput.value = parseFloat(product.price.replace('₱', ''));
    productSalePriceInput.value = product.salePrice ? parseFloat(product.salePrice.replace('₱', '')) : '';
    productStockInput.value = product.stock;
    productImageInput.value = product.image;
    productNewCheckbox.checked = product.new || false;
    productSaleCheckbox.checked = product.sale || false;
    saveProductBtn.textContent = "Save Changes";
    cancelEditProductBtn.style.display = "inline-block";
}

// Resets the product form to its default "Add New Product" state.
function resetProductForm() {
    console.log("[Admin Product UI] Resetting product form.");
    productFormTitle.textContent = "Add New Product";
    productIdInput.value = '';
    productNameInput.value = '';
    productCategorySelect.value = 'pets';
    productPriceInput.value = '';
    productSalePriceInput.value = '';
    productStockInput.value = '';
    productImageInput.value = '';
    productNewCheckbox.checked = false;
    productSaleCheckbox.checked = false;
    saveProductBtn.textContent = "Add Product";
    cancelEditProductBtn.style.display = "none";
}

// Renders the list of products in the admin panel's product management table.
// This function assumes `allProducts` (from script.js) is kept up-to-date by its own listener.
function renderAdminProducts() {
    console.log("[Admin Product UI] Rendering admin products list. Total products:", window.allProducts ? window.allProducts.length : 0);
    adminProductsList.innerHTML = ''; // Clear existing list

    // Access allProducts from the global scope (managed by script.js)
    const productsToRender = window.allProducts || [];

    if (productsToRender.length === 0) {
        adminProductsList.innerHTML = '<tr><td colspan="7" class="empty-message">No products found.</td></tr>';
        return;
    }

    productsToRender.forEach(product => {
        const row = document.createElement('tr');
        const imageUrl = `images/${product.image}`;
        const displayPrice = product.sale && product.salePrice ?
                             `<span style="text-decoration: line-through; color: #888;">${product.price}</span> ${product.salePrice}` :
                             product.price;
        row.innerHTML = `
            <td data-label="Image"><img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/50x50/f0f0f0/888?text=N/A';" /></td>
            <td data-label="Name">${product.name}</td>
            <td data-label="Category">${product.category}</td>
            <td data-label="Price">${displayPrice}</td>
            <td data-label="Stock">${product.stock}</td>
            <td data-label="Status">${product.new ? 'NEW ' : ''}${product.sale ? 'SALE' : ''}</td>
            <td data-label="Actions" class="admin-product-actions">
                <button class="edit" data-id="${product.id}">Edit</button>
                <button class="delete" data-id="${product.id}">Delete</button>
            </td>
        `;
        adminProductsList.appendChild(row);
    });

    // Attach event listeners for dynamically created buttons
    adminProductsList.querySelectorAll('.edit').forEach(button => {
        // Remove existing listener to prevent duplicates if function is called multiple times
        if (button._editListener) button.removeEventListener('click', button._editListener);
        const listener = (e) => {
            const productId = e.target.dataset.id;
            const productToEdit = productsToRender.find(p => p.id === productId);
            if (productToEdit) {
                editProduct(productToEdit);
            }
        };
        button.addEventListener('click', listener);
        button._editListener = listener; // Store listener reference
    });

    adminProductsList.querySelectorAll('.delete').forEach(button => {
        if (button._deleteListener) button.removeEventListener('click', button._deleteListener);
        const listener = (e) => {
            const productId = e.target.dataset.id;
            deleteProductFromFirestore(productId);
        };
        button.addEventListener('click', listener);
        button._deleteListener = listener;
    });
    console.log("[Admin Product UI] Products list rendered successfully.");
}

// --- Admin Panel Tab Switching ---
function showAdminTab(tabName) {
    console.log("[Admin UI] Switching to admin tab:", tabName);
    adminTabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Hide all tab contents first
    adminProductManagement.style.display = 'none';
    adminOrderManagement.style.display = 'none';
    adminSellerStatusTab.style.display = 'none';

    // Show the selected tab and perform specific actions for it
    if (tabName === 'products') {
        adminProductManagement.style.display = 'block';
        resetProductForm(); // Clear form when navigating to product tab
        renderAdminProducts(); // Ensure products list is up-to-date
    } else if (tabName === 'orders') {
        adminOrderManagement.style.display = 'block';
        adminOrderDetailsView.style.display = 'none'; // Always start on list view
        renderAdminOrders(); // Ensure orders list is up-to-date
    } else if (tabName === 'seller-status') {
        adminSellerStatusTab.style.display = 'block';
        // The listener is already set up in initAdminPanel, it will update automatically
    }
}

// --- Order Management Functions (Admin-side) ---
// Sets up a real-time listener for all orders in Firestore for the admin view.
function setupAllOrdersListener() {
    console.log("[Admin Orders] Setting up all orders listener.");
    if (unsubscribeAllOrders) {
        unsubscribeAllOrders(); // Unsubscribe from previous listener if it exists
        console.log("[Admin Orders] Unsubscribed from existing allOrders listener.");
    }
    const allOrdersColRef = collection(dbInstance, ALL_ORDERS_COLLECTION_PATH);
    const q = query(allOrdersColRef, orderBy("orderDate", "desc")); // Order by most recent orders

    unsubscribeAllOrders = onSnapshot(q, (snapshot) => {
        console.log("[Admin Orders] All orders listener triggered. Fetching data...");
        const fetchedOrders = [];
        snapshot.forEach(doc => {
            fetchedOrders.push({ id: doc.id, ...doc.data() });
        });
        allOrders = fetchedOrders; // Update the global allOrders array
        console.log(`[Admin Orders] Fetched ${allOrders.length} orders.`);
        renderAdminOrders(); // Re-render the orders list in the admin panel
    }, (error) => {
        console.error("[Admin Orders] Error listening to all orders:", error);
    });
}

// Renders the list of all orders in the admin panel's order management table.
function renderAdminOrders() {
    console.log("[Admin Orders UI] Rendering admin orders list.");
    adminOrdersList.innerHTML = ''; // Clear existing list
    if (allOrders.length === 0) {
        adminOrdersList.innerHTML = '<tr><td colspan="6" class="empty-message">No orders found.</td></tr>';
        return;
    }

    allOrders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Order ID">${order.id.substring(0, 8)}...</td>
            <td data-label="User ID">${order.userId ? order.userId.substring(0, 8) + '...' : 'N/A'}</td>
            <td data-label="Date">${new Date(order.orderDate).toLocaleDateString()}</td>
            <td data-label="Total">₱${order.total.toFixed(2)}</td>
            <td data-label="Status"><span class="order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}}">${order.status}</span></td>
            <td data-label="Actions" class="admin-order-actions">
                <button class="view" data-id="${order.id}">View</button>
            </td>
        `;
        adminOrdersList.appendChild(row);
    });

    adminOrdersList.querySelectorAll('.view').forEach(button => {
        if (button._viewListener) button.removeEventListener('click', button._viewListener);
        const listener = (e) => {
            const orderId = e.target.dataset.id;
            const selectedOrder = allOrders.find(order => order.id === orderId);
            if (selectedOrder) {
                showAdminOrderDetails(selectedOrder);
            }
        };
        button.addEventListener('click', listener);
        button._viewListener = listener; // Store listener reference
    });
    console.log(`[Admin Orders UI] Rendered ${allOrders.length} orders.`);
}

// Displays the detailed information of a selected order for admin review and modification.
function showAdminOrderDetails(order) {
    console.log("[Admin Orders UI] Showing admin order details for ID:", order.id);
    currentEditingOrderId = order.id; // Store ID for status update
    adminOrdersList.parentElement.style.display = 'none'; // Hide table
    adminOrderDetailsView.style.display = 'block'; // Show details

    adminDetailOrderId.textContent = order.id;
    adminDetailUserId.textContent = order.userId || 'N/A';
    adminDetailRobloxUsername.textContent = order.robloxUsername || 'N/A';
    adminDetailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
    adminDetailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
    adminDetailPaymentMethod.textContent = order.paymentMethod;
    adminDetailOrderStatus.textContent = order.status;
    adminDetailOrderStatus.className = `status-info order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}`;

    orderStatusSelect.value = order.status; // Set dropdown to current status

    adminDetailItemsList.innerHTML = '';
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'admin-order-detail-item';
            // Use effectivePrice from the order item, as that's what was recorded at time of purchase
            const itemPriceToDisplay = item.effectivePrice || item.price;
            itemDiv.innerHTML = `
                <span class="admin-order-detail-item-name">${item.name}</span>
                <span class="admin-order-detail-item-qty-price">Qty: ${item.quantity} - ${itemPriceToDisplay}</span>
            `;
            adminDetailItemsList.appendChild(itemDiv);
        });
    } else {
        adminDetailItemsList.innerHTML = '<p>No items found for this order.</p>';
    }
    console.log("[Admin Orders UI] Order details populated for ID:", order.id);
}

// Updates the status of an order in Firestore.
async function updateOrderStatus() {
    console.log("[Admin Order] Update Order Status button clicked.");
    if (!currentEditingOrderId) {
        alert("No order selected for status update.");
        console.warn("[Admin Order] No order ID for status update.");
        return;
    }

    const newStatus = orderStatusSelect.value;
    try {
        // Update in central `allOrders` collection
        const allOrderRef = doc(dbInstance, ALL_ORDERS_COLLECTION_PATH, currentEditingOrderId);
        await updateDoc(allOrderRef, { status: newStatus });
        console.log(`[Admin Order] Updated status in allOrders for ${currentEditingOrderId.substring(0, 8)}... to ${newStatus}.`);

        // Also update in the specific user's order collection
        const orderToUpdate = allOrders.find(o => o.id === currentEditingOrderId);
        if (orderToUpdate && orderToUpdate.userId) {
            const userOrderRef = doc(dbInstance, USER_ORDERS_COLLECTION_PATH(orderToUpdate.userId), currentEditingOrderId);
            await updateDoc(userOrderRef, { status: newStatus });
            console.log(`[Admin Order] Updated status in user's order collection for ${orderToUpdate.userId.substring(0, 8)}... to ${newStatus}.`);
        } else {
            console.warn(`[Admin Order] User ID not found for order ${currentEditingOrderId.substring(0, 8)}... Skipping update in user's collection.`);
        }

        alert(`Order ${currentEditingOrderId.substring(0, 8)}... status updated to ${newStatus}.`);
        adminBackToOrderListBtn.click(); // Go back to list after update
    } catch (e) {
        console.error("[Admin Order] Error updating order status:", e);
        alert("Error updating order status: " + e.message);
    }
}

// --- Seller Status Management (Admin Side) ---
const SELLER_STATUS_DOC_PATH = doc(dbInstance, SETTINGS_COLLECTION_PATH, 'sellerStatus');

// Sets up a real-time listener for the seller status within the admin panel.
function setupAdminSellerStatusListener() {
    console.log("[Admin Seller Status] Setting up listener.");
    if (unsubscribeAdminSellerStatus) {
        unsubscribeAdminSellerStatus(); // Ensure only one listener
    }
    const sellerStatusDocRef = doc(dbInstance, SETTINGS_COLLECTION_PATH, 'sellerStatus');
    unsubscribeAdminSellerStatus = onSnapshot(sellerStatusDocRef, (docSnap) => {
        console.log("[Admin Seller Status] Listener triggered.");
        if (docSnap.exists()) {
            const statusData = docSnap.data();
            const isOnline = statusData.isOnline;
            adminSellerStatusDisplay.textContent = isOnline ? 'Online' : 'Offline';
            adminSellerStatusDisplay.classList.toggle('online', isOnline);
            adminSellerStatusDisplay.classList.toggle('offline', !isOnline);
            console.log(`[Admin Seller Status] Current status: ${isOnline ? 'Online' : 'Offline'}`);
        } else {
            adminSellerStatusDisplay.textContent = 'Offline';
            adminSellerStatusDisplay.classList.remove('online');
            adminSellerStatusDisplay.classList.add('offline');
            console.warn("[Admin Seller Status] Document does not exist. Defaulting to Offline. Attempting to create default.");
            // Create the default status document if it's missing
            setDoc(sellerStatusDocRef, { isOnline: false }, { merge: true })
                .catch(e => console.error("[Admin Seller Status] Error creating default seller status document:", e));
        }
    }, (error) => {
        console.error("[Admin Seller Status] Error listening to admin seller status:", error);
    });
}

// Toggles the seller's online/offline status in Firestore.
async function toggleSellerStatus() {
    console.log("[Admin Seller Status] Toggle button clicked.");
    try {
        const docSnap = await getDoc(doc(dbInstance, SETTINGS_COLLECTION_PATH, 'sellerStatus'));
        let currentStatus = false;
        if (docSnap.exists()) {
            currentStatus = docSnap.data().isOnline;
        }

        const newStatus = !currentStatus;
        await setDoc(doc(dbInstance, SETTINGS_COLLECTION_PATH, 'sellerStatus'), { isOnline: newStatus }, { merge: true });
        alert(`Seller status updated to: ${newStatus ? 'Online' : 'Offline'}`);
        console.log(`[Admin Seller Status] Status toggled to: ${newStatus ? 'Online' : 'Offline'}`);
    } catch (e) {
        console.error("[Admin Seller Status] Error toggling seller status:", e);
        alert("Failed to toggle seller status. Please check console for details.");
    }
}

// Export the initialization and cleanup functions for script.js to use
export { initAdminPanel, cleanupAdminPanel };
