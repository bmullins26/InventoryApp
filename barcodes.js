/**
 * InventoryHub - Barcode Management System
 */

"use strict";

class BarcodeManager {
    constructor() {
        this.nextId = this.loadNextId();
    }

    loadNextId() {
        const id = localStorage.getItem('inventory_hub_barcode_counter');
        return id ? parseInt(id) : 1;
    }

    saveNextId() {
        localStorage.setItem('inventory_hub_barcode_counter', this.nextId.toString());
    }

    /**
     * Generate a unique internal barcode in IH-000000 format
     */
    generateInternalBarcode() {
        const id = this.nextId.toString().padStart(6, '0');
        const barcode = `IH-${id}`;
        this.nextId++;
        this.saveNextId();
        return barcode;
    }

    /**
     * Simple validation - checks if barcode is not empty and meets basic length
     */
    validateBarcode(barcode) {
        if (!barcode) return false;
        return barcode.trim().length >= 3;
    }

    /**
     * Finds an item by either manufacturer or internal barcode
     */
    findByBarcode(items, barcode) {
        if (!barcode) return null;
        const b = barcode.trim().toLowerCase();
        return items.find(item => 
            (item.manufacturerBarcode && item.manufacturerBarcode.toLowerCase() === b) ||
            (item.internalBarcode && item.internalBarcode.toLowerCase() === b)
        );
    }

    /**
     * Checks if a barcode is already assigned to another product
     */
    isDuplicateBarcode(items, barcode, excludeItemId = null) {
        if (!barcode) return false;
        const b = barcode.trim().toLowerCase();
        return items.some(item => 
            item.id !== excludeItemId && (
                (item.manufacturerBarcode && item.manufacturerBarcode.toLowerCase() === b) ||
                (item.internalBarcode && item.internalBarcode.toLowerCase() === b)
            )
        );
    }
}
