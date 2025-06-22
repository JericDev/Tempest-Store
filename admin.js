// admin.js
// This file contains all logic and DOM manipulations specific to the admin panel.

import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, addDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables for admin-specific data and listeners
let allOrders = []; // Global array to store all orders for admin view
let unsubscribeAllOrders = null; // Unsubscribe function for allOrders listener
let dbInstance = null; // Firestore instance passed from script.js
let authInstance = null; // Auth instance passed from script.js
let adminUserId = null; // Admin user ID passed from script.js
let isAdminUser = false; // Is Admin flag passed from script.js
let toggleSellerStatusCallback = null; // Callback function to update seller status in script.js
let getSellerStatusFn = null; // Function to get the current seller status from script.js

// --- DOM elements for Admin Panel ---
const adminPanelModal = document.getElementById("admin-panel-modal");
const closeAdminPanelModalBtn = document.getElementById("close-admin-panel-modal");
const adminTabButtons = document.querySelectorAll(".admin-tab-btn");
const adminProductManagement = document.getElementById("admin-product-management");
const adminOrderManagement = document.getElementById("admin-order-management");
const adminSiteSettings = document.getElementById("admin-site-settings"); // Site Settings container

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
// New Flash Sale elements
const productFlashSaleCheckbox = document.getElementById("product-flash-sale");
const productFlashSalePriceInput = document.getElementById("product-flash-sale-price");
const productFlashSaleEndTimeInput = document.getElementById("product-flash-sale-end-time"); // New input for datetime-local

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

// Seller Status Toggle elements
const sellerOnlineToggle = document.getElementById("seller-online-toggle");
const sellerStatusText = document.getElementById("seller-status-text");

