"use strict";

/**
 * CONFIGURATION & CONSTANTS
 */
const STORAGE_KEY = "inventory_hub_data";

/**
 * CORE DATA CLASS (Model)
 * Handles all data operations and persistence
 */
class InventoryManager {
    constructor() {
        this.items = this.loadFromStorage();
        if (this.items.length === 0) {
            this.seedData();
        }
    }

    /**
     * Populate initial data for first-time users
     */
    seedData() {
        const initialData = [
            { id: 1, name: "Coffee Cups", category: "Coffee", quantity: 150, minQuantity: 50, maxStock: 200, cost: 0.15, location: "Shelf A1", lastRestocked: new Date().toISOString() },
            { id: 2, name: "Pepsi 12oz", category: "Drinks", quantity: 24, minQuantity: 30, maxStock: 50, cost: 0.75, location: "Fridge 1", lastRestocked: new Date().toISOString() },
            { id: 3, name: "Potato Chips", category: "Snacks", quantity: 45, minQuantity: 20, maxStock: 100, cost: 0.50, location: "Shelf B2", lastRestocked: new Date().toISOString() }
        ];
        this.items = initialData;
        this.saveToStorage();
    }

    loadFromStorage() {
        const data = localStorage.getItem(STORAGE_KEY);
        try {
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Failed to parse storage data", e);
            return [];
        }
    }

    saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    }

    addItem(item) {
        const newItem = {
            id: Date.now(),
            name: item.name,
            category: item.category,
            quantity: parseInt(item.quantity) || 0,
            minQuantity: parseInt(item.minQuantity) || 0,
            maxStock: parseInt(item.maxStock) || parseInt(item.minQuantity) * 2 || 0,
            cost: parseFloat(item.cost) || 0,
            location: item.location || "N/A",
            lastRestocked: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        this.items.push(newItem);
        this.saveToStorage();
        return newItem;
    }

    updateItem(id, updatedFields) {
        const index = this.items.findIndex(item => item.id === id);
        if (index !== -1) {
            this.items[index] = { 
                ...this.items[index], 
                ...updatedFields,
                id: id // Ensure ID never changes
            };
            
            // Re-enforce types
            this.items[index].quantity = parseInt(this.items[index].quantity) || 0;
            this.items[index].minQuantity = parseInt(this.items[index].minQuantity) || 0;
            this.items[index].maxStock = parseInt(this.items[index].maxStock) || 0;
            this.items[index].cost = parseFloat(this.items[index].cost) || 0;
            
            this.saveToStorage();
            return true;
        }
        return false;
    }

    deleteItem(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.saveToStorage();
    }

    getItem(id) {
        return this.items.find(item => item.id === id);
    }

    adjustQuantity(id, amount) {
        const item = this.getItem(id);
        if (item) {
            item.quantity = Math.max(0, item.quantity + amount);
            this.saveToStorage();
            return true;
        }
        return false;
    }

    getStats() {
        const totalItems = this.items.length;
        const lowStockItems = this.items.filter(item => item.quantity <= item.minQuantity && item.quantity > 0);
        const outOfStockItems = this.items.filter(item => item.quantity <= 0);
        const totalValue = this.items.reduce((sum, item) => sum + (item.quantity * item.cost), 0);
        const restockCost = this.getRestockCost();

        return { 
            totalItems, 
            lowStock: lowStockItems.length, 
            outOfStock: outOfStockItems.length, 
            totalValue,
            restockCost
        };
    }

    /**
     * Get all items that need restocking (quantity <= minimum)
     */
    getLowStockItems() {
        return this.items.filter(item => item.quantity <= item.minQuantity && item.quantity > 0).sort((a, b) => a.quantity - b.quantity);
    }

    /**
     * Get shopping list items with suggested purchase quantities
     */
    getShoppingListItems() {
        return this.items.filter(item => item.quantity <= item.minQuantity).map(item => ({
            ...item,
            suggestedPurchaseQty: (item.maxStock || item.minQuantity * 2) - item.quantity
        })).sort((a, b) => a.quantity - b.quantity);
    }

    /**
     * Calculate total restock cost for items needing purchase
     */
    getRestockCost() {
        return this.getShoppingListItems().reduce((sum, item) => {
            const neededQty = item.suggestedPurchaseQty;
            return sum + (neededQty * item.cost);
        }, 0);
    }

    /**
     * Mark item as purchased - restore to maximum stock and update last restocked date
     */
    markPurchased(id) {
        const item = this.getItem(id);
        if (item) {
            item.quantity = item.maxStock || item.minQuantity * 2;
            item.lastRestocked = new Date().toISOString();
            this.saveToStorage();
            return true;
        }
        return false;
    }

    search(query) {
        const q = query.toLowerCase().trim();
        if (!q) return this.items;
        return this.items.filter(item => 
            item.name.toLowerCase().includes(q) || 
            item.category.toLowerCase().includes(q) ||
            item.location.toLowerCase().includes(q)
        );
    }
}

