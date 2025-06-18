// admin.js
// This file contains all logic and DOM manipulations specific to the admin panel.

import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, addDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
// Import Firebase Storage functions (kept in case product images or other storage needs arise in admin)
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";


// Global variables for admin-specific data and listeners
let allOrders = []; 
let unsubscribeAllOrders = null; 
let unsubscribeAdminSellerStatus = null; 
let dbInstance = null; 
let authInstance = null; 
let storageInstance = null; 
let adminUserId = null; 
let isAdminUser = false; 

// --- DOM elements for Admin Panel ---
const adminPanelModal = document.getElementById("admin-panel-modal");
const closeAdminPanelModalBtn = document.getElementById("close-admin-panel-modal");
const adminTabButtons = document.querySelectorAll(".admin-tab-btn");
const adminProductManagement = document.getElementById("admin-product-management");
const adminOrderManagement = document.getElementById("admin-order-management");
const adminSellerStatusTab = document.getElementById("admin-seller-status"); 

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

// Seller Status elements
const adminSellerStatusDisplay = document.getElementById("admin-seller-status-display");
const toggleSellerStatusBtn = document.getElementById("toggle-seller-status-btn");


// --- Firestore Collection Paths ---
const APP_ID = 'tempest-store-app'; 
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`; 
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`; 
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`; 
const SETTINGS_COLLECTION_PATH = `artifacts/${APP_ID}/settings`; 


// --- Admin Panel Functions ---
function initAdminPanel(db, auth, storage, userId, adminFlag) {
    console.log("[Admin Module] initAdminPanel called.");
    dbInstance = db;
    authInstance = auth;
    storageInstance = storage; 
    adminUserId = userId;
    isAdminUser = adminFlag;

    const adminPanelButton = document.getElementById("admin-panel-button");
    if (adminPanelButton) {
        if (adminPanelButton._adminListener) {
            adminPanelButton.removeEventListener('click', adminPanelButton._adminListener);
            console.log("[Admin Module] Removed existing adminPanelButton listener.");
        }
        const listener = () => {
             if (!isAdminUser) {
                alert("You are not authorized to access the Admin Panel.");
                console.warn("[Admin Module] Unauthorized access attempt to Admin Panel.");
                return;
            }
            adminPanelModal.classList.add('show');
            showAdminTab('products'); // Default to products tab on open
            console.log("[Admin Module] Admin Panel modal shown, defaulting to products tab.");
        };
        adminPanelButton.addEventListener('click', listener);
        adminPanelButton._adminListener = listener; 
    }

    closeAdminPanelModalBtn.addEventListener('click', () => {
        adminPanelModal.classList.remove('show');
        if (unsubscribeAllOrders) { // Unsubscribe from all orders when closing admin panel
            unsubscribeAllOrders();
            unsubscribeAllOrders = null;
            console.log("[Admin Module] Unsubscribed from allOrders listener on modal close.");
        }
        if (unsubscribeAdminSellerStatus) { 
            unsubscribeAdminSellerStatus();
            unsubscribeAdminSellerStatus = null;
            console.log("[Admin Module] Unsubscribed from admin seller status listener on modal close.");
        }
        console.log("[Admin Module] Admin Panel modal closed.");
    });

    adminPanelModal.addEventListener('click', (event) => {
        if (event.target === adminPanelModal) {
            adminPanelModal.classList.remove('show');
            console.log("[Admin Module] Admin Panel modal closed by clicking outside.");
        }
    });

    adminTabButtons.forEach(button => {
        if (button._tabListener) {
            button.removeEventListener('click', button._tabListener);
        }
        const listener = (e) => {
            const tab = e.target.dataset.tab;
            showAdminTab(tab);
            console.log("[Admin Module] Switched admin tab to:", tab);
        };
        button.addEventListener('click', listener);
        button._tabListener = listener; 
    });

    // Remove existing listeners for product form buttons to prevent duplicates
    if (saveProductBtn._saveListener) saveProductBtn.removeEventListener('click', saveProductBtn._saveListener);
    if (cancelEditProductBtn._cancelListener) cancelEditProductBtn.removeEventListener('click', cancelEditProductBtn._cancelListener);
    if (adminBackToOrderListBtn._backListener) adminBackToOrderListBtn.removeEventListener('click', adminBackToOrderListBtn._backListener);
    if (updateOrderStatusBtn._updateListener) updateOrderStatusBtn.removeEventListener('click', updateOrderStatusBtn._updateListener);
    if (toggleSellerStatusBtn._toggleListener) toggleSellerStatusBtn.removeEventListener('click', toggleSellerStatusBtn._toggleListener);


    saveProductBtn._saveListener = async () => { 
        console.log("[Admin Product] Save Product button clicked.");
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
            console.warn("[Admin Product] Product form validation failed.");
            return;
        }
        if (isSale && (salePrice === null || isNaN(parseFloat(salePrice.replace('₱', ''))))) {
            alert("Please enter a valid Sale Price if the product is On Sale.");
            console.warn("[Admin Product] Sale price validation failed.");
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

    adminBackToOrderListBtn._backListener = () => {
        adminOrdersList.parentElement.style.display = 'table'; 
        adminOrderDetailsView.style.display = 'none'; 
        currentEditingOrderId = null; 
        console.log("[Admin Order] Back to order list from details view.");
    };
    adminBackToOrderListBtn.addEventListener('click', adminBackToOrderListBtn._backListener);

    updateOrderStatusBtn._updateListener = async () => {
        console.log("[Admin Order] Update Order Status button clicked.");
        if (!currentEditingOrderId) {
            alert("No order selected for status update.");
            console.warn("[Admin Order] No order ID for status update.");
            return;
        }

        const newStatus = orderStatusSelect.value;
        try {
            const orderRef = doc(dbInstance, ALL_ORDERS_COLLECTION_PATH, currentEditingOrderId);
            await updateDoc(orderRef, { status: newStatus });
            console.log(`[Admin Order] Updated status in allOrders for ${currentEditingOrderId.substring(0, 8)}... to ${newStatus}.`);


            const orderToUpdate = allOrders.find(o => o.id === currentEditingOrderId);
            if (orderToUpdate && orderToUpdate.userId) {
                const userOrderRef = doc(dbInstance, USER_ORDERS_COLLECTION_PATH(orderToUpdate.userId), currentEditingOrderId);
                await updateDoc(userOrderRef, { status: newStatus });
                console.log(`[Admin Order] Updated status in user's order collection for ${orderToUpdate.userId.substring(0,8)}... to ${newStatus}.`);
            } else {
                console.warn(`[Admin Order] Could not find user ID for order ${currentEditingOrderId.substring(0, 8)}... to update user's collection.`);
            }

            alert(`Order ${currentEditingOrderId.substring(0, 8)}... status updated to ${newStatus}.`);
            adminBackToOrderListBtn.click();
        } catch (e) {
            console.error("[Admin Order] Error updating order status:", e);
            alert("Error updating order status: " + e.message);
        }
    };
    updateOrderStatusBtn.addEventListener('click', updateOrderStatusBtn._updateListener);

    // Seller Status Toggle Button
    toggleSellerStatusBtn._toggleListener = toggleSellerStatus;
    toggleSellerStatusBtn.addEventListener('click', toggleSellerStatusBtn._toggleListener);

    // Initial setup of listeners if admin is already logged in
    console.log("[Admin Module] Setting up initial listeners (allOrders and sellerStatus).");
    setupAllOrdersListener();
    setupAdminSellerStatusListener(); 
}

