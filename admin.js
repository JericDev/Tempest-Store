// admin.js
// This file contains all logic and DOM manipulations specific to the admin panel.

import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, addDoc, deleteDoc, getDocs, limit } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
// Import Firebase Storage functions
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";


// Global variables for admin-specific data and listeners
let allOrders = []; 
let allChats = []; 
let unsubscribeAllOrders = null; 
let unsubscribeAdminChatList = null; 
let unsubscribeAdminChatMessages = null; 
let unsubscribeAdminSellerStatus = null; // New unsubscribe for admin seller status
let dbInstance = null; 
let authInstance = null; 
let storageInstance = null; 
let adminUserId = null; 
let isAdminUser = false; 
let currentAdminChatId = null; 

// Variables for image upload in admin chat
let adminSelectedImageFile = null; 

// --- DOM elements for Admin Panel ---
const adminPanelModal = document.getElementById("admin-panel-modal");
const closeAdminPanelModalBtn = document.getElementById("close-admin-panel-modal");
const adminTabButtons = document.querySelectorAll(".admin-tab-btn");
const adminProductManagement = document.getElementById("admin-product-management");
const adminOrderManagement = document.getElementById("admin-order-management");
const adminChatManagement = document.getElementById("admin-chat-management"); 
const adminSellerStatusTab = document.getElementById("admin-seller-status"); // New Seller Status tab content

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

// Admin Chat elements
const adminChatConversationsList = document.getElementById("admin-chat-conversations-list");
const adminChatPartnerName = document.getElementById("admin-chat-partner-name");
const adminChatMessagesContainer = document.getElementById("admin-chat-messages");
const adminChatMessageInput = document.getElementById("admin-chat-message-input");
const adminSendChatMessageBtn = document.getElementById("admin-send-chat-message-btn");
const adminImageUploadInput = document.getElementById("admin-image-upload"); 
const adminImagePreview = document.getElementById("admin-image-preview");     

// Seller Status elements
const adminSellerStatusDisplay = document.getElementById("admin-seller-status-display");
const toggleSellerStatusBtn = document.getElementById("toggle-seller-status-btn");