// --- Firestore Collection Paths (These are defined locally in admin.js for clarity) ---
const APP_ID = 'tempest-store-app'; // Ensure this matches APP_ID in script.js
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`;
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`;
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`;
const SITE_SETTINGS_COLLECTION_PATH = `artifacts/${APP_ID}/settings`; // Path for site settings


// --- Admin Panel Functions ---
// Modified to accept a function to get seller status
function initAdminPanel(db, auth, userId, adminFlag, toggleStatusFn, getSellerStatusCurrentFn) {
    dbInstance = db;
    authInstance = auth;
    adminUserId = userId;
    isAdminUser = adminFlag;
    toggleSellerStatusCallback = toggleStatusFn; // Store the callback function
    getSellerStatusFn = getSellerStatusCurrentFn; // Store the getter function

    // Attach event listener for the admin panel button
    const adminPanelButton = document.getElementById("admin-panel-button");
    if (adminPanelButton) {
        if (adminPanelButton._adminListener) {
            adminPanelButton.removeEventListener('click', adminPanelButton._adminListener);
        }
        const listener = () => {
            if (!isAdminUser) {
                showCustomAlert("You are not authorized to access the Admin Panel. Please log in with an admin account.");
                return;
            }
            adminPanelModal.classList.add('show');
            showAdminTab('products'); // Default to product management tab when opening
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

    // Remove existing listeners for product form buttons to prevent duplicates
    if (saveProductBtn._saveListener) saveProductBtn.removeEventListener('click', saveProductBtn._saveListener);
    if (cancelEditProductBtn._cancelListener) cancelEditProductBtn.removeEventListener('click', cancelEditProductBtn._cancelListener);
    if (adminBackToOrderListBtn._backListener) adminBackToOrderListBtn.removeEventListener('click', adminBackToOrderListBtn._backListener);
    if (updateOrderStatusBtn._updateListener) updateOrderStatusBtn.removeEventListener('click', updateOrderStatusBtn._updateListener);
    if (sellerOnlineToggle._toggleListener) sellerOnlineToggle.removeEventListener('change', sellerOnlineToggle._toggleListener);
    // Remove existing listeners for checkbox logic to prevent duplicates
    if (productSaleCheckbox._saleListener) productSaleCheckbox.removeEventListener('change', productSaleCheckbox._saleListener);
    if (productFlashSaleCheckbox._flashSaleListener) productFlashSaleCheckbox.removeEventListener('change', productFlashSaleCheckbox._flashSaleListener);


    saveProductBtn._saveListener = async () => {
        const productId = productIdInput.value;
        const isNew = productNewCheckbox.checked;
        let isSale = productSaleCheckbox.checked;
        let isFlashSale = productFlashSaleCheckbox.checked;

        let salePrice = null;
        if (isSale && productSalePriceInput.value.trim() !== '') {
            salePrice = `₱${parseFloat(productSalePriceInput.value).toFixed(2)}`;
        }

        let flashSalePrice = null;
        let flashSaleEndTime = null;
        if (isFlashSale && productFlashSalePriceInput.value.trim() !== '' && productFlashSaleEndTimeInput.value.trim() !== '') {
            flashSalePrice = `₱${parseFloat(productFlashSalePriceInput.value).toFixed(2)}`;
            // Store ISO string for consistency and easier comparison
            flashSaleEndTime = new Date(productFlashSaleEndTimeInput.value).toISOString();
        }

        let productImage = productImageInput.value.trim();

        const newProduct = {
            name: productNameInput.value.trim(),
            category: productCategorySelect.value,
            price: `₱${parseFloat(productPriceInput.value).toFixed(2)}`,
            salePrice: salePrice,
            stock: parseInt(productStockInput.value),
            image: productImage,
            new: isNew,
            sale: isSale,
            // New Flash Sale fields
            flashSale: isFlashSale,
            flashSalePrice: flashSalePrice,
            flashSaleEndTime: flashSaleEndTime
        };

        // Basic validation
        if (!newProduct.name || !newProduct.image || isNaN(newProduct.stock) || isNaN(parseFloat(newProduct.price.replace('₱', '')))) {
            showCustomAlert("Please fill in all product fields correctly (Name, Image Filename, Price, Stock).");
            return;
        }
        if (isSale && (salePrice === null || isNaN(parseFloat(salePrice.replace('₱', ''))))) {
            showCustomAlert("Please enter a valid Sale Price if the product is On Sale.");
            return;
        }
        if (isFlashSale && (flashSalePrice === null || isNaN(parseFloat(flashSalePrice.replace('₱', ''))) || flashSaleEndTime === null)) {
            showCustomAlert("Please enter a valid Flash Sale Price and End Time if the product is On Flash Sale.");
            return;
        }
        
        // If flash sale is active, it should ideally override standard sale
        // This is handled by the checkbox logic, but a final check here doesn't hurt.
        if (isFlashSale) {
            newProduct.sale = false; // Disable regular sale if flash sale is active
            newProduct.salePrice = null; // Clear regular sale price
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
        currentEditingOrderUserId = null;
    };
    adminBackToOrderListBtn.addEventListener('click', adminBackToOrderListBtn._backListener);

    updateOrderStatusBtn._updateListener = async () => {
        if (!currentEditingOrderId || !currentEditingOrderUserId) {
            showCustomAlert("No order selected or user ID is missing. Cannot update status.");
            return;
        }

        const newStatus = orderStatusSelect.value;
        try {
            // Path to the order in the central 'allOrders' collection
            const allOrdersRef = doc(dbInstance, ALL_ORDERS_COLLECTION_PATH, currentEditingOrderId);
            
            // Path to the order in the user-specific subcollection
            const userOrderRef = doc(dbInstance, USER_ORDERS_COLLECTION_PATH(currentEditingOrderUserId), currentEditingOrderId);

            // Update the status in BOTH locations
            await updateDoc(allOrdersRef, { status: newStatus });
            await updateDoc(userOrderRef, { status: newStatus });

            showCustomAlert(`Order ${currentEditingOrderId.substring(0, 8)}... status updated to ${newStatus}.`);
            adminBackToOrderListBtn.click(); // Return to the list view

        } catch (e) {
            console.error("Error updating order status in both locations:", e);
            showCustomAlert("Error updating order status: " + e.message + "\n\nNote: This may be due to Firestore Security Rules. Ensure the admin account's UID is correctly set in your rules.");
        }
    };
    updateOrderStatusBtn.addEventListener('click', updateOrderStatusBtn._updateListener);

    // Event listener for the seller online toggle
    sellerOnlineToggle._toggleListener = (event) => {
        const isChecked = event.target.checked;
        if (toggleSellerStatusCallback) {
            toggleSellerStatusCallback(isChecked);
        }
        renderSellerStatusToggle(isChecked); // Keep this for immediate visual feedback
    };
    sellerOnlineToggle.addEventListener('change', sellerOnlineToggle._toggleListener);

    // --- Checkbox Logic for Sale and Flash Sale ---
    productSaleCheckbox._saleListener = () => {
        if (productSaleCheckbox.checked && productFlashSaleCheckbox.checked) {
            // If Sale is checked AND Flash Sale is already checked, uncheck Flash Sale
            productFlashSaleCheckbox.checked = false;
            productFlashSalePriceInput.disabled = true;
            productFlashSaleEndTimeInput.disabled = true;
            productFlashSalePriceInput.value = '';
            productFlashSaleEndTimeInput.value = '';
        }
        // Enable/disable sale price input based on sale checkbox
        productSalePriceInput.disabled = !productSaleCheckbox.checked;
        if (!productSaleCheckbox.checked) {
            productSalePriceInput.value = ''; // Clear value if unchecked
        }
    };
    productSaleCheckbox.addEventListener('change', productSaleCheckbox._saleListener);

    productFlashSaleCheckbox._flashSaleListener = () => {
        const isChecked = productFlashSaleCheckbox.checked;
        if (isChecked && productSaleCheckbox.checked) {
            // If Flash Sale is checked AND Sale is already checked, uncheck Sale
            productSaleCheckbox.checked = false;
            productSalePriceInput.disabled = true;
            productSalePriceInput.value = '';
        }
        // Enable/disable flash sale price/time inputs based on flash sale checkbox
        productFlashSalePriceInput.disabled = !isChecked;
        productFlashSaleEndTimeInput.disabled = !isChecked;
        if (!isChecked) {
            productFlashSalePriceInput.value = '';
            productFlashSaleEndTimeInput.value = '';
        }
    };
    productFlashSaleCheckbox.addEventListener('change', productFlashSaleCheckbox._flashSaleListener);


    setupAllOrdersListener(); // Initialize admin listeners if an admin is already logged in
}

// Cleanup function for admin panel when user logs out
function cleanupAdminPanel() {
    if (unsubscribeAllOrders) {
        unsubscribeAllOrders();
        unsubscribeAllOrders = null;
    }
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
    if (sellerOnlineToggle._toggleListener) { sellerOnlineToggle.removeEventListener('change', sellerOnlineToggle._toggleListener); sellerOnlineToggle._toggleListener = null; }
    // Clean up checkbox listeners
    if (productSaleCheckbox._saleListener) { productSaleCheckbox.removeEventListener('change', productSaleCheckbox._saleListener); productSaleCheckbox._saleListener = null; }
    if (productFlashSaleCheckbox._flashSaleListener) { productFlashSaleCheckbox.removeEventListener('change', productFlashSaleCheckbox._flashSaleListener); productFlashSaleCheckbox._flashSaleListener = null; }


    adminPanelModal.classList.remove('show'); // Ensure admin modal is closed
}

function editProduct(product) {
    productFormTitle.textContent = "Edit Product";
    productIdInput.value = product.id;
    productNameInput.value = product.name;
    productCategorySelect.value = product.category;
    productPriceInput.value = parseFloat(String(product.price).replace('₱', ''));
    productSalePriceInput.value = product.salePrice ? parseFloat(String(product.salePrice).replace('₱', '')) : '';
    productStockInput.value = product.stock;
    productImageInput.value = product.image;
    productNewCheckbox.checked = product.new || false;
    productSaleCheckbox.checked = product.sale || false;
    
    // Flash Sale fields
    productFlashSaleCheckbox.checked = product.flashSale || false;
    productFlashSalePriceInput.value = product.flashSalePrice ? parseFloat(String(product.flashSalePrice).replace('₱', '')) : '';
    // Format ISO string to datetime-local format (YYYY-MM-DDTHH:MM)
    if (product.flashSaleEndTime) {
        const date = new Date(product.flashSaleEndTime);
        // Ensure leading zeros for month, day, hour, minute
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        productFlashSaleEndTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
        productFlashSaleEndTimeInput.value = '';
    }

    // Call the checkbox logic to correctly enable/disable inputs and handle mutual exclusivity
    // This simulates a 'change' event for each checkbox to apply the rules
    productSaleCheckbox.dispatchEvent(new Event('change'));
    productFlashSaleCheckbox.dispatchEvent(new Event('change'));

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
    // Reset Flash Sale fields
    productFlashSaleCheckbox.checked = false;
    productFlashSalePriceInput.value = '';
    productFlashSaleEndTimeInput.value = '';
    
    // Ensure inputs are disabled when form is reset
    productSalePriceInput.disabled = true;
    productFlashSalePriceInput.disabled = true;
    productFlashSaleEndTimeInput.disabled = true;

    saveProductBtn.textContent = "Add Product";
    cancelEditProductBtn.style.display = "none";
}

function showAdminTab(tabName) {
    adminTabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    adminProductManagement.style.display = 'none';
    adminOrderManagement.style.display = 'none';
    adminSiteSettings.style.display = 'none';

    if (tabName === 'products') {
        adminProductManagement.style.display = 'block';
        resetProductForm();
        renderAdminProducts();
    } else if (tabName === 'orders') {
        adminOrderManagement.style.display = 'block';
        adminOrderDetailsView.style.display = 'none';
        renderAdminOrders();
    } else if (tabName === 'settings') {
        adminSiteSettings.style.display = 'block';
        // Get the latest seller status from script.js using the passed getter function
        if (getSellerStatusFn) {
            const currentSellerStatus = getSellerStatusFn();
            console.log('Admin Panel: Initializing toggle with sellerIsOnline:', currentSellerStatus); // Debugging line
            renderSellerStatusToggle(currentSellerStatus);
        } else {
            console.error("getSellerStatusFn is not defined in admin.js. Cannot sync seller status toggle.");
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
                <span class="admin-order-detail-item-qty-price">Qty: ${item.quantity} - ₱${(parseFloat(String(item.effectivePrice || item.price).replace('₱', '')) * item.quantity).toFixed(2)}</span>
            `;
            adminDetailItemsList.appendChild(itemDiv);
        });
    } else {
        adminDetailItemsList.innerHTML = '<p>No items found for this order.</p>';
    }
}