/**
 * UI CONTROLLER (View/Controller)
 * Handles DOM manipulation and user interaction
 */
class InventoryUI {
    constructor(manager) {
        this.manager = manager;
        this.editingId = null;

        // Cache DOM Elements
        this.tableBody = document.getElementById("inventoryTable");
        this.modal = document.getElementById("itemModal");
        this.searchBox = document.getElementById("searchBox");
        
        // Form Fields
        this.form = {
            name: document.getElementById("itemName"),
            category: document.getElementById("itemCategory"),
            qty: document.getElementById("itemQty"),
            minQty: document.getElementById("itemMin"),
            maxStock: document.getElementById("itemMax"),
            cost: document.getElementById("itemCost"),
            location: document.getElementById("itemLocation")
        };

        // Stats Dashboard Elements
        this.stats = {
            total: document.getElementById("totalItems"),
            lowStock: document.getElementById("lowStock"),
            outOfStock: document.getElementById("outOfStock"),
            value: document.getElementById("inventoryValue"),
            restockCost: document.getElementById("restockCost")
        };

        this.init();
    }

    init() {
        // Core Button Listeners
        document.getElementById("addItemBtn").addEventListener("click", () => this.openModal());
        
        // Shopping List Buttons
        const generateShoppingListBtn = document.getElementById("generateShoppingListBtn");
        if (generateShoppingListBtn) {
            generateShoppingListBtn.addEventListener("click", () => this.renderShoppingList());
        }
        
        const exportShoppingListBtn = document.getElementById("exportShoppingListBtn");
        if (exportShoppingListBtn) {
            exportShoppingListBtn.addEventListener("click", () => this.exportShoppingListAsCSV());
        }
        
        // Modal Control Listeners
        const closeBtns = this.modal.querySelectorAll(".close, .cancel");
        closeBtns.forEach(btn => btn.addEventListener("click", () => this.closeModal()));
        
        this.modal.querySelector(".save").addEventListener("click", () => this.handleSave());
        
        // Outside Modal Click
        window.addEventListener("click", (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Search Input
        this.searchBox.addEventListener("input", (e) => this.renderTable(e.target.value));

        // Initial Render
        this.render();
    }

    openModal(id = null) {
        this.editingId = id;
        const modalTitle = this.modal.querySelector(".modal-header h2");
        const saveBtn = this.modal.querySelector(".save");
        
        if (id) {
            modalTitle.innerText = "Edit Inventory Item";
            saveBtn.innerText = "Update Item";
            const item = this.manager.getItem(id);
            if (item) {
                this.form.name.value = item.name;
                this.form.category.value = item.category;
                this.form.qty.value = item.quantity;
                this.form.minQty.value = item.minQuantity;
                this.form.maxStock.value = item.maxStock || item.minQuantity * 2;
                this.form.cost.value = item.cost;
                this.form.location.value = item.location;
            }
        } else {
            modalTitle.innerText = "Add Inventory Item";
            saveBtn.innerText = "Save Item";
            this.resetForm();
        }
        
        this.modal.classList.add("show");
    }

    closeModal() {
        this.modal.classList.remove("show");
        this.editingId = null;
        this.resetForm();
    }

    resetForm() {
        Object.values(this.form).forEach(input => {
            if (input) input.value = "";
        });
        // Set defaults
        if (this.form.category) this.form.category.value = "Drinks";
        if (this.form.qty) this.form.qty.value = "0";
        if (this.form.minQty) this.form.minQty.value = "5";
        if (this.form.maxStock) this.form.maxStock.value = "10";
        if (this.form.cost) this.form.cost.value = "0.00";
    }

    handleSave() {
        const itemData = {
            name: this.form.name.value.trim(),
            category: this.form.category.value,
            quantity: this.form.qty.value,
            minQuantity: this.form.minQty.value,
            maxStock: this.form.maxStock.value,
            cost: this.form.cost.value,
            location: this.form.location.value.trim()
        };

        if (!itemData.name) {
            alert("Please enter an item name.");
            return;
        }

        if (this.editingId) {
            this.manager.updateItem(this.editingId, itemData);
        } else {
            this.manager.addItem(itemData);
        }

        this.closeModal();
        this.render();
    }

    handleDelete(id) {
        if (confirm("Are you sure you want to delete this item?")) {
            this.manager.deleteItem(id);
            this.render();
        }
    }

    renderStats() {
        const stats = this.manager.getStats();
        if (this.stats.total) this.stats.total.innerText = stats.totalItems;
        if (this.stats.lowStock) this.stats.lowStock.innerText = stats.lowStock;
        if (this.stats.outOfStock) this.stats.outOfStock.innerText = stats.outOfStock;
        
        if (this.stats.value) {
            this.stats.value.innerText = new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD' 
            }).format(stats.totalValue);
        }

        if (this.stats.restockCost) {
            this.stats.restockCost.innerText = new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD' 
            }).format(stats.restockCost);
        }
    }

    /**
     * Render the "Needs Restocking" panel with low stock items
     */
    renderRestockPanel() {
        const lowStockItems = this.manager.getLowStockItems();
        const restockList = document.getElementById("restockList");
        const restockEmpty = document.getElementById("restockEmpty");

        if (!restockList) return;

        restockList.innerHTML = "";

        if (lowStockItems.length === 0) {
            restockList.style.display = "none";
            restockEmpty.style.display = "block";
            return;
        }

        restockEmpty.style.display = "none";
        restockList.style.display = "";

        lowStockItems.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td><span style="color: var(--danger); font-weight: 600;">${item.quantity}</span></td>
                <td>${item.minQuantity}</td>
            `;
            restockList.appendChild(tr);
        });
    }

    /**
     * Render the Shopping List section
     */
    renderShoppingList() {
        const shoppingListBody = document.getElementById("shoppingListBody");
        const shoppingListEmpty = document.getElementById("shoppingListEmpty");

        if (!shoppingListBody) return;

        const items = this.manager.getShoppingListItems();
        shoppingListBody.innerHTML = "";

        if (items.length === 0) {
            shoppingListBody.style.display = "none";
            shoppingListEmpty.style.display = "block";
            return;
        }

        shoppingListEmpty.style.display = "none";
        shoppingListBody.style.display = "";

        items.forEach(item => {
            const tr = document.createElement("tr");
            const totalCost = (item.suggestedPurchaseQty * item.cost).toFixed(2);
            tr.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td>${item.quantity}</td>
                <td>${item.minQuantity}</td>
                <td><span style="font-weight: 600; color: var(--blue);">${item.suggestedPurchaseQty}</span></td>
                <td>$${totalCost}</td>
                <td>
                    <button class="action-btn purchase-btn" data-id="${item.id}" title="Mark Purchased">
                        <i class="bi bi-check-circle"></i>
                    </button>
                </td>
            `;
            shoppingListBody.appendChild(tr);
        });

        // Attach mark purchased handlers
        this.attachShoppingListEvents();
    }

    /**
     * Attach event handlers for shopping list mark purchased buttons
     */
    attachShoppingListEvents() {
        document.querySelectorAll(".purchase-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                this.handleMarkPurchased(id);
            });
        });
    }

    /**
     * Handle marking item as purchased
     */
    handleMarkPurchased(id) {
        if (this.manager.markPurchased(id)) {
            this.render();
        }
    }

    /**
     * Export shopping list as CSV
     */
    exportShoppingListAsCSV() {
        const items = this.manager.getShoppingListItems();
        
        if (items.length === 0) {
            alert("No items to export. Generate shopping list first.");
            return;
        }

        // CSV header
        let csv = "Item Name,Current Quantity,Minimum Quantity,Suggested Purchase,Cost,Total Cost\n";

        // CSV data
        items.forEach(item => {
            const totalCost = (item.suggestedPurchaseQty * item.cost).toFixed(2);
            csv += `"${item.name}",${item.quantity},${item.minQuantity},${item.suggestedPurchaseQty},$${item.cost.toFixed(2)},$${totalCost}\n`;
        });

        // Add totals
        const totalSuggestedQty = items.reduce((sum, item) => sum + item.suggestedPurchaseQty, 0);
        const totalCost = items.reduce((sum, item) => sum + (item.suggestedPurchaseQty * item.cost), 0);
        csv += `\nTOTAL,,,${totalSuggestedQty},,$${totalCost.toFixed(2)}\n`;

        // Create blob and download
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `shopping-list-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    getStatusBadge(qty, min) {
        if (qty <= 0) return '<span class="status outofstock">Out of Stock</span>';
        if (qty <= min) return '<span class="status low">Low Stock</span>';
        return '<span class="status instock">In Stock</span>';
    }

    renderTable(query = "") {
        const items = this.manager.search(query);
        if (!this.tableBody) return;

        this.tableBody.innerHTML = "";

        if (items.length === 0) {
            this.tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 40px; color: #7A7A7A;">No items found.</td></tr>';
            return;
        }

        items.forEach(item => {
            const tr = document.createElement("tr");
            const isLow = item.quantity <= item.minQuantity;
            
            tr.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td>${item.category}</td>
                <td>
                    <div class="qty-control">
                        <button class="qty-btn minus" data-id="${item.id}">-</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn plus" data-id="${item.id}">+</button>
                    </div>
                </td>
                <td>${item.minQuantity}</td>
                <td>$${parseFloat(item.cost).toFixed(2)}</td>
                <td>${item.location}</td>
                <td>${this.getStatusBadge(item.quantity, item.minQuantity)}</td>
                <td class="actions-cell">
                    <button class="action-btn edit-btn" data-id="${item.id}" title="Edit"><i class="bi bi-pencil"></i></button>
                    <button class="action-btn delete-btn" data-id="${item.id}" title="Delete"><i class="bi bi-trash"></i></button>
                </td>
            `;

            if (isLow) tr.style.backgroundColor = "#FFF9E6";
            this.tableBody.appendChild(tr);
        });

        this.attachTableEvents();
    }

    /**
     * Using event delegation or direct attachment for table actions
     */
    attachTableEvents() {
        this.tableBody.querySelectorAll(".qty-btn").forEach(btn => {
            btn.onclick = (e) => {
                const id = parseInt(e.target.dataset.id);
                const amount = e.target.classList.contains("plus") ? 1 : -1;
                this.manager.adjustQuantity(id, amount);
                this.render();
            };
        });

        this.tableBody.querySelectorAll(".edit-btn").forEach(btn => {
            btn.onclick = (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                this.openModal(id);
            };
        });

        this.tableBody.querySelectorAll(".delete-btn").forEach(btn => {
            btn.onclick = (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                this.handleDelete(id);
            };
        });
    }

    render() {
        this.renderStats();
        this.renderRestockPanel();
        this.renderShoppingList();
        this.renderTable(this.searchBox ? this.searchBox.value : "");
    }
}

