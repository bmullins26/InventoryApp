/**
 * Inventory IQ - History & Transaction Management
 */

"use strict";

const HISTORY_STORAGE_KEY = "inventory_iq_history";

/**
 * HISTORY MANAGER
 * Tracks every inventory transaction with detailed audit trail
 */
class HistoryManager {
    constructor() {
        this.history = this.loadFromStorage();
        this.maxEntries = 1000;
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem(HISTORY_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error loading history", e);
            return [];
        }
    }

    saveToStorage() {
        if (this.history.length > this.maxEntries) {
            this.history = this.history.slice(-this.maxEntries);
        }
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history));
    }

    /**
     * Log a transaction
     * @param {string} type - Transaction Type (e.g., "Stock Received", "Manual Adjustment")
     * @param {Object} item - Product object
     * @param {number} change - Quantity changed
     * @param {string} notes - Additional notes
     * @param {string} user - User performing the action
     */
    log(type, item, change = 0, notes = "", user = "Brian") {
        const record = {
            id: 'TX' + Date.now() + Math.floor(Math.random() * 1000),
            timestamp: new Date().toISOString(),
            productId: item.id,
            productName: item.name,
            category: item.category,
            prevQty: (item.quantity || 0) - (type === "Item Added" ? 0 : change),
            change: change,
            newQty: item.quantity,
            type: type,
            user: user,
            notes: notes
        };

        // Special handling for edge cases
        if (type === "Item Added") {
            record.prevQty = 0;
            record.newQty = item.quantity;
            record.change = item.quantity;
        } else if (type === "Item Deleted") {
            record.prevQty = item.quantity;
            record.newQty = 0;
            record.change = -item.quantity;
        } else if (type === "Initial Inventory") {
            record.prevQty = 0;
            record.newQty = item.quantity;
            record.change = item.quantity;
        }

        this.history.push(record);
        this.saveToStorage();
        return record;
    }

    getRecent(count = 10) {
        return [...this.history].reverse().slice(0, count);
    }

    getAll() {
        return [...this.history].reverse();
    }

    search(query) {
        const q = query.toLowerCase().trim();
        return this.getAll().filter(r => 
            r.productName.toLowerCase().includes(q) ||
            r.type.toLowerCase().includes(q) ||
            r.notes.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            new Date(r.timestamp).toLocaleDateString().includes(q)
        );
    }

    exportCSV() {
        let csv = "Date,Time,Transaction ID,Item,Category,Type,Prev Qty,Change,New Qty,User,Notes\n";
        this.getAll().forEach(r => {
            const d = new Date(r.timestamp);
            csv += `"${d.toLocaleDateString()}","${d.toLocaleTimeString()}",` +
                   `"${r.id}","${r.productName}","${r.category}","${r.type}",${r.prevQty},${r.change},${r.newQty},"${r.user}","${r.notes}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_history_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }
}