// --- Firestore Collection Paths ---
const APP_ID = 'tempest-store-app'; 
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`; 
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`; 
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`; 
const CHATS_COLLECTION_PATH = `artifacts/${APP_ID}/chats`; 
const SETTINGS_COLLECTION_PATH = `artifacts/${APP_ID}/settings`; // New settings collection


// --- Admin Panel Functions ---
function initAdminPanel(db, auth, storage, userId, adminFlag) {
    dbInstance = db;
    authInstance = auth;
    storageInstance = storage; 
    adminUserId = userId;
    isAdminUser = adminFlag;

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
            showAdminTab('products'); 
        };
        adminPanelButton.addEventListener('click', listener);
        adminPanelButton._adminListener = listener;
    }

    closeAdminPanelModalBtn.addEventListener('click', () => {
        adminPanelModal.classList.remove('show');
        if (unsubscribeAdminChatList) {
            unsubscribeAdminChatList();
            unsubscribeAdminChatList = null;
        }
        if (unsubscribeAdminChatMessages) {
            unsubscribeAdminChatMessages();
            unsubscribeAdminChatMessages = null;
        }
        if (unsubscribeAdminSellerStatus) { // Unsubscribe seller status
            unsubscribeAdminSellerStatus();
            unsubscribeAdminSellerStatus = null;
        }
        currentAdminChatId = null; 
        adminSelectedImageFile = null; 
        adminImagePreview.style.display = 'none';
        adminImagePreview.src = '#';
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
    if (adminSendChatMessageBtn._sendChatListener) adminSendChatMessageBtn.removeEventListener('click', adminSendChatMessageBtn._sendChatListener);
    if (adminChatMessageInput._keyPressListener) adminChatMessageInput.removeEventListener('keypress', adminChatMessageInput._keyPressListener);
    if (adminImageUploadInput._changeListener) adminImageUploadInput.removeEventListener('change', adminImageUploadInput._changeListener);
    if (toggleSellerStatusBtn._toggleListener) toggleSellerStatusBtn.removeEventListener('click', toggleSellerStatusBtn._toggleListener);


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

    adminBackToOrderListBtn._backListener = () => {
        adminOrdersList.parentElement.style.display = 'table'; 
        adminOrderDetailsView.style.display = 'none'; 
        currentEditingOrderId = null; 
    };
    adminBackToOrderListBtn.addEventListener('click', adminBackToOrderListBtn._backListener);

    updateOrderStatusBtn._updateListener = async () => {
        if (!currentEditingOrderId) {
            alert("No order selected for status update.");
            return;
        }

        const newStatus = orderStatusSelect.value;
        try {
            const orderRef = doc(dbInstance, ALL_ORDERS_COLLECTION_PATH, currentEditingOrderId);
            await updateDoc(orderRef, { status: newStatus });

            const orderToUpdate = allOrders.find(o => o.id === currentEditingOrderId);
            if (orderToUpdate && orderToUpdate.userId) {
                const userOrderRef = doc(dbInstance, USER_ORDERS_COLLECTION_PATH(orderToUpdate.userId), currentEditingOrderId);
                await updateDoc(userOrderRef, { status: newStatus });
            }

            alert(`Order ${currentEditingOrderId.substring(0, 8)}... status updated to ${newStatus}.`);
            adminBackToOrderListBtn.click();
        } catch (e) {
            console.error("Error updating order status:", e);
            alert("Error updating order status: " + e.message);
        }
    };
    updateOrderStatusBtn.addEventListener('click', updateOrderStatusBtn._updateListener);

    // Admin Chat Message Sending
    adminSendChatMessageBtn._sendChatListener = sendAdminMessage;
    adminSendChatMessageBtn.addEventListener('click', adminSendChatMessageBtn._sendChatListener);

    adminChatMessageInput._keyPressListener = (e) => {
        if (e.key === 'Enter') {
            sendAdminMessage();
        }
    };
    adminChatMessageInput.addEventListener('keypress', adminChatMessageInput._keyPressListener);

    // Admin Image Upload handling
    adminImageUploadInput._changeListener = (event) => {
        const file = event.target.files[0];
        if (file) {
            adminSelectedImageFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                adminImagePreview.src = e.target.result;
                adminImagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            adminSelectedImageFile = null;
            adminImagePreview.style.display = 'none';
            adminImagePreview.src = '#';
        }
    };
    adminImageUploadInput.addEventListener('change', adminImageUploadInput._changeListener);

    // Seller Status Toggle Button
    toggleSellerStatusBtn._toggleListener = toggleSellerStatus;
    toggleSellerStatusBtn.addEventListener('click', toggleSellerStatusBtn._toggleListener);

    // Initialize admin listeners if an admin is already logged in
    setupAllOrdersListener();
    setupAdminChatListListener(); 
    setupAdminSellerStatusListener(); // Start listening for seller status in admin panel
}

// Cleanup function for admin panel when user logs out
function cleanupAdminPanel() {
    if (unsubscribeAllOrders) {
        unsubscribeAllOrders();
        unsubscribeAllOrders = null;
    }
    if (unsubscribeAdminChatList) {
        unsubscribeAdminChatList();
        unsubscribeAdminChatList = null;
    }
    if (unsubscribeAdminChatMessages) {
        unsubscribeAdminChatMessages();
        unsubscribeAdminChatMessages = null;
    }
    if (unsubscribeAdminSellerStatus) {
        unsubscribeAdminSellerStatus();
        unsubscribeAdminSellerStatus = null;
    }
    currentAdminChatId = null;
    adminSelectedImageFile = null; 
    adminImagePreview.style.display = 'none';
    adminImagePreview.src = '#';
    adminChatMessageInput.value = ''; 


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
    if (adminSendChatMessageBtn._sendChatListener) { adminSendChatMessageBtn.removeEventListener('click', adminSendChatMessageBtn._sendChatListener); adminSendChatMessageBtn._sendChatListener = null; }
    if (adminChatMessageInput._keyPressListener) { adminChatMessageInput.removeEventListener('keypress', adminChatMessageInput._keyPressListener); adminChatMessageInput._keyPressListener = null; }
    if (adminImageUploadInput._changeListener) { adminImageUploadInput.removeEventListener('change', adminImageUploadInput._changeListener); adminImageUploadInput._changeListener = null; }
    if (toggleSellerStatusBtn._toggleListener) { toggleSellerStatusBtn.removeEventListener('click', toggleSellerStatusBtn._toggleListener); toggleSellerStatusBtn._toggleListener = null; }


    adminPanelModal.classList.remove('show');
}


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

function showAdminTab(tabName) {
    adminTabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    adminProductManagement.style.display = 'none';
    adminOrderManagement.style.display = 'none';
    adminChatManagement.style.display = 'none'; 
    adminSellerStatusTab.style.display = 'none'; // Hide seller status tab

    // Clean up chat listeners if switching away from chat tab
    if (tabName !== 'admin-chat') {
        if (unsubscribeAdminChatMessages) {
            unsubscribeAdminChatMessages();
            unsubscribeAdminChatMessages = null;
        }
        currentAdminChatId = null; 
        adminChatMessageInput.disabled = true;
        adminSendChatMessageBtn.disabled = true;
        adminChatMessagesContainer.innerHTML = '<p class="empty-message">Select a conversation to view messages.</p>';
        adminChatPartnerName.textContent = 'Select a chat';
        adminSelectedImageFile = null; 
        adminImagePreview.style.display = 'none';
        adminImagePreview.src = '#';
        adminChatMessageInput.value = ''; 
    }

    if (tabName === 'products') {
        adminProductManagement.style.display = 'block';
        resetProductForm(); 
        renderAdminProducts(); 
    } else if (tabName === 'orders') {
        adminOrderManagement.style.display = 'block';
        adminOrderDetailsView.style.display = 'none'; 
        renderAdminOrders(); 
    } else if (tabName === 'admin-chat') { 
        adminChatManagement.style.display = 'flex'; 
        renderAdminChatList(); 
    } else if (tabName === 'seller-status') { // New seller status tab
        adminSellerStatusTab.style.display = 'block';
        setupAdminSellerStatusListener(); // Ensure listener is active for this tab
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

// --- Chat System (Admin Side) ---
function getChatId(user1Id, user2Id) {
    const ids = [user1Id, user2Id].sort();
    return `${ids[0]}_${ids[1]}`;
}

function setupAdminChatListListener() {
    if (unsubscribeAdminChatList) {
        unsubscribeAdminChatList();
    }
    const chatsColRef = collection(dbInstance, CHATS_COLLECTION_PATH);
    const q = query(
        chatsColRef, 
        orderBy('updatedAt', 'desc')
    ); 
    
    unsubscribeAdminChatList = onSnapshot(q, (snapshot) => {
        const fetchedChats = [];
        snapshot.forEach(doc => {
            const chatData = doc.data();
            if (chatData.participants && chatData.participants.includes(adminUserId)) {
                fetchedChats.push({ id: doc.id, ...chatData });
            }
        });
        allChats = fetchedChats;
        renderAdminChatList();
    }, (error) => {
        console.error("Error listening to admin chat list:", error);
    });
}

function renderAdminChatList() {
    adminChatConversationsList.innerHTML = '';
    if (allChats.length === 0) {
        adminChatConversationsList.innerHTML = '<li class="empty-message">No conversations yet.</li>';
        return;
    }

    allChats.forEach(chat => {
        const otherParticipantId = chat.participants.find(pId => pId !== adminUserId);
        const lastMessageSnippet = chat.lastMessage ? `${chat.lastMessage.senderId === adminUserId ? 'You' : otherParticipantId.substring(0, 4)}: ${chat.lastMessage.text ? chat.lastMessage.text.substring(0, 30) + (chat.lastMessage.text.length > 30 ? '...' : '') : (chat.lastMessage.imageUrl ? 'Image' : '')}` : 'No messages yet.';
        const lastMessageTime = chat.lastMessage ? new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        const listItem = document.createElement('li');
        listItem.classList.add('chat-list-item');
        listItem.dataset.chatId = chat.id;
        listItem.innerHTML = `
            <strong>User: ${otherParticipantId.substring(0, 8)}...</strong>
            <p>${lastMessageSnippet}</p>
            <span>${lastMessageTime}</span>
        `;
        if (chat.id === currentAdminChatId) {
            listItem.classList.add('active');
        }
        adminChatConversationsList.appendChild(listItem);
    });

    adminChatConversationsList.querySelectorAll('.chat-list-item').forEach(item => {
        if (item._chatSelectListener) item.removeEventListener('click', item._chatSelectListener);
        const listener = (e) => {
            const chatId = e.currentTarget.dataset.chatId;
            openAdminChat(chatId);
            adminChatConversationsList.querySelectorAll('.chat-list-item').forEach(li => li.classList.remove('active'));
            e.currentTarget.classList.add('active');
        };
        item.addEventListener('click', listener);
        item._chatSelectListener = listener;
    });
}

async function openAdminChat(chatId) {
    if (unsubscribeAdminChatMessages) {
        unsubscribeAdminChatMessages(); 
    }
    currentAdminChatId = chatId; 

    const selectedChat = allChats.find(chat => chat.id === chatId);
    const otherParticipantId = selectedChat ? selectedChat.participants.find(pId => pId !== adminUserId) : 'Unknown User';
    adminChatPartnerName.textContent = `Chat with User: ${otherParticipantId.substring(0, 8)}...`;

    adminChatMessageInput.disabled = false;
    adminSendChatMessageBtn.disabled = false;
    adminChatMessageInput.focus(); 

    adminSelectedImageFile = null;
    adminImagePreview.style.display = 'none';
    adminImagePreview.src = '#';
    adminImageUploadInput.value = ''; 


    const messagesColRef = collection(dbInstance, CHATS_COLLECTION_PATH, chatId, 'messages');
    const q = query(messagesColRef, orderBy("timestamp", "asc"));

    unsubscribeAdminChatMessages = onSnapshot(q, (snapshot) => {
        adminChatMessagesContainer.innerHTML = ''; 
        if (snapshot.empty) {
            adminChatMessagesContainer.innerHTML = '<p class="empty-message">No messages yet. Send your first message!</p>';
        } else {
            snapshot.forEach(doc => {
                const message = doc.data();
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('chat-message');
                messageDiv.classList.add(message.senderId === adminUserId ? 'sent' : 'received'); 

                const senderInfo = message.senderId === adminUserId ? 'You (Admin)' : `User ${otherParticipantId.substring(0, 8)}...`;
                const timestamp = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let messageContent = '';
                if (message.text) {
                    messageContent += `<div class="message-bubble">${message.text}</div>`;
                }
                if (message.imageUrl) {
                    messageContent += `<div class="message-image-container"><img src="${message.imageUrl}" alt="Sent image" style="max-width: 100%; height: auto; border-radius: 8px; margin-top: 5px;" /></div>`;
                }

                messageDiv.innerHTML = `
                    ${messageContent}
                    <div class="message-meta">${senderInfo} - ${timestamp}</div>
                `;
                adminChatMessagesContainer.appendChild(messageDiv);
            });
            adminChatMessagesContainer.scrollTop = adminChatMessagesContainer.scrollHeight; 
        }
    }, (error) => {
        console.error("Error listening to admin chat messages:", error);
    });
}

async function sendAdminMessage() {
    const messageText = adminChatMessageInput.value.trim();
    
    if (!messageText && !adminSelectedImageFile) {
        return; 
    }

    if (!currentAdminChatId || !adminUserId) {
        alert("Cannot send message: Chat is not properly initialized or admin not logged in.");
        return;
    }

    let imageUrl = null;
    let imagePath = null;

    if (adminSelectedImageFile) {
        try {
            const storageRef = ref(storageInstance, `chats/${currentAdminChatId}/${Date.now()}_${adminSelectedImageFile.name}`);
            const uploadResult = await uploadBytes(storageRef, adminSelectedImageFile);
            imageUrl = await getDownloadURL(uploadResult.ref);
            imagePath = uploadResult.ref.fullPath;
            console.log("Admin image uploaded:", imageUrl);
        } catch (e) {
            console.error("Error uploading admin image:", e);
            alert("Failed to upload image. Please try again.");
            return;
        }
    }

    try {
        const messagesColRef = collection(dbInstance, CHATS_COLLECTION_PATH, currentAdminChatId, 'messages');
        await addDoc(messagesColRef, {
            senderId: adminUserId,
            text: messageText,
            imageUrl: imageUrl, 
            imagePath: imagePath,
            timestamp: new Date().toISOString()
        });

        const chatDocRef = doc(dbInstance, CHATS_COLLECTION_PATH, currentAdminChatId);
        const selectedChat = allChats.find(chat => chat.id === currentAdminChatId);
        const otherParticipantId = selectedChat.participants.find(pId => pId !== adminUserId);
        const lastMessageText = messageText || (imageUrl ? "Image" : "");

        await setDoc(chatDocRef, {
            participants: [adminUserId, otherParticipantId].sort(),
            lastMessage: {
                senderId: adminUserId,
                text: lastMessageText,
                timestamp: new Date().toISOString()
            },
            updatedAt: new Date().toISOString()
        }, { merge: true });

        adminChatMessageInput.value = ''; 
        adminSelectedImageFile = null; 
        adminImagePreview.style.display = 'none';
        adminImagePreview.src = '#';
        adminImageUploadInput.value = ''; 
        adminChatMessagesContainer.scrollTop = adminChatMessagesContainer.scrollHeight; 
    } catch (e) {
        console.error("Error sending admin message:", e);
        alert("Failed to send message. Please try again.");
    }
}

// --- Seller Status Management (Admin Side) ---
const SELLER_STATUS_DOC_PATH = doc(dbInstance, SETTINGS_COLLECTION_PATH, 'sellerStatus');

// Sets up a real-time listener for the seller status in the admin panel
function setupAdminSellerStatusListener() {
    if (unsubscribeAdminSellerStatus) {
        unsubscribeAdminSellerStatus(); // Unsubscribe from previous listener if it exists
    }
    unsubscribeAdminSellerStatus = onSnapshot(SELLER_STATUS_DOC_PATH, (docSnap) => {
        if (docSnap.exists()) {
            const statusData = docSnap.data();
            const isOnline = statusData.isOnline;
            adminSellerStatusDisplay.textContent = isOnline ? 'Online' : 'Offline';
            adminSellerStatusDisplay.classList.toggle('online', isOnline);
            adminSellerStatusDisplay.classList.toggle('offline', !isOnline);
        } else {
            adminSellerStatusDisplay.textContent = 'Offline';
            adminSellerStatusDisplay.classList.remove('online');
            adminSellerStatusDisplay.classList.add('offline');
            // Create the default status document if it's missing (should only happen once)
            setDoc(SELLER_STATUS_DOC_PATH, { isOnline: false }, { merge: true }).catch(e => console.error("Error creating default seller status document:", e));
        }
    }, (error) => {
        console.error("Error listening to admin seller status:", error);
    });
}

// Toggles the seller's online/offline status in Firestore
async function toggleSellerStatus() {
    try {
        const docSnap = await getDoc(SELLER_STATUS_DOC_PATH);
        let currentStatus = false;
        if (docSnap.exists()) {
            currentStatus = docSnap.data().isOnline;
        }

        const newStatus = !currentStatus;
        await setDoc(SELLER_STATUS_DOC_PATH, { isOnline: newStatus }, { merge: true });
        alert(`Seller status updated to: ${newStatus ? 'Online' : 'Offline'}`);
    } catch (e) {
        console.error("Error toggling seller status:", e);
        alert("Failed to toggle seller status. Please check console for details.");
    }
}


// Export the initialization function and cleanup for script.js to call
export { initAdminPanel, cleanupAdminPanel };