/**
 * NAVIGATION CONTROLLER
 * Handles view switching and navigation state
 */
class NavigationController {
    constructor() {
        this.currentView = "dashboard";
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Get all navigation links
        const navLinks = document.querySelectorAll(".nav-link");
        navLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                this.switchView(view);
            });
        });
    }

    switchView(viewName) {
        // Hide all sections
        const sections = document.querySelectorAll(".view-section");
        sections.forEach(section => {
            section.classList.remove("active");
        });

        // Show selected section
        const targetSection = document.getElementById(`${viewName}-view`);
        if (targetSection) {
            targetSection.classList.add("active");
        }

        // Update active nav link
        const navLinks = document.querySelectorAll(".nav-link");
        navLinks.forEach(link => {
            link.classList.remove("active");
            if (link.dataset.view === viewName) {
                link.classList.add("active");
            }
        });

        // Update page title and subtitle
        this.updatePageHeader(viewName);

        // Trigger render for the view
        this.renderViewContent(viewName);

        this.currentView = viewName;
    }

    updatePageHeader(viewName) {
        const pageTitle = document.getElementById("pageTitle");
        const pageSubtitle = document.getElementById("pageSubtitle");

                const titles = {
            dashboard: { title: "Dashboard", subtitle: "Inventory Overview" },
            cloud: { title: "Cloud Account", subtitle: "Sync and Backup" },
            inventory: { title: "Inventory", subtitle: "Manage your stock" },
            shopping: { title: "Shopping List", subtitle: "Items to purchase" },
            reports: { title: "Reports", subtitle: "Analytics and insights" },
            settings: { title: "Settings", subtitle: "Configuration and preferences" }
        };

        const config = titles[viewName] || titles.dashboard;
        if (pageTitle) pageTitle.innerText = config.title;
        if (pageSubtitle) pageSubtitle.innerText = config.subtitle;
    }

        renderViewContent(viewName) {
        // Trigger specific render for the view
        if (viewName === "reports" && window.reportsController) {
            window.reportsController.render();
        } else if (viewName === "settings" && window.settingsController) {
            window.settingsController.render();
        } else if (viewName === "dashboard" && window.ui) {
            window.ui.render();
        } else if (viewName === "shopping" && window.ui) {
            window.ui.renderShoppingList();
        } else if (viewName === "cloud") {
            // Initial cloud view check
            const isRegistered = localStorage.getItem('IQ_USER_REGISTERED');
            if (!isRegistered) {
                document.getElementById('onboardingWizard').style.display = 'flex';
            }
        }
    }
}