// Cleanup function for admin panel when user logs out or admin panel modal closes
function cleanupAdminPanel() {
    console.log("[Admin Module] Cleaning up admin panel listeners...");
    if (unsubscribeAllOrders) {
        unsubscribeAllOrders();
        unsubscribeAllOrders = null;
        console.log("[Admin Module] Unsubscribed from allOrders.");
    }
    if (unsubscribeAdminSellerStatus) {
        unsubscribeAdminSellerStatus();
        unsubscribeAdminSellerStatus = null;
        console.log("[Admin Module] Unsubscribed from admin seller status.");
    }
    currentEditingOrderId = null; 

    const adminPanelButton = document.getElementById("admin-panel-button");
    if (adminPanelButton && adminPanelButton._adminListener) {
        adminPanelButton.removeEventListener('click', adminPanelButton._adminListener);
        adminPanelButton._adminListener = null;
        console.log("[Admin Module] Removed adminPanelButton listener.");
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
    if (toggleSellerStatusBtn._toggleListener) { toggleSellerStatusBtn.removeEventListener('click', toggleSellerStatusBtn._toggleListener); toggleSellerStatusBtn._toggleListener = null; }


    adminPanelModal.classList.remove('show');
    console.log("[Admin Module] Admin panel modal closed and cleaned up.");
}


// Saves a product (new or existing) to Firestore.
async function saveProductToFirestore(productData) {
    try {
        if (productData.id) { 
            if (!confirm("Are you sure you want to save changes to this product?")) {
                console.log("[Admin Product] Save changes cancelled by user.");
                return; 
            }
            const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, productData.id);
            await updateDoc(productRef, productData);
            console.log("[Admin Product] Product updated in Firestore:", productData.id);
        } else { 
            const productsColRef = collection(dbInstance, PRODUCTS_COLLECTION_PATH);
            await addDoc(productsColRef, productData);
            console.log("[Admin Product] Product added to Firestore:", productData.name);
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
    if (confirm("Are you sure you want to delete this product?")) { 
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

// Renders the list of products in the admin panel's product management table.
function renderAdminProducts() {
    console.log("[Admin Product UI] Rendering admin products list.");
    adminProductsList.innerHTML = ''; 
    const productsColRef = collection(dbInstance, PRODUCTS_COLLECTION_PATH);
    getDocs(productsColRef).then((snapshot) => {
        const fetchedProducts = [];
        snapshot.forEach(doc => {
            fetchedProducts.push({ id: doc.id, ...doc.data() });
        });

        if (fetchedProducts.length === 0) {
            adminProductsList.innerHTML = '<tr><td colspan="7" class="empty-message">No products found.</td></tr>';
            console.log("[Admin Product UI] No products found to render.");
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
                        `<span style="text-decoration: line-through; color: #888;">₱${parseFloat(product.price.replace('₱', '')).toFixed(2)}</span> ₱${parseFloat(product.salePrice.replace('₱', '')).toFixed(2)}` : 
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
                    console.log("[Admin Product UI] Edit product button clicked for ID:", productId);
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
                console.log("[Admin Product UI] Delete product button clicked for ID:", productId);
            };
            button.addEventListener('click', listener);
            button._deleteListener = listener; 
        });
        console.log(`[Admin Product UI] Rendered ${fetchedProducts.length} products.`);
    }).catch(error => {
        console.error("[Admin Product UI] Error rendering admin products:", error);
        adminProductsList.innerHTML = '<tr><td colspan="7" class="empty-message">Error loading products.</td></tr>';
    });
}


function editProduct(product) {
    console.log("[Admin Product UI] Populating form for editing product:", product.id);
    productFormTitle.textContent = "Edit Product";
    productIdInput.value = product.id; 
    productNameInput.value = product.name;
    productCategorySelect.value = product.category;
    productPriceInput.value = parseFloat(product.price.replace('₱', '')); 
    productSalePriceInput.value = product.salePrice ? parseFloat(product.salePrice.replace('₱', '')).toFixed(2) : ''; 
    productStockInput.value = product.stock;
    productImageInput.value = product.image; 
    productNewCheckbox.checked = product.new || false;
    productSaleCheckbox.checked = product.sale || false;
    saveProductBtn.textContent = "Save Changes"; 
    cancelEditProductBtn.style.display = "inline-block"; 
}

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

function showAdminTab(tabName) {
    console.log("[Admin UI] Showing admin tab:", tabName);
    adminTabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    adminProductManagement.style.display = 'none';
    adminOrderManagement.style.display = 'none';
    adminSellerStatusTab.style.display = 'none'; 

    if (tabName === 'products') {
        adminProductManagement.style.display = 'block';
        resetProductForm(); 
        renderAdminProducts(); 
    } else if (tabName === 'orders') {
        adminOrderManagement.style.display = 'block';
        adminOrderDetailsView.style.display = 'none'; 
        renderAdminOrders(); 
    } else if (tabName === 'seller-status') { 
        adminSellerStatusTab.style.display = 'block';
        setupAdminSellerStatusListener(); 
    }
}

// Sets up a real-time listener for all orders in Firestore (for admin view).
function setupAllOrdersListener() {
    console.log("[Admin Orders] Setting up all orders listener.");
    if (unsubscribeAllOrders) {
        unsubscribeAllOrders();
        console.log("[Admin Orders] Unsubscribed from existing allOrders listener.");
    }
    const allOrdersColRef = collection(dbInstance, ALL_ORDERS_COLLECTION_PATH);
    const q = query(allOrdersColRef, orderBy("orderDate", "desc"));
    unsubscribeAllOrders = onSnapshot(q, (snapshot) => { 
        console.log("[Admin Orders] All orders listener triggered. Fetching orders...");
        const fetchedOrders = [];
        snapshot.forEach(doc => {
            fetchedOrders.push({ id: doc.id, ...doc.data() });
        });
        allOrders = fetchedOrders; 
        console.log(`[Admin Orders] Fetched ${allOrders.length} all orders.`);
        renderAdminOrders(); 
    }, (error) => {
        console.error("[Admin Orders] Error listening to all orders:", error);
    });
}

function renderAdminOrders() {
    console.log("[Admin Orders UI] Rendering admin orders list.");
    adminOrdersList.innerHTML = ''; 
    if (allOrders.length === 0) {
        adminOrdersList.innerHTML = '<tr><td colspan="6" class="empty-message">No orders found.</td></tr>';
        console.log("[Admin Orders UI] No orders found to render.");
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
                console.log("[Admin Orders UI] View order details button clicked for ID:", orderId);
            }
        };
        button.addEventListener('click', listener);
        button._viewListener = listener; 
    });
    console.log(`[Admin Orders UI] Rendered ${allOrders.length} orders.`);
}

