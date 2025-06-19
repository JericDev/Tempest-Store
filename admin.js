// admin.js
// This file contains all logic and DOM manipulations specific to the admin panel.

import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, addDoc, deleteDoc, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// Global variables for admin-specific data and listeners
let allOrders = []; // Global array to store all orders for admin view
let unsubscribeAllOrders = null; // Unsubscribe function for allOrders listener
let unsubscribeStoreSettings = null; // NEW: Unsubscribe function for store settings listener
let dbInstance = null; // Firestore instance passed from script.js
let authInstance = null; // Auth instance passed from script.js
let adminUserId = null; // Admin user ID passed from script.js
let isAdminUser = false; // Is Admin flag passed from script.js
let headerSellerStatusText = null; // NEW: Reference to the seller status text in the main header (passed from script.js)

// --- DOM elements for Admin Panel ---
const adminPanelModal = document.getElementById("admin-panel-modal");
const closeAdminPanelModalBtn = document.getElementById("close-admin-panel-modal");
const adminTabButtons = document.querySelectorAll(".admin-tab-btn");
const adminProductManagement = document.getElementById("admin-product-management");
const adminOrderManagement = document.getElementById("admin-order-management");
// NEW: Store Settings DOM elements (will be reassigned in initAdminPanel for safety)
let adminStoreSettings = document.getElementById("admin-store-settings");
let adminSellerStatusDisplay = document.getElementById("admin-seller-status-display");
let toggleSellerStatusBtn = document.getElementById("toggle-seller-status-btn");


// Product Form elements
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
let currentEditingOrderId = null;
let currentEditingOrderUserId = null;


