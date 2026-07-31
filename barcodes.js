/**
 * Inventory IQ - Barcode Management System
 */

"use strict";

class BarcodeManager {
    constructor() {
        this.nextId = this.loadNextId();
    }

    loadNextId() {
        const id = localStorage.getItem('inventory_iq_barcode_counter');
        return id ? parseInt(id) : 1;
    }

    saveNextId() {
        localStorage.setItem('inventory_iq_barcode_counter', this.nextId.toString());
    }

    /**
     * Generate a unique internal barcode in IH-000000 format
     */
    generateInternalBarcode() {
        const id = this.nextId.toString().padStart(6, '0');
        const barcode = `IQ-${id}`;
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

/**
 * CAMERA SCANNER CONTROLLER
 */
class ScannerController {
    constructor(ui, manager, history, barcodeManager) {
        this.ui = ui;
        this.manager = manager;
        this.history = history;
        this.barcodeManager = barcodeManager;
        
        this.html5QrCode = null;
        this.isScannerActive = false;
        this.lastScanTime = 0;
        this.selectedCameraId = null;
        this.currentScannedItem = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCameras();
    }

    setupEventListeners() {
        const toggleBtn = document.getElementById("toggleScannerBtn");
        if (toggleBtn) toggleBtn.onclick = () => this.toggleScanner();

        const cameraSelect = document.getElementById("cameraSelect");
        if (cameraSelect) cameraSelect.onchange = (e) => {
            this.selectedCameraId = e.target.value;
            localStorage.setItem('inventory_hub_preferred_camera', this.selectedCameraId);
            if (this.isScannerActive) {
                this.stopScanner().then(() => this.startScanner());
            }
        };

        // Quick Action Buttons
        document.querySelectorAll(".quick-qty-btn").forEach(btn => {
            btn.onclick = () => {
                const amount = parseInt(btn.dataset.amount);
                this.handleQuickAdjust(amount);
            };
        });

        const btnCreate = document.getElementById("btnCreateWithBarcode");
        if (btnCreate) btnCreate.onclick = () => {
            const barcode = document.getElementById("notFoundBarcode").innerText;
            this.closeModal("barcodeNotFoundModal");
            this.ui.openModal();
            document.getElementById("itemManufacturerBarcode").value = barcode;
        };

        const btnAssign = document.getElementById("btnAssignToExisting");
        if (btnAssign) btnAssign.onclick = () => {
            alert("Please search for the product in the inventory list and click Edit to assign this barcode.");
            this.closeModal("barcodeNotFoundModal");
            window.navigation.switchView("inventory", document.querySelector('[data-view="inventory"]'));
        };
        
        const viewHistory = document.getElementById("qaViewHistory");
        if (viewHistory) viewHistory.onclick = () => {
            this.closeModal("quickActionModal");
            window.navigation.switchView("history", document.querySelector('[data-view="history"]'));
            document.getElementById("historySearch").value = this.currentScannedItem.name;
            window.navigation.renderHistoryLog();
        };

        // Modal Close listeners for the new modals
        document.querySelectorAll(".quick-action-modal .close, .quick-action-modal .cancel").forEach(btn => {
            btn.onclick = () => this.closeModal("quickActionModal");
        });
        document.querySelectorAll("#barcodeNotFoundModal .close, #barcodeNotFoundModal .cancel").forEach(btn => {
            btn.onclick = () => this.closeModal("barcodeNotFoundModal");
        });
    }

    async loadCameras() {
        try {
            const devices = await Html5Qrcode.getCameras();
            const select = document.getElementById("cameraSelect");
            if (devices && devices.length) {
                devices.forEach(device => {
                    const opt = document.createElement("option");
                    opt.value = device.id;
                    opt.text = device.label || `Camera ${select.length + 1}`;
                    select.add(opt);
                });
                
                const preferred = localStorage.getItem('inventory_hub_preferred_camera');
                if (preferred && Array.from(select.options).some(o => o.value === preferred)) {
                    select.value = preferred;
                    this.selectedCameraId = preferred;
                } else {
                    this.selectedCameraId = devices[0].id;
                }
            }
        } catch (err) {
            console.error("Error getting cameras", err);
            document.getElementById("scannerStatus").innerText = "Error: Camera access denied or not found.";
        }
    }

    async toggleScanner() {
        if (this.isScannerActive) {
            await this.stopScanner();
        } else {
            await this.startScanner();
        }
    }

    async startScanner() {
        if (!this.selectedCameraId) {
            alert("No camera selected");
            return;
        }

        this.html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 150 } };

        try {
            await this.html5QrCode.start(
                this.selectedCameraId, 
                config,
                (decodedText) => this.onScanSuccess(decodedText)
            );
            this.isScannerActive = true;
            document.getElementById("toggleScannerBtn").innerHTML = '<i class="bi bi-camera-off"></i> Stop Scanner';
            document.getElementById("scannerStatus").innerText = "Scanner is active. Point at a barcode.";
            document.getElementById("scannerOverlay").style.display = "block";
        } catch (err) {
            console.error("Error starting scanner", err);
            alert("Failed to start scanner: " + err);
        }
    }

    async stopScanner() {
        if (this.html5QrCode) {
            await this.html5QrCode.stop();
            this.html5QrCode = null;
        }
        this.isScannerActive = false;
        document.getElementById("toggleScannerBtn").innerHTML = '<i class="bi bi-camera"></i> Start Scanner';
        document.getElementById("scannerStatus").innerText = "Scanner is off.";
        document.getElementById("scannerOverlay").style.display = "none";
    }

    onScanSuccess(decodedText) {
        const now = Date.now();
        if (now - this.lastScanTime < 2000) return; // Prevent duplicate scans within 2s
        this.lastScanTime = now;

        // Visual/Audio Feedback
        this.playSuccessSound();
        const overlay = document.getElementById("scannerOverlay");
        overlay.style.borderColor = "var(--success)";
        setTimeout(() => overlay.style.borderColor = "var(--gold)", 500);

        const item = this.barcodeManager.findByBarcode(this.manager.items, decodedText);
        if (item) {
            this.showQuickActions(item);
        } else {
            this.showNotFound(decodedText);
        }
    }

    playSuccessSound() {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
        audio.play().catch(e => console.warn("Audio play blocked", e));
    }

    showQuickActions(item) {
        this.currentScannedItem = item;
        document.getElementById("qaItemName").innerText = item.name;
        document.getElementById("qaItemCategory").innerText = item.category;
        document.getElementById("qaItemBarcode").innerText = item.manufacturerBarcode || item.internalBarcode;
        document.getElementById("qaItemQty").innerText = item.quantity;
        
        this.openModal("quickActionModal");
        
        // Update last scanned
        item.lastScanned = new Date().toISOString();
        this.manager.saveToStorage();
    }

    showNotFound(barcode) {
        document.getElementById("notFoundBarcode").innerText = barcode;
        this.openModal("barcodeNotFoundModal");
    }

    handleQuickAdjust(amount) {
        if (!this.currentScannedItem) return;
        
        this.manager.adjustQuantity(this.currentScannedItem.id, amount);
        document.getElementById("qaItemQty").innerText = this.currentScannedItem.item ? this.currentScannedItem.quantity : this.manager.getItem(this.currentScannedItem.id).quantity;
        
        // Update UI
        this.ui.render();
        
        // Return to scanner automatically after brief delay if preferred
        setTimeout(() => this.closeModal("quickActionModal"), 800);
    }

    openModal(id) {
        document.getElementById(id).classList.add("show");
    }

    closeModal(id) {
        document.getElementById(id).classList.remove("show");
        this.currentScannedItem = null;
    }
}