function showAdminOrderDetails(order) {
    console.log("[Admin Orders UI] Showing admin order details for ID:", order.id);
    currentEditingOrderId = order.id; 
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

// --- Seller Status Management (Admin Side) ---
const SELLER_STATUS_DOC_PATH = doc(dbInstance, SETTINGS_COLLECTION_PATH, 'sellerStatus');

// Sets up a real-time listener for the seller status in the admin panel
function setupAdminSellerStatusListener() {
    console.log("[Admin Seller Status] Setting up listener.");
    if (unsubscribeAdminSellerStatus) {
        unsubscribeAdminSellerStatus(); 
        console.log("[Admin Seller Status] Unsubscribed from existing listener.");
    }
    unsubscribeAdminSellerStatus = onSnapshot(SELLER_STATUS_DOC_PATH, (docSnap) => {
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
            console.log("[Admin Seller Status] Document does not exist. Defaulting to Offline. Attempting to create default.");
            setDoc(SELLER_STATUS_DOC_PATH, { isOnline: false }, { merge: true }).catch(e => console.error("[Admin Seller Status] Error creating default seller status document:", e));
        }
    }, (error) => {
        console.error("[Admin Seller Status] Error listening to admin seller status:", error);
    });
}

// Toggles the seller's online/offline status in Firestore
async function toggleSellerStatus() {
    console.log("[Admin Seller Status] Toggle button clicked.");
    try {
        const docSnap = await getDoc(SELLER_STATUS_DOC_PATH);
        let currentStatus = false;
        if (docSnap.exists()) {
            currentStatus = docSnap.data().isOnline;
        }

        const newStatus = !currentStatus;
        await setDoc(SELLER_STATUS_DOC_PATH, { isOnline: newStatus }, { merge: true });
        alert(`Seller status updated to: ${newStatus ? 'Online' : 'Offline'}`);
        console.log(`[Admin Seller Status] Status toggled to: ${newStatus ? 'Online' : 'Offline'}`);
    } catch (e) {
        console.error("[Admin Seller Status] Error toggling seller status:", e);
        alert("Failed to toggle seller status. Please check console for details.");
    }
}


// Export the initialization function and cleanup for script.js to call
export { initAdminPanel, cleanupAdminPanel };