// --- Firestore Collection Paths (These are defined locally in admin.js for clarity) ---
const APP_ID = 'tempest-store-app'; // Ensure this matches APP_ID in script.js
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`;
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`;
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`;
const STORE_SETTINGS_DOC_PATH = `artifacts/${APP_ID}/storeSettings/config`; // NEW: Firestore path for store settings


// --- Admin Panel Initialization ---
// MODIFIED: Added headerSellerStatusTextElement parameter
export function initAdminPanel(db, auth, userId, adminFlag, headerSellerStatusTextElement) {
    dbInstance = db;
    authInstance = auth;
    adminUserId = userId;
    isAdminUser = adminFlag;
    headerSellerStatusText = headerSellerStatusTextElement; // Assign the passed element

    // Re-assign DOM elements for Store Settings (important after dynamic import)
    adminStoreSettings = document.getElementById("admin-store-settings");
    adminSellerStatusDisplay = document.getElementById("admin-seller-status-display");
    toggleSellerStatusBtn = document.getElementById("toggle-seller-status-btn");

    // Attach event listener for the admin panel button (from script.js)
    const adminPanelButton = document.getElementById("admin-panel-button");
    if (adminPanelButton) {
        if (adminPanelButton._adminListener) {
            adminPanelButton.removeEventListener('click', adminPanelButton._adminListener);
        }
        const listener = () => {
            if (!isAdminUser) {
                alert("You are not authorized to access the Admin Panel.");
                return;
            }
            adminPanelModal.classList.add('show');
            // Default to product management tab when opening
            showAdminTab('products');
        };
        adminPanelButton.addEventListener('click', listener);
        adminPanelButton._adminListener = listener;
    }

    closeAdminPanelModalBtn.addEventListener('click', () => {
        adminPanelModal.classList.remove('show');
    });

    adminPanelModal.addEventListener('click', (event) => {
        if (event.target === adminPanelModal) {
            adminPanelModal.classList.remove('show');
        }
    });

    adminTabButtons.forEach(button => {
        if (button._tabListener) {
            button.removeEventListener('click', button._tabListener);
        }
        const listener = (e) => {
            const tab = e.target.dataset.tab;
            showAdminTab(tab);
        };
        button.addEventListener('click', listener);
        button._tabListener = listener;
    });

    // Remove existing listeners for product form and order management buttons to prevent duplicates
    if (saveProductBtn._saveListener) saveProductBtn.removeEventListener('click', saveProductBtn._saveListener);
    if (cancelEditProductBtn._cancelListener) cancelEditProductBtn.removeEventListener('click', cancelEditProductBtn._cancelListener);
    if (adminBackToOrderListBtn._backListener) adminBackToOrderListBtn.removeEventListener('click', adminBackToOrderListBtn._backListener);
    if (updateOrderStatusBtn._updateListener) updateOrderStatusBtn.removeEventListener('click', updateOrderStatusBtn._updateListener);
    // NEW: Remove existing listener for toggleSellerStatusBtn
    if (toggleSellerStatusBtn && toggleSellerStatusBtn._toggleListener) { // Check if element exists before removing
        toggleSellerStatusBtn.removeEventListener('click', toggleSellerStatusBtn._toggleListener);
    }

    // --- Product Management Event Listeners ---
    saveProductBtn._saveListener = async () => {
        const productId = productIdInput.value;
        const isNew = productNewCheckbox.checked;
        const isSale = productSaleCheckbox.checked;
        let salePrice = null;
        let productImage = productImageInput.value.trim();

        if (isSale && productSalePriceInput.value.trim() !== '') {
            salePrice = `₱${parseFloat(productSalePriceInput.value).toFixed(2)}`;
        } else {
            salePrice = null;
        }

        const newProduct = {
            name: productNameInput.value.trim(),
            category: productCategorySelect.value,
            price: `₱${parseFloat(productPriceInput.value).toFixed(2)}`,
            salePrice: salePrice,
            stock: parseInt(productStockInput.value),
            image: productImage,
            new: isNew,
            sale: isSale
        };

        if (!newProduct.name || !newProduct.image || isNaN(newProduct.stock) || isNaN(parseFloat(newProduct.price.replace('₱', '')))) {
            alert("Please fill in all product fields correctly, including an image filename (e.g., product.png).");
            return;
        }
        if (isSale && (salePrice === null || isNaN(parseFloat(salePrice.replace('₱', ''))))) {
            alert("Please enter a valid Sale Price if the product is On Sale.");
            return;
        }

        if (productId) {
            newProduct.id = productId;
        }
        saveProductToFirestore(newProduct);
    };
    saveProductBtn.addEventListener('click', saveProductBtn._saveListener);

    cancelEditProductBtn._cancelListener = resetProductForm;
    cancelEditProductBtn.addEventListener('click', cancelEditProductBtn._cancelListener);

    // --- Order Management Event Listeners ---
    adminBackToOrderListBtn._backListener = () => {
        adminOrderManagement.style.display = 'block';
        adminOrderDetailsView.style.display = 'none';
        currentEditingOrderId = null;
        currentEditingOrderUserId = null;
    };
    adminBackToOrderListBtn.addEventListener('click', adminBackToOrderListBtn._backListener);

    updateOrderStatusBtn._updateListener = async () => {
        if (!currentEditingOrderId || !currentEditingOrderUserId) {
            alert("No order selected or user ID is missing. Cannot update status.");
            return;
        }

        const newStatus = orderStatusSelect.value;
        try {
            const allOrdersRef = doc(dbInstance, ALL_ORDERS_COLLECTION_PATH, currentEditingOrderId);
            const userOrderRef = doc(dbInstance, USER_ORDERS_COLLECTION_PATH(currentEditingOrderUserId), currentEditingOrderId);

            await updateDoc(allOrdersRef, { status: newStatus });
            await updateDoc(userOrderRef, { status: newStatus });

            alert(`Order ${currentEditingOrderId.substring(0, 8)}... status updated to ${newStatus}.`);
            adminBackToOrderListBtn.click(); // Return to the list view

        } catch (e) {
            console.error("Error updating order status in both locations:", e);
            alert("Error updating order status: " + e.message + "\n\nNote: This may be due to Firestore Security Rules. The admin account must have permission to write to user-specific order documents.");
        }
    };
    updateOrderStatusBtn.addEventListener('click', updateOrderStatusBtn._updateListener);


    // --- NEW: Store Settings Event Listeners ---
    if (toggleSellerStatusBtn) { // Ensure the button exists before attaching listener
        toggleSellerStatusBtn._toggleListener = async () => {
            if (!isAdminUser) {
                alert("You do not have permission to change store settings.");
                return;
            }
            toggleSellerStatusBtn.disabled = true;
            try {
                const storeSettingsRef = doc(dbInstance, STORE_SETTINGS_DOC_PATH);
                const docSnap = await getDoc(storeSettingsRef);
                let currentStatus = true; // Default if doc doesn't exist
                if (docSnap.exists()) {
                    currentStatus = docSnap.data().isOnline;
                }
                await updateDoc(storeSettingsRef, { isOnline: !currentStatus });
                console.log("Seller status toggled to:", !currentStatus);
            } catch (e) {
                console.error("Error toggling seller status:", e);
                alert("Failed to toggle seller status. Please try again.");
            } finally {
                toggleSellerStatusBtn.disabled = false;
            }
        };
        toggleSellerStatusBtn.addEventListener('click', toggleSellerStatusBtn._toggleListener);
    }


    // Initial setup if admin panel is already open (e.g., on page load after login)
    if (adminPanelModal.classList.contains('show')) {
        showAdminTab('products'); // Ensure initial tab is rendered
    }
}

// --- Product Management Functions (Admin) ---

// Saves a product (new or existing) to Firestore.
async function saveProductToFirestore(productData) {
    try {
        if (productData.id) {
            if (!confirm("Are you sure you want to save changes to this product?")) {
                return;
            }
            const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, productData.id);
            await updateDoc(productRef, productData);
            console.log("Product updated:", productData.id);
        } else {
            const productsColRef = collection(dbInstance, PRODUCTS_COLLECTION_PATH);
            await addDoc(productsColRef, productData);
            console.log("Product added:", productData.name);
        }
        resetProductForm();
        alert("Product saved successfully!");
    } catch (e) {
        console.error("Error saving product:", e);
        alert("Error saving product: " + e.message);
    }
}

// Deletes a product from Firestore.
async function deleteProductFromFirestore(productId) {
    if (confirm("Are you sure you want to delete this product?")) {
        try {
            const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, productId);
            await deleteDoc(productRef);
            console.log("Product deleted:", productId);
            alert("Product deleted successfully!");
        } catch (e) {
            console.error("Error deleting product:", e);
            alert("Error deleting product: " + e.message);
        }
    }
}

// Renders the list of products in the admin panel's product management table.
function renderAdminProducts() {
    adminProductsList.innerHTML = '';
    const productsColRef = collection(dbInstance, PRODUCTS_COLLECTION_PATH);
    getDocs(productsColRef).then((snapshot) => {
        const fetchedProducts = [];
        snapshot.forEach(doc => {
            fetchedProducts.push({ id: doc.id, ...doc.data() });
        });

        if (fetchedProducts.length === 0) {
            adminProductsList.innerHTML = '<tr><td colspan="7" class="empty-message">No products found.</td></tr>';
            return;
        }

        fetchedProducts.forEach(product => {
            const row = document.createElement('tr');
            const imageUrl = `images/${product.image}`;
            row.innerHTML = `
                <td data-label="Image"><img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/50x50/f0f0f0/888?text=N/A';" /></td>
                <td data-label="Name">${product.name}</td>
                <td data-label="Category">${product.category}</td>
                <td data-label="Price">
                    ${product.sale && product.salePrice ?
                        `<span style="text-decoration: line-through; color: #888;">${product.price}</span> ${product.salePrice}` :
                        product.price}
                </td>
                <td data-label="Stock">${product.stock}</td>
                <td data-label="Status">${product.new ? 'NEW ' : ''}${product.sale ? 'SALE' : ''}</td>
                <td data-label="Actions" class="admin-product-actions">
                    <button class="edit" data-id="${product.id}">Edit</button>
                    <button class="delete" data-id="${product.id}">Delete</button>
                </td>
            `;
            adminProductsList.appendChild(row);
        });

        adminProductsList.querySelectorAll('.edit').forEach(button => {
            if (button._editListener) button.removeEventListener('click', button._editListener);
            const listener = (e) => {
                const productId = e.target.dataset.id;
                const productToEdit = fetchedProducts.find(p => p.id === productId);
                if (productToEdit) {
                    editProduct(productToEdit);
                }
            };
            button.addEventListener('click', listener);
            button._editListener = listener;
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
    }).catch(error => {
        console.error("Error rendering admin products:", error);
        adminProductsList.innerHTML = '<tr><td colspan="7" class="empty-message">Error loading products.</td></tr>';
    });
}


function editProduct(product) {
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

function resetProductForm() {
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

// MODIFIED: Updated to handle 'settings' tab
function showAdminTab(tabName) {
    adminTabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Hide all tab contents first
    adminProductManagement.style.display = 'none';
    adminOrderManagement.style.display = 'none';
    if (adminStoreSettings) { // Ensure element exists before manipulating
        adminStoreSettings.style.display = 'none';
    }

    // Unsubscribe from any active listeners to prevent conflicts/memory leaks
    if (unsubscribeAllOrders) unsubscribeAllOrders();
    if (unsubscribeStoreSettings) unsubscribeStoreSettings();

    if (tabName === 'products') {
        adminProductManagement.style.display = 'block';
        resetProductForm();
        renderAdminProducts();
    } else if (tabName === 'orders') {
        adminOrderManagement.style.display = 'block';
        adminOrderDetailsView.style.display = 'none';
        setupAllOrdersListener(); // Start listening to orders
    } else if (tabName === 'settings') { // Handle new settings tab
        if (adminStoreSettings) { // Ensure element exists before manipulating
            adminStoreSettings.style.display = 'block';
            setupStoreSettingsListener(); // Start listening to store settings
        }
    }
}

// Sets up a real-time listener for all orders in Firestore (for admin view).
function setupAllOrdersListener() {
    if (unsubscribeAllOrders) {
        unsubscribeAllOrders();
    }
    const allOrdersColRef = collection(dbInstance, ALL_ORDERS_COLLECTION_PATH);
    const q = query(allOrdersColRef, orderBy("orderDate", "desc"));
    unsubscribeAllOrders = onSnapshot(q, (snapshot) => {
        const fetchedOrders = [];
        snapshot.forEach(doc => {
            fetchedOrders.push({ id: doc.id, ...doc.data() });
        });
        allOrders = fetchedOrders;
        renderAdminOrders();
    }, (error) => {
        console.error("Error listening to all orders (admin):", error);
    });
}

function renderAdminOrders() {
    adminOrdersList.innerHTML = '';
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
            <td data-label="Status"><span class="order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}">${order.status}</span></td>
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
        button._viewListener = listener;
    });
}

function showAdminOrderDetails(order) {
    currentEditingOrderId = order.id;
    currentEditingOrderUserId = order.userId;
    adminOrdersList.parentElement.style.display = 'none';
    adminOrderDetailsView.style.display = 'block';

    adminDetailOrderId.textContent = order.id;
    adminDetailUserId.textContent = order.userId || 'N/A';
    adminDetailRobloxUsername.textContent = order.robloxUsername || 'N/A';
    adminDetailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
    adminDetailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
    adminDetailPaymentMethod.textContent = order.paymentMethod;
    adminDetailOrderStatus.textContent = order.status;
    adminDetailOrderStatus.className = `status-info order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}`;

    orderStatusSelect.value = order.status;

    adminDetailItemsList.innerHTML = '';
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'admin-order-detail-item';
            const imageUrl = `images/${item.image}`;
            itemDiv.innerHTML = `
                <span class="admin-order-detail-item-name">${item.name}</span>
                <span class="admin-order-detail-item-qty-price">Qty: ${item.quantity} - ${item.effectivePrice || item.price}</span>
            `;
            adminDetailItemsList.appendChild(itemDiv);
        });
    } else {
        adminDetailItemsList.innerHTML = '<p>No items found for this order.</p>';
    }
}

// --- NEW: Store Settings Functions (Admin) ---

// Sets up a real-time listener for the store settings document.
function setupStoreSettingsListener() {
    if (unsubscribeStoreSettings) {
        unsubscribeStoreSettings(); // Unsubscribe from previous listener if exists
    }
    const storeSettingsRef = doc(dbInstance, STORE_SETTINGS_DOC_PATH);
    unsubscribeStoreSettings = onSnapshot(storeSettingsRef, (docSnap) => {
        let isOnline = true; // Default status if document doesn't exist

        if (docSnap.exists()) {
            isOnline = docSnap.data().isOnline;
        } else {
            // If the document doesn't exist, create it with default online status
            setDoc(storeSettingsRef, { isOnline: true })
                .then(() => console.log("Store settings document created with default online status."))
                .catch(e => console.error("Error creating store settings:", e));
        }
        updateSellerStatusDisplay(isOnline);
    }, (error) => {
        console.error("Error listening to store settings:", error);
    });
}

// Updates the seller status display in both the admin panel and the main header.
function updateSellerStatusDisplay(isOnline) {
    if (adminSellerStatusDisplay) {
        adminSellerStatusDisplay.textContent = isOnline ? 'Online' : 'Offline';
        adminSellerStatusDisplay.classList.toggle('offline', !isOnline); // Apply offline class for red text
        adminSellerStatusDisplay.classList.toggle('online', isOnline); // Ensure online class for green text
    }
    if (headerSellerStatusText) { // This element is from the main page header, passed from script.js
        headerSellerStatusText.textContent = isOnline ? 'Online' : 'Offline';
        headerSellerStatusText.classList.toggle('offline', !isOnline); // Apply offline class for red text
        headerSellerStatusText.classList.toggle('online', isOnline); // Ensure online class for green text
    }
}


// Cleanup function for admin panel when user logs out
export function cleanupAdminPanel() {
    if (unsubscribeAllOrders) {
        unsubscribeAllOrders();
        unsubscribeAllOrders = null;
        console.log("Unsubscribed from allOrders listener.");
    }
    if (unsubscribeStoreSettings) { // NEW: Unsubscribe from store settings listener
        unsubscribeStoreSettings();
        unsubscribeStoreSettings = null;
        console.log("Unsubscribed from storeSettings listener.");
    }
    // Remove specific event listeners to prevent memory leaks/duplicate calls
    const adminPanelButton = document.getElementById("admin-panel-button");
    if (adminPanelButton && adminPanelButton._adminListener) {
        adminPanelButton.removeEventListener('click', adminPanelButton._adminListener);
        adminPanelButton._adminListener = null;
    }
    adminTabButtons.forEach(button => {
        if (button._tabListener) {
            button.removeEventListener('click', button._tabListener);
            button._tabListener = null;
        }
    });
    if (saveProductBtn._saveListener) { saveProductBtn.removeEventListener('click', saveProductBtn._saveListener); saveProductBtn._saveListener = null; }
    if (cancelEditProductBtn._cancelListener) { cancelEditProductBtn.removeEventListener('click', cancelEditProductBtn._cancelListener); cancelEditProductBtn._cancelListener = null; }
    if (adminBackToOrderListBtn._backListener) { adminBackToOrderListBtn.removeEventListener('click', adminBackToOrderListBtn._backListener); adminBackToOrderListBtn._backListener = null; }
    if (updateOrderStatusBtn._updateListener) { updateOrderStatusBtn.removeEventListener('click', updateOrderStatusBtn._updateListener); updateOrderStatusBtn._updateListener = null; }
    // NEW: Remove listener for toggleSellerStatusBtn
    if (toggleSellerStatusBtn && toggleSellerStatusBtn._toggleListener) { // Check if element exists before removing
        toggleSellerStatusBtn.removeEventListener('click', toggleSellerStatusBtn._toggleListener);
        toggleSellerStatusBtn._toggleListener = null;
    }


    // Any other cleanup for admin UI goes here
    adminPanelModal.classList.remove('show'); // Ensure admin modal is closed
}

// Export the initialization function for script.js to call
export { initAdminPanel, cleanupAdminPanel };