/**
 * REPORTS CONTROLLER
 * Generates and displays inventory reports
 */
class ReportsController {
    constructor(manager) {
        this.manager = manager;
    }

    render() {
        this.renderInventoryValueReport();
        this.renderCategoryBreakdown();
        this.renderLowStockSummary();
        this.renderOutOfStockSummary();
        this.renderRecentRestocks();
    }

    renderInventoryValueReport() {
        const stats = this.manager.getStats();
        const totalValue = stats.totalValue;
        const avgValue = this.manager.items.length > 0 ? totalValue / this.manager.items.length : 0;

        const totalValueEl = document.getElementById("reportTotalValue");
        const avgValueEl = document.getElementById("reportAvgValue");

        if (totalValueEl) {
            totalValueEl.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue);
        }

        if (avgValueEl) {
            avgValueEl.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(avgValue);
        }
    }

    renderCategoryBreakdown() {
        const categoryBreakdown = document.getElementById("categoryBreakdown");
        if (!categoryBreakdown) return;

        const categories = {};
        this.manager.items.forEach(item => {
            if (!categories[item.category]) {
                categories[item.category] = { count: 0, value: 0 };
            }
            categories[item.category].count++;
            categories[item.category].value += item.quantity * item.cost;
        });

        categoryBreakdown.innerHTML = "";
        Object.entries(categories).forEach(([category, data]) => {
            const div = document.createElement("div");
            div.className = "category-item";
            div.innerHTML = `
                <span>${category}</span>
                <span class="count">${data.count} item${data.count !== 1 ? 's' : ''}</span>
            `;
            categoryBreakdown.appendChild(div);
        });
    }

    renderLowStockSummary() {
        const lowStockItems = this.manager.getLowStockItems();
        const lowStockCost = this.manager.getRestockCost();

        const lowCountEl = document.getElementById("reportLowCount");
        const lowCostEl = document.getElementById("reportLowCost");

        if (lowCountEl) lowCountEl.innerText = lowStockItems.length;
        if (lowCostEl) {
            lowCostEl.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(lowStockCost);
        }
    }

    renderOutOfStockSummary() {
        const outOfStockItems = this.manager.items.filter(item => item.quantity <= 0);
        const outCountEl = document.getElementById("reportOutCount");
        const outItemsEl = document.getElementById("reportOutItems");

        if (outCountEl) outCountEl.innerText = outOfStockItems.length;

        if (outItemsEl) {
            outItemsEl.innerHTML = "";
            if (outOfStockItems.length === 0) {
                outItemsEl.innerHTML = '<p style="color: var(--gray); font-size: 14px;">All items in stock</p>';
            } else {
                outOfStockItems.forEach(item => {
                    const div = document.createElement("div");
                    div.style.fontSize = "14px";
                    div.style.padding = "4px 0";
                    div.innerHTML = `<strong>${item.name}</strong> <span style="color: var(--gray);">(${item.category})</span>`;
                    outItemsEl.appendChild(div);
                });
            }
        }
    }

    renderRecentRestocks() {
        const recentRestocksTable = document.getElementById("recentRestocksTable");
        if (!recentRestocksTable) return;

        // Sort by lastRestocked date (most recent first)
        const sorted = [...this.manager.items].sort((a, b) => {
            const dateA = new Date(a.lastRestocked || 0);
            const dateB = new Date(b.lastRestocked || 0);
            return dateB - dateA;
        }).slice(0, 10); // Show last 10

        recentRestocksTable.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: var(--blue); color: white;">
                    <tr>
                        <th style="padding: 12px 16px; text-align: left; font-weight: 600; font-size: 14px;">Item Name</th>
                        <th style="padding: 12px 16px; text-align: left; font-weight: 600; font-size: 14px;">Category</th>
                        <th style="padding: 12px 16px; text-align: left; font-weight: 600; font-size: 14px;">Current Qty</th>
                        <th style="padding: 12px 16px; text-align: left; font-weight: 600; font-size: 14px;">Last Restocked</th>
                    </tr>
                </thead>
                <tbody id="restocksBody">
                </tbody>
            </table>
        `;

        const tbody = document.getElementById("restocksBody");
        sorted.forEach(item => {
            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid var(--border)";
            const lastRestocked = new Date(item.lastRestocked);
            const formattedDate = lastRestocked.toLocaleDateString() + " " + lastRestocked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            tr.innerHTML = `
                <td style="padding: 12px 16px;"><strong>${item.name}</strong></td>
                <td style="padding: 12px 16px;">${item.category}</td>
                <td style="padding: 12px 16px;">${item.quantity}</td>
                <td style="padding: 12px 16px; color: var(--gray);">${formattedDate}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

/**
 * SETTINGS CONTROLLER
 * Handles application settings and data management
 */
class SettingsController {
    constructor(manager) {
        this.manager = manager;
        this.setupEventListeners();
        this.loadSettings();
    }

    setupEventListeners() {
        const saveSettingsBtn = document.getElementById("saveSettingsBtn");
        const exportAllBtn = document.getElementById("exportAllBtn");
        const importAllBtn = document.getElementById("importAllBtn");
        const importFile = document.getElementById("importFile");
        const resetDataBtn = document.getElementById("resetDataBtn");

        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener("click", () => this.saveSettings());
        }

        if (exportAllBtn) {
            exportAllBtn.addEventListener("click", () => this.exportAllInventory());
        }

        if (importAllBtn) {
            importAllBtn.addEventListener("click", () => {
                if (importFile) importFile.click();
            });
        }

        if (importFile) {
            importFile.addEventListener("change", (e) => this.importInventory(e));
        }

        if (resetDataBtn) {
            resetDataBtn.addEventListener("click", () => this.resetData());
        }
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem("inventory_hub_settings")) || {
            businessName: "InventoryHub",
            defaultCurrency: "USD",
            lowStockWarning: true
        };

        const businessNameEl = document.getElementById("businessName");
        const currencyEl = document.getElementById("defaultCurrency");
        const warningEl = document.getElementById("lowStockWarning");

        if (businessNameEl) businessNameEl.value = settings.businessName;
        if (currencyEl) currencyEl.value = settings.defaultCurrency;
        if (warningEl) warningEl.checked = settings.lowStockWarning;
    }

    saveSettings() {
        const businessName = document.getElementById("businessName").value || "InventoryHub";
        const defaultCurrency = document.getElementById("defaultCurrency").value || "USD";
        const lowStockWarning = document.getElementById("lowStockWarning").checked;

        const settings = {
            businessName,
            defaultCurrency,
            lowStockWarning
        };

        localStorage.setItem("inventory_hub_settings", JSON.stringify(settings));
        alert("Settings saved successfully!");
    }

    exportAllInventory() {
        const data = {
            exportDate: new Date().toISOString(),
            items: this.manager.items,
            stats: this.manager.getStats()
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", `inventory-export-${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert("Inventory exported successfully!");
    }

    importInventory(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.items && Array.isArray(data.items)) {
                    if (confirm("This will replace your current inventory. Continue?")) {
                        this.manager.items = data.items;
                        this.manager.saveToStorage();
                        alert("Inventory imported successfully!");
                        if (window.ui) window.ui.render();
                        if (window.reportsController) window.reportsController.render();
                    }
                } else {
                    alert("Invalid import file format.");
                }
            } catch (error) {
                alert("Error importing file: " + error.message);
            }
        };
        reader.readAsText(file);

        // Reset file input
        e.target.value = "";
    }

    resetData() {
        if (confirm("This will reset all inventory to sample data. Continue?")) {
            this.manager.items = [];
            this.manager.seedData();
            alert("Inventory reset to sample data!");
            if (window.ui) window.ui.render();
            if (window.reportsController) window.reportsController.render();
        }
    }

    render() {
        this.loadSettings();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const activityManager = new ActivityManager();
    const historyManager = new HistoryManager();
    const barcodeManager = new BarcodeManager();
    const cloudManager = new CloudManager(); // v4.0 Cloud Foundation
    const inventoryManager = new InventoryManager(activityManager, historyManager, barcodeManager, cloudManager);
    
    const analyticsManager = new AnalyticsManager(inventoryManager, historyManager);
    const analyticsUI = new AnalyticsUI(analyticsManager);

    const ui = new InventoryUI(inventoryManager, activityManager);
    window.navigation = new NavigationController(ui, activityManager, historyManager, barcodeManager, analyticsUI);
    new ScannerController(ui, inventoryManager, historyManager, barcodeManager);
    
    // Initialize Wizard Controller
    window.wizard = new OnboardingWizard(cloudManager);
});