function renderSellerStatusToggle(isOnline) {
    sellerOnlineToggle.checked = isOnline;
    sellerStatusText.textContent = isOnline ? "Online" : "Offline";
    sellerStatusText.classList.toggle('status-online', isOnline);
    sellerStatusText.classList.toggle('status-offline', !isOnline);
}

// Saves a product (new or existing) to Firestore.
async function saveProductToFirestore(productData) {
    try {
        if (productData.id) {
            showCustomConfirm("Are you sure you want to save changes to this product?", async () => {
                const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, productData.id);
                await updateDoc(productRef, productData);
                console.log("Product updated:", productData.id);
                resetProductForm();
                showCustomAlert("Product saved successfully!");
            });
        } else {
            const productsColRef = collection(dbInstance, PRODUCTS_COLLECTION_PATH);
            await addDoc(productsColRef, productData);
            console.log("Product added:", productData.name);
            resetProductForm();
            showCustomAlert("Product saved successfully!");
        }
    } catch (e) {
        console.error("Error saving product:", e);
        showCustomAlert("Error saving product: " + e.message);
    }
}

// Deletes a product from Firestore.
async function deleteProductFromFirestore(productId) {
    showCustomConfirm("Are you sure you want to delete this product?", async () => {
        try {
            const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, productId);
            await deleteDoc(productRef);
            console.log("Product deleted:", productId);
            showCustomAlert("Product deleted successfully!");
        } catch (e) {
            console.error("Error deleting product:", e);
            showCustomAlert("Error deleting product: " + e.message);
        }
    });
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
            adminProductsList.innerHTML = '<tr><td colspan="8" class="empty-message">No products found.</td></tr>'; // Adjusted colspan
            return;
        }

        fetchedProducts.forEach(product => {
            const row = document.createElement('tr');
            const imageUrl = `images/${product.image}`;
            // Determine the price display for admin table
            let adminPriceDisplay = product.price;
            let statusBadges = [];

            const now = new Date();
            const isFlashSaleActive = product.flashSale && product.flashSalePrice && product.flashSaleEndTime && new Date(product.flashSaleEndTime) > now;

            if (isFlashSaleActive) {
                adminPriceDisplay = `<span style="text-decoration: line-through; color: #888; font-size: 0.9em;">${product.price}</span> ${product.flashSalePrice}`;
                statusBadges.push('FLASH SALE');
            } else if (product.sale && product.salePrice) {
                adminPriceDisplay = `<span style="text-decoration: line-through; color: #888; font-size: 0.9em;">${product.price}</span> ${product.salePrice}`;
                statusBadges.push('SALE');
            }

            if (product.new) {
                statusBadges.push('NEW');
            }

            row.innerHTML = `
                <td data-label="Image"><img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/50x50/f0f0f0/888?text=N/A';" /></td>
                <td data-label="Name">${product.name}</td>
                <td data-label="Category">${product.category}</td>
                <td data-label="Price">${adminPriceDisplay}</td>
                <td data-label="Stock">${product.stock}</td>
                <td data-label="Status">${statusBadges.join(' / ')}</td>
                <td data-label="Flash Sale End">${product.flashSale && product.flashSaleEndTime ? new Date(product.flashSaleEndTime).toLocaleString() : 'N/A'}</td>
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
        adminProductsList.innerHTML = '<tr><td colspan="8" class="empty-message">Error loading products.</td></tr>'; // Adjusted colspan
    });
}

// Custom Alert/Confirm functions to replace native ones
function showCustomAlert(message) {
    const alertModal = document.createElement('div');
    alertModal.className = 'custom-modal';
    alertModal.innerHTML = `
        <div class="custom-modal-content">
            <span class="custom-modal-close-btn">&times;</span>
            <p>${message}</p>
            <button class="custom-modal-ok-btn">OK</button>
        </div>
    `;
    document.body.appendChild(alertModal);

    const closeBtn = alertModal.querySelector('.custom-modal-close-btn');
    const okBtn = alertModal.querySelector('.custom-modal-ok-btn');

    const closeModal = () => {
        alertModal.classList.remove('show');
        setTimeout(() => alertModal.remove(), 300);
    };

    closeBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', closeModal);
    alertModal.addEventListener('click', (event) => {
        if (event.target === alertModal) {
            closeModal();
        }
    });

    setTimeout(() => alertModal.classList.add('show'), 10);
}

function showCustomConfirm(message, onConfirm) {
    const confirmModal = document.createElement('div');
    confirmModal.className = 'custom-modal';
    confirmModal.innerHTML = `
        <div class="custom-modal-content">
            <span class="custom-modal-close-btn">&times;</span>
            <p>${message}</p>
            <div class="custom-modal-buttons">
                <button class="custom-modal-confirm-btn">Yes</button>
                <button class="custom-modal-cancel-btn">No</button>
            </div>
        </div>
    `;
    document.body.appendChild(confirmModal);

    const closeBtn = confirmModal.querySelector('.custom-modal-close-btn');
    const confirmBtn = confirmModal.querySelector('.custom-modal-confirm-btn');
    const cancelBtn = confirmModal.querySelector('.custom-modal-cancel-btn');

    const closeModal = () => {
        confirmModal.classList.remove('show');
        setTimeout(() => confirmModal.remove(), 300);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', () => {
        onConfirm();
        closeModal();
    });
    confirmModal.addEventListener('click', (event) => {
        if (event.target === confirmModal) {
            closeModal();
        }
    });

    setTimeout(() => confirmModal.classList.add('show'), 10);
}

// Export the initialization function for script.js to call
export { initAdminPanel, cleanupAdminPanel };
