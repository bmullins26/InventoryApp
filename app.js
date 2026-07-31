/**
 * InventoryHub - Professional Inventory Management
 */

"use strict";

const STORAGE_KEY = "inventory_hub_data";
const ACTIVITY_KEY = "inventory_hub_activities";

/**
 * ACTIVITY MANAGER
 * Tracks every inventory action for audit trail
 */
class ActivityManager {
    constructor() {
        this.activities = this.loadFromStorage();
        this.maxEntries = 500;
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem(ACTIVITY_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error loading activities", e);
            return [];
        }
    }

    saveToStorage() {
        const limited = this.activities.slice(-this.maxEntries);
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(limited));
    }

    log(action, itemName, prevQty = null, newQty = null, notes = "") {
        const activity = {
            id: Date.now(),
            dateTime: new Date().toISOString(),
            itemName,
            action,
            prevQty,
            newQty,
            notes
        };
        this.activities.push(activity);
        this.saveToStorage();
    }

    getRecent(count = 10) {
        return [...this.activities].reverse().slice(0, count);
    }

    getAll() {
        return [...this.activities].reverse();
    }

    search(query) {
        const q = query.toLowerCase().trim();
        return this.getAll().filter(a => 
            a.itemName.toLowerCase().includes(q) ||
            a.action.toLowerCase().includes(q) ||
            a.notes.toLowerCase().includes(q) ||
            new Date(a.dateTime).toLocaleDateString().includes(q)
        );
    }

    exportCSV() {
        let csv = "Date,Time,Item,Action,Prev Qty,New Qty,Notes\n";
        this.getAll().forEach(a => {
            const d = new Date(a.dateTime);
            csv += `"${d.toLocaleDateString()}","${d.toLocaleTimeString()}","${a.itemName}","${a.action}",${a.prevQty ?? "-"},${a.newQty ?? "-"},"${a.notes}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity_log_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }
}

/**
 * INVENTORY DATA MANAGER
 */
class InventoryManager {
    constructor(activityManager, historyManager) {
        this.activityManager = activityManager;
        this.historyManager = historyManager;
        this.items = this.loadFromStorage();
        this.migrateData();
        if (this.items.length === 0) {
            this.seedData();
        }
    }

    migrateData() {
        let changed = false;
        this.items.forEach(item => {
            if (item.manufacturerBarcode === undefined) {
                item.manufacturerBarcode = "";
                item.barcodeType = "Code128";
                item.lastScanned = null;
                changed = true;
            }
        });
        if (changed) this.saveToStorage();
    }

    seedData() {
        const initialData = [
            { id: 1, name: "Coffee Cups", category: "Supplies", quantity: 150, minQuantity: 50, cost: 0.15, location: "Shelf A1", manufacturerBarcode: "", barcodeType: "Code128" },
            { id: 2, name: "Pepsi 12oz", category: "Drinks", quantity: 24, minQuantity: 30, cost: 0.75, location: "Fridge 1", manufacturerBarcode: "012000000133", barcodeType: "UPC-A" },
            { id: 3, name: "Potato Chips", category: "Snacks", quantity: 45, minQuantity: 20, cost: 0.50, location: "Shelf B2", manufacturerBarcode: "", barcodeType: "Code128" }
        ];
        this.items = initialData;
        this.saveToStorage();
        this.activityManager.log("Reset Sample Data", "System", null, null, "Inventory reset to defaults");
        
        this.items.forEach(item => {
            this.historyManager.log("Initial Inventory", item, item.quantity, "System Setup");
        });
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    }

    getItem(id) {
        return this.items.find(item => item.id === id);
    }

    addItem(data) {
        if (data.manufacturerBarcode && this.items.some(i => i.manufacturerBarcode === data.manufacturerBarcode)) {
            alert("Error: Barcode already assigned to another product.");
            return null;
        }

        const newItem = {
            id: Date.now(),
            name: data.name.trim(),
            category: data.category,
            quantity: parseInt(data.quantity) || 0,
            minQuantity: parseInt(data.minQuantity) || 0,
            maxStock: parseInt(data.maxStock) || 0,
            cost: parseFloat(data.cost) || 0,
            location: data.location.trim() || "N/A",
            manufacturerBarcode: data.manufacturerBarcode || "",
            barcodeType: data.barcodeType || "Code128",
            lastScanned: null
        };
        this.items.push(newItem);
        this.saveToStorage();
        this.activityManager.log("Add Item", newItem.name, 0, newItem.quantity, `Category: ${newItem.category}`);
        this.historyManager.log("Item Added", newItem, newItem.quantity, "New item created");
        return newItem;
    }

    updateItem(id, data) {
        if (data.manufacturerBarcode && this.items.some(i => i.id !== id && i.manufacturerBarcode === data.manufacturerBarcode)) {
            alert("Error: Barcode already assigned to another product.");
            return false;
        }

        const index = this.items.findIndex(item => item.id === id);
        if (index !== -1) {
            const old = this.items[index];
            const newQty = parseInt(data.quantity) || 0;
            const change = newQty - old.quantity;
            
            this.items[index] = {
                ...old,
                name: data.name.trim(),
                category: data.category,
                quantity: newQty,
                minQuantity: parseInt(data.minQuantity) || 0,
                maxStock: parseInt(data.maxStock) || 0,
                cost: parseFloat(data.cost) || 0,
                location: data.location.trim() || "N/A",
                manufacturerBarcode: data.manufacturerBarcode || "",
                barcodeType: data.barcodeType || old.barcodeType
            };
            this.saveToStorage();
            this.activityManager.log("Edit Item", data.name, old.quantity, newQty);
            
            if (change !== 0) {
                this.historyManager.log("Manual Adjustment", this.items[index], change, "Item edited in list");
            }
            
            return true;
        }
        return false;
    }

    deleteItem(id) {
        const item = this.getItem(id);
        if (item) {
            this.historyManager.log("Item Deleted", item, -item.quantity, "Permanently removed");
            this.items = this.items.filter(i => i.id !== id);
            this.saveToStorage();
            this.activityManager.log("Delete Item", item.name, item.quantity, 0);
        }
    }

    adjustQuantity(id, amount) {
        const item = this.getItem(id);
        if (item) {
            const old = item.quantity;
            item.quantity = Math.max(0, item.quantity + amount);
            this.saveToStorage();
            const action = amount > 0 ? "Quantity Increased" : "Quantity Decreased";
            const historyType = amount > 0 ? "Stock Received" : "Item Consumed";
            
            this.activityManager.log(action, item.name, old, item.quantity, `Adjusted by ${amount}`);
            this.historyManager.log(historyType, item, amount, "Quick adjustment");
            
            return true;
        }
        return false;
    }

    getStats() {
        const stats = { totalItems: this.items.length, lowStock: 0, outOfStock: 0, totalValue: 0, restockCost: 0 };
        this.items.forEach(item => {
            if (item.quantity <= 0) {
                stats.outOfStock++;
                const needed = (item.maxStock || item.minQuantity * 2) - item.quantity;
                stats.restockCost += Math.max(0, needed) * item.cost;
            } else if (item.quantity <= item.minQuantity) {
                stats.lowStock++;
                const needed = (item.maxStock || item.minQuantity * 2) - item.quantity;
                stats.restockCost += Math.max(0, needed) * item.cost;
            }
            stats.totalValue += (item.quantity * item.cost);
        });
        return stats;
    }

    search(query) {
        const q = query.toLowerCase().trim();
        if (!q) return this.items;
        return this.items.filter(item => 
            item.name.toLowerCase().includes(q) || 
            item.category.toLowerCase().includes(q) ||
            item.location.toLowerCase().includes(q) ||
            (item.manufacturerBarcode && item.manufacturerBarcode.toLowerCase().includes(q))
        );
    }
}

/**
 * UI CONTROLLER
 */
class InventoryUI {
    constructor(manager, activityManager) {
        this.manager = manager;
        this.activityManager = activityManager;
        this.editingId = null;

        this.elements = {
            tableBody: document.getElementById("inventoryTable"),
            modal: document.getElementById("itemModal"),
            modalTitle: document.getElementById("modalTitle"),
            searchBox: document.getElementById("searchBox"),
            addItemBtn: document.getElementById("addItemBtn"),
            closeModalBtns: document.querySelectorAll(".close, .cancel"),
            saveBtn: document.querySelector(".save"),
            form: {
                name: document.getElementById("itemName"),
                category: document.getElementById("itemCategory"),
                qty: document.getElementById("itemQty"),
                minQty: document.getElementById("itemMin"),
                maxStock: document.getElementById("itemMax"),
                cost: document.getElementById("itemCost"),
                location: document.getElementById("itemLocation"),
                manufacturerBarcode: document.getElementById("itemManufacturerBarcode")
            },
            stats: {
                total: document.getElementById("totalItems"),
                lowStock: document.getElementById("lowStock"),
                outOfStock: document.getElementById("outOfStock"),
                value: document.getElementById("inventoryValue"),
                restock: document.getElementById("restockCost")
            }
        };

        this.init();
    }

    init() {
        if (this.elements.addItemBtn) this.elements.addItemBtn.onclick = () => this.openModal();
        this.elements.closeModalBtns.forEach(btn => btn.onclick = () => this.closeModal());
        if (this.elements.saveBtn) this.elements.saveBtn.onclick = () => this.handleSave();
        if (this.elements.searchBox) this.elements.searchBox.oninput = () => this.renderTable();

        if (this.elements.tableBody) {
            this.elements.tableBody.onclick = (e) => {
                const btn = e.target.closest("button");
                if (!btn) return;
                const id = parseInt(btn.dataset.id);
                if (btn.classList.contains("qty-btn")) {
                    this.manager.adjustQuantity(id, btn.classList.contains("plus") ? 1 : -1);
                    this.render();
                } else if (btn.classList.contains("edit-btn")) {
                    this.openModal(id);
                } else if (btn.classList.contains("delete-btn")) {
                    if (confirm("Delete this item?")) {
                        this.manager.deleteItem(id);
                        this.render();
                    }
                }
            };
        }

        this.render();
    }

    openModal(id = null) {
        this.editingId = id;
        if (id !== null) {
            if (this.elements.modalTitle) this.elements.modalTitle.innerText = "Edit Inventory Item";
            const item = this.manager.getItem(id);
            if (item) {
                this.elements.form.name.value = item.name;
                this.elements.form.category.value = item.category;
                this.elements.form.qty.value = item.quantity;
                this.elements.form.minQty.value = item.minQuantity;
                this.elements.form.maxStock.value = item.maxStock || 0;
                this.elements.form.cost.value = item.cost;
                this.elements.form.location.value = item.location;
                this.elements.form.manufacturerBarcode.value = item.manufacturerBarcode || "";
            }
        } else {
            if (this.elements.modalTitle) this.elements.modalTitle.innerText = "Add Inventory Item";
            this.resetForm();
        }
        if (this.elements.modal) this.elements.modal.classList.add("show");
    }

    closeModal() {
        if (this.elements.modal) this.elements.modal.classList.remove("show");
        this.editingId = null;
    }

    resetForm() {
        Object.values(this.elements.form).forEach(input => {
            if (!input) return;
            if (input.tagName === "SELECT") input.selectedIndex = 0;
            else if (input.type === "number") input.value = input.getAttribute("value") || 0;
            else input.value = "";
        });
    }

    handleSave() {
        const data = {
            name: this.elements.form.name.value,
            category: this.elements.form.category.value,
            quantity: this.elements.form.qty.value,
            minQuantity: this.elements.form.minQty.value,
            maxStock: this.elements.form.maxStock.value,
            cost: this.elements.form.cost.value,
            location: this.elements.form.location.value,
            manufacturerBarcode: this.elements.form.manufacturerBarcode.value.trim()
        };
        if (!data.name.trim()) return alert("Enter item name");
        if (this.editingId !== null) this.manager.updateItem(this.editingId, data);
        else this.manager.addItem(data);
        this.closeModal();
        this.render();
    }

    render() {
        const stats = this.manager.getStats();
        if (this.elements.stats.total) this.elements.stats.total.innerText = stats.totalItems;
        if (this.elements.stats.lowStock) this.elements.stats.lowStock.innerText = stats.lowStock;
        if (this.elements.stats.outOfStock) this.elements.stats.outOfStock.innerText = stats.outOfStock;
        if (this.elements.stats.value) {
            this.elements.stats.value.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.totalValue);
        }
        if (this.elements.stats.restock) {
            this.elements.stats.restock.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.restockCost);
        }
        this.renderTable();
        this.renderRecentActivity();
    }

        renderTable() {
        if (!this.elements.tableBody) return;
        const items = this.manager.search(this.elements.searchBox ? this.elements.searchBox.value : "");
        this.elements.tableBody.innerHTML = items.map(item => {
            const isOut = item.quantity <= 0;
            const isLow = item.quantity <= item.minQuantity;
            const statusClass = isOut ? "status low" : (isLow ? "status low" : "status instock");
            const statusText = isOut ? "Out of Stock" : (isLow ? "Low Stock" : "In Stock");
            const rowStyle = isOut ? "background:#ffebeb" : (isLow ? "background:#FFF9E6" : "");
            
            return `
                <tr style="${rowStyle}">
                    <td data-label="Item">
                        <strong>${item.name}</strong><br>
                        <small style="color:#888">${item.manufacturerBarcode || ""}</small>
                    </td>
                    <td data-label="Category">${item.category}</td>
                    <td data-label="Qty">
                        <div class="qty-control">
                            <button class="qty-btn minus" data-id="${item.id}">-</button>
                            <span class="qty-val">${item.quantity}</span>
                            <button class="qty-btn plus" data-id="${item.id}">+</button>
                        </div>
                    </td>
                    <td data-label="Min">${item.minQuantity}</td>
                    <td data-label="Cost">$${parseFloat(item.cost).toFixed(2)}</td>
                    <td data-label="Location">${item.location}</td>
                    <td data-label="Status"><span class="${statusClass}">${statusText}</span></td>
                    <td data-label="Actions">
                        <button class="action-btn edit-btn" data-id="${item.id}"><i class="bi bi-pencil"></i></button>
                        <button class="action-btn delete-btn" data-id="${item.id}"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="8" style="text-align:center;padding:40px">No items</td></tr>';
    }

    renderRecentActivity() {
        const container = document.getElementById("recentActivityList");
        if (!container) return;
        const recent = this.activityManager.getRecent(10);
        
        if (recent.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px; color:#777;">No recent activity</p>';
            return;
        }

        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr style="text-align:left; color:var(--gray); border-bottom:1px solid var(--border);">
                        <th style="padding:10px;">Time</th>
                        <th style="padding:10px;">Action</th>
                        <th style="padding:10px;">Item</th>
                        <th style="padding:10px;">Change</th>
                    </tr>
                </thead>
                <tbody>
                    ${recent.map(a => {
                        const time = new Date(a.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                        const change = a.prevQty !== null && a.newQty !== null ? `${a.prevQty} → ${a.newQty}` : "-";
                        return `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:10px; color:var(--gray);">${time}</td>
                                <td style="padding:10px;"><strong>${a.action}</strong></td>
                                <td style="padding:10px;">${a.itemName}</td>
                                <td style="padding:10px;">${change}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }
}

/**
 * NAVIGATION & PAGE CONTROLLER
 */
class NavigationController {
    constructor(ui, activityManager, historyManager, barcodeManager, analyticsUI) {
        this.ui = ui;
        this.activityManager = activityManager;
        this.historyManager = historyManager;
        this.barcodeManager = barcodeManager;
        this.analyticsUI = analyticsUI;
        this.init();
    }

        init() {
        const links = document.querySelectorAll(".nav-link");
        const sidebar = document.querySelector(".sidebar");
        const overlay = document.getElementById("sidebarOverlay");
        const mobileMenuBtn = document.getElementById("mobileMenuBtn");

        if (mobileMenuBtn) {
            mobileMenuBtn.onclick = () => {
                sidebar.classList.toggle("open");
                overlay.classList.toggle("show");
            };
        }

        if (overlay) {
            overlay.onclick = () => {
                sidebar.classList.remove("open");
                overlay.classList.remove("show");
            };
        }

        links.forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                this.switchView(view, link);
                
                // Close sidebar on mobile after selection
                sidebar.classList.remove("open");
                overlay.classList.remove("show");
            };
        });
        
        const exportActivityBtn = document.getElementById("exportActivityBtn");
        if (exportActivityBtn) exportActivityBtn.onclick = () => this.activityManager.exportCSV();

        const exportHistoryBtn = document.getElementById("exportHistoryBtn");
        if (exportHistoryBtn) exportHistoryBtn.onclick = () => this.historyManager.exportCSV();

        const activitySearch = document.getElementById("activitySearch");
        if (activitySearch) activitySearch.oninput = () => this.renderActivityLog();

        const historySearch = document.getElementById("historySearch");
        if (historySearch) historySearch.oninput = () => this.renderHistoryLog();

        const barcodeSearch = document.getElementById("barcodeSearch");
        if (barcodeSearch) barcodeSearch.oninput = () => this.renderBarcodeList();
    }

    switchView(viewName, link) {
        document.querySelectorAll(".nav-link").forEach(a => a.classList.remove("active"));
        link.classList.add("active");

        const titles = {
            dashboard: { title: "Dashboard", subtitle: "Inventory Overview" },
            inventory: { title: "Inventory", subtitle: "Manage your stock" },
            activity: { title: "Activity Log", subtitle: "Transaction history" },
            history: { title: "History", subtitle: "Detailed audit trail" },
            barcodes: { title: "Barcode Labels", subtitle: "Print inventory labels" },
            scanner: { title: "Barcode Scanner", subtitle: "Camera scanning mode" },
            shopping: { title: "Shopping List", subtitle: "Items to purchase" },
            reports: { title: "Reports", subtitle: "Analytics and insights" },
            analytics: { title: "Analytics", subtitle: "Forecasting and movement" },
            settings: { title: "Settings", subtitle: "System configuration" }
        };
        const head = titles[viewName] || titles.dashboard;
        document.getElementById("pageTitle").innerText = head.title;
        document.getElementById("pageSubtitle").innerText = head.subtitle;

        document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));
        const target = document.getElementById(`${viewName}-view`);
        if (target) target.classList.add("active");

        if (viewName === "activity") {
            this.renderActivityLog();
        } else if (viewName === "history") {
            this.renderHistoryLog();
        } else if (viewName === "barcodes") {
            this.renderBarcodeList();
        } else if (viewName === "analytics") {
            this.analyticsUI.render();
        } else {
            this.ui.render();
        }
    }

    renderActivityLog() {
        const body = document.getElementById("activityTableBody");
        if (!body) return;
        const query = document.getElementById("activitySearch")?.value || "";
        const activities = this.activityManager.search(query);
        body.innerHTML = activities.map(a => {
            const d = new Date(a.dateTime);
            return `
                <tr>
                    <td>${d.toLocaleDateString()}</td>
                    <td>${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                    <td><strong>${a.itemName}</strong></td>
                    <td>${a.action}</td>
                    <td>${a.prevQty ?? "-"}</td>
                    <td>${a.newQty ?? "-"}</td>
                    <td>${a.notes}</td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="7" style="text-align:center;padding:40px">No activities found</td></tr>';
    }

        renderHistoryLog() {
        const body = document.getElementById("historyTableBody");
        if (!body) return;
        const query = document.getElementById("historySearch").value || "";
        const history = this.historyManager.search(query);
        body.innerHTML = history.map(r => {
            const d = new Date(r.timestamp);
            const changeColor = r.change > 0 ? "color:green" : (r.change < 0 ? "color:red" : "");
            const changeSymbol = r.change > 0 ? "+" : "";
            
            // Map transaction type to CSS class
            const typeClass = r.type.toLowerCase().replace(/\s+/g, '-');
            let badgeClass = 'default';
            if (typeClass.includes('initial')) badgeClass = 'initial';
            else if (typeClass.includes('adjustment')) badgeClass = 'adjustment';
            else if (typeClass.includes('purchase')) badgeClass = 'purchase';
            else if (typeClass.includes('sale')) badgeClass = 'sale';
            else if (typeClass.includes('transfer')) badgeClass = 'transfer';
            else if (typeClass.includes('return')) badgeClass = 'return';
            else if (typeClass.includes('received')) badgeClass = 'received';
            else if (typeClass.includes('consumed')) badgeClass = 'consumed';
            
            return `
                <tr>
                    <td data-label="Date">
                        <div style="font-size:13px">${d.toLocaleDateString()}</div>
                        <div style="font-size:11px; color:#777">${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td data-label="Item"><strong>${r.productName}</strong><br><small style="color:#777">${r.category}</small></td>
                    <td data-label="Type"><span class="badge-iq ${badgeClass}">${r.type}</span></td>
                    <td data-label="Prev" style="text-align:center">${r.prevQty}</td>
                    <td data-label="Change" style="text-align:center; font-weight:bold; ${changeColor}">${changeSymbol}${r.change}</td>
                    <td data-label="New" style="text-align:center; font-weight:bold">${r.newQty}</td>
                    <td data-label="User">${r.user}</td>
                    <td data-label="Notes" style="max-width:200px; font-size:12px">${r.notes}</td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="8" style="text-align:center;padding:40px">No history found</td></tr>';
    }

        renderBarcodeList() {
        const body = document.getElementById("barcodeTableBody");
        if (!body) return;
        const query = document.getElementById("barcodeSearch").value || "";
        const items = this.ui.manager.search(query);
        body.innerHTML = items.map(item => {
            return `
                <tr>
                    <td data-label="Item"><strong>${item.name}</strong></td>
                    <td data-label="Category">${item.category}</td>
                    <td data-label="Internal"><code>${item.internalBarcode || "-"}</code></td>
                    <td data-label="Manufacturer">${item.manufacturerBarcode || "<span style='color:#ccc'>None</span>"}</td>
                    <td data-label="Actions">
                        <button class="action-btn print-btn" data-id="${item.id}"><i class="bi bi-printer"></i> Print</button>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="5" style="text-align:center;padding:40px">No items found</td></tr>';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed', err));
        });
    }

    // PWA Install Prompt Logic
    let deferredPrompt;
    const installContainer = document.getElementById('installAppContainer');
    const installBtn = document.getElementById('installAppBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installContainer) installContainer.style.display = 'block';
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    if (installContainer) installContainer.style.display = 'none';
                }
                deferredPrompt = null;
            }
        });
    }

    const activityManager = new ActivityManager();
    const historyManager = new HistoryManager();
    const barcodeManager = new BarcodeManager();
    const inventoryManager = new InventoryManager(activityManager, historyManager, barcodeManager);
    
    const analyticsManager = new AnalyticsManager(inventoryManager, historyManager);
    const analyticsUI = new AnalyticsUI(analyticsManager);

    const ui = new InventoryUI(inventoryManager, activityManager);
    window.navigation = new NavigationController(ui, activityManager, historyManager, barcodeManager, analyticsUI);
    new ScannerController(ui, inventoryManager, historyManager, barcodeManager);
});