/**
 * ONBOARDING WIZARD CONTROLLER
 */
class OnboardingWizard {
    constructor(cloudManager) {
        this.cloudManager = cloudManager;
        this.currentStep = 1;
        this.totalSteps = 5;
        this.data = {
            orgName: '',
            orgCode: '',
            orgType: 'Retail',
            ownerName: '',
            ownerEmail: '',
            ownerPass: '',
            brandColor: '#0056B3',
            darkMode: false
        };

        this.elements = {
            wizard: document.getElementById('onboardingWizard'),
            progressBar: document.getElementById('wizardProgress'),
            stepNum: document.getElementById('currentStepNum'),
            steps: document.querySelectorAll('.wizard-step'),
            codeStatus: document.getElementById('codeStatus')
        };

        this.init();
    }

    init() {
        // Next Buttons
        document.querySelectorAll('.btn-next').forEach(btn => {
            btn.onclick = () => {
                if (this.validateStep(this.currentStep)) {
                    this.goToStep(parseInt(btn.dataset.next));
                }
            };
        });

        // Prev Buttons
        document.querySelectorAll('.btn-prev').forEach(btn => {
            btn.onclick = () => this.goToStep(parseInt(btn.dataset.prev));
        });

        // Code Validation
        const codeInput = document.getElementById('wizOrgCode');
        if (codeInput) {
            codeInput.oninput = (e) => {
                let code = e.target.value.toUpperCase().replace(/\s+/g, '');
                e.target.value = code;
                this.checkCodeAvailability(code);
            };
        }

        // Finish Button
        const finishBtn = document.getElementById('btnFinishWizard');
        if (finishBtn) {
            finishBtn.onclick = () => this.handleFinish();
        }

        // Login Button in Step 1
        const loginBtn = document.querySelector('.btn-login');
        if (loginBtn) {
            loginBtn.onclick = () => {
                this.elements.wizard.style.display = 'none';
                window.navigation.switchView('cloud');
            };
        }
    }

    showWizard() {
        if (this.elements.wizard) this.elements.wizard.style.display = 'flex';
    }

    goToStep(step) {
        this.currentStep = step;
        
        // Update UI
        this.elements.steps.forEach(s => s.classList.remove('active'));
        document.getElementById(`step${step}`).classList.add('active');
        
        // Update Progress
        const progress = (step / this.totalSteps) * 100;
        this.elements.progressBar.style.width = `${progress}%`;
        this.elements.stepNum.innerText = step;

        if (step === 5) this.populateReview();
    }

    validateStep(step) {
        if (step === 2) {
            const name = document.getElementById('wizOrgName').value;
            const code = document.getElementById('wizOrgCode').value;
            if (!name || code.length < 4) {
                alert("Please enter a valid company name and code (min 4 chars).");
                return false;
            }
            this.data.orgName = name;
            this.data.orgCode = code;
            this.data.orgType = document.getElementById('wizOrgType').value;
        }
        if (step === 3) {
            const name = document.getElementById('wizOwnerName').value;
            const email = document.getElementById('wizOwnerEmail').value;
            const pass = document.getElementById('wizOwnerPass').value;
            if (!name || !email || pass.length < 6) {
                alert("Please complete all owner details. Password must be at least 6 characters.");
                return false;
            }
            this.data.ownerName = name;
            this.data.ownerEmail = email;
            this.data.ownerPass = pass;
        }
        if (step === 4) {
            this.data.brandColor = document.getElementById('wizBrandColor').value;
            this.data.darkMode = document.getElementById('wizDarkMode').checked;
        }
        return true;
    }

    checkCodeAvailability(code) {
        const reserved = ['ADMIN', 'ROOT', 'SYSTEM', 'SUPERADMIN', 'INVENTORYIQ', 'IQ', 'TEST', 'DEMO', 'OWNER', 'NULL'];
        const status = document.getElementById('codeStatus');
        if (!status) return;

        if (code.length < 4) {
            status.innerHTML = '';
            return;
        }
        if (reserved.includes(code)) {
            status.innerHTML = '❌ Reserved';
            return;
        }
        status.innerHTML = '✅ Available';
    }

    populateReview() {
        document.getElementById('revOrgName').innerText = this.data.orgName;
        document.getElementById('revOrgCode').innerText = this.data.orgCode;
        document.getElementById('revOwnerName').innerText = this.data.ownerName;
        document.getElementById('revOwnerEmail').innerText = this.data.ownerEmail;
    }

    async handleFinish() {
        try {
            await this.cloudManager.createOrganization(this.data);
            localStorage.setItem('IQ_USER_REGISTERED', 'true');
            
            this.elements.wizard.style.display = 'none';
            window.navigation.switchView('dashboard');
            alert(`Welcome to Inventory IQ, ${this.data.ownerName}!`);
        } catch (err) {
            alert("Error creating company: " + err.message);
        }
    }
}