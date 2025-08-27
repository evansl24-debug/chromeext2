// State synchronization and error handling
let stateUpdateQueue = [];
let isUpdatingState = false;

function queueStateUpdate(updateFn) {
    stateUpdateQueue.push(updateFn);
    if (!isUpdatingState) {
        processStateQueue();
    }
}

async function processStateQueue() {
    if (stateUpdateQueue.length === 0) {
        isUpdatingState = false;
        return;
    }
    
    isUpdatingState = true;
    
    try {
        const updateFn = stateUpdateQueue.shift();
        await updateFn();
    } catch (error) {
        console.error('Error processing state update:', error);
    }
    
    // Process next update
    processStateQueue();
}

// Safe message sending with retry
function safeSendMessage(message, maxRetries = 3) {
    return new Promise((resolve, reject) => {
        let retryCount = 0;
        
        const sendMessage = () => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(sendMessage, 1000 * retryCount);
                    } else {
                        reject(new Error(chrome.runtime.lastError.message));
                    }
                } else {
                    resolve(response);
                }
            });
        };
        
        sendMessage();
    });
}

// Progressive loading indicators
function showProgressiveLoading(totalSteps) {
    let currentStep = 0;
    
    return {
        update: (message) => {
            currentStep++;
            const progress = (currentStep / totalSteps) * 100;
            updateProgressBar(progress, message);
        },
        complete: () => {
            updateProgressBar(100, 'Complete');
        }
    };
}

// Enhanced progress bar with better UX
function updateProgressBar(progress, message) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (progressBar) {
        progressBar.style.width = `${Math.min(progress, 100)}%`;
        progressBar.setAttribute('aria-valuenow', progress);
    }
    
    if (progressText) {
        progressText.textContent = message || `${Math.round(progress)}%`;
    }
}

// Smart retry with user feedback
async function downloadWithSmartRetry(imageUrl, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await downloadSingleImage(imageUrl);
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Show user-friendly retry message
            showNotification('warning', 'Download Retry', 
                `Attempt ${attempt} failed, retrying... (${maxRetries - attempt} attempts remaining)`);
            
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// Enhanced notification system
function showEnhancedNotification(type, title, message, duration = 5000) {
    const notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type} enhanced`;

    const titleEl = document.createElement('div');
    titleEl.className = 'notification-title';
    titleEl.textContent = sanitizeInput(title);

    const messageEl = document.createElement('div');
    messageEl.className = 'notification-message';
    messageEl.textContent = sanitizeInput(message);

    const progressBar = document.createElement('div');
    progressBar.className = 'notification-progress';
    
    notification.appendChild(titleEl);
    notification.appendChild(messageEl);
    notification.appendChild(progressBar);
    notificationContainer.appendChild(notification);

    // Animate progress bar
    let progress = 100;
    const progressInterval = setInterval(() => {
        progress -= 100 / (duration / 100);
        progressBar.style.width = `${Math.max(0, progress)}%`;
        
        if (progress <= 0) {
            clearInterval(progressInterval);
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }
    }, 100);

    // Auto-remove after duration
    setTimeout(() => {
        clearInterval(progressInterval);
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, duration);
}

// STEPTWO Gallery Scraper - Professional Dashboard JavaScript
// Critical fixes for security, validation, and reliability

document.addEventListener('DOMContentLoaded', function() {
    let backgroundState = {
        originalTabId: null,
        originalTabUrl: null,
        isActive: false,
        isPaused: false,
        currentPage: 1,
        totalPages: 0,
        totalImages: 0,
        downloadedImages: 0,
        failedDownloads: 0,
        startTime: null,
        settings: null,
        collectedItems: [],
        failedItems: [],
        logs: []
    };
    
    let startTime = null;
    let runtimeInterval = null;
    let currentTheme = 'light';
    let currentProfile = 'universal';
    let bgPort = null;
    
    // Site profiles with pre-configured settings
    const siteProfiles = {
        universal: {
            name: 'Universal',
            selectors: {
                container: '.gallery-item, .item, .card, .product',
                image: 'img',
                link: 'a',
                title: '.title, .caption, .name'
            }
        },
        imago: {
            name: 'Imago Images',
            selectors: {
                container: 'div[data-is-search-result-item], .search-result-item',
                image: 'img.responsive-image__image',
                link: 'a.search-result-item__link',
                title: '.search-result-item__title'
            }
        },
        getty: {
            name: 'Getty Images',
            selectors: {
                container: '.MosaicAsset-module__asset___gH_eE',
                image: 'img',
                link: 'a',
                title: '.AssetCard-module__title___'
            }
        },
        shutterstock: {
            name: 'Shutterstock',
            selectors: {
                container: '.search-content__gallery-results--overlay > div',
                image: 'img',
                link: 'a',
                title: '.AssetCard-module__title___'
            }
        },
        custom: {
            name: 'Custom',
            selectors: {
                container: '',
                image: '',
                link: '',
                title: ''
            }
        }
    };
    
    // Enhanced input validation
    function validateSettings(settings) {
        const errors = [];
        
        if (!settings || typeof settings !== 'object') {
            errors.push('Invalid settings object');
            return errors;
        }
        
        // Validate required numeric fields
        const numericFields = ['pageWait', 'scrollDelay', 'maxScrollAttempts', 'retryAttempts'];
        for (const field of numericFields) {
            if (typeof settings[field] !== 'number' || settings[field] < 0) {
                errors.push(`${field} must be a positive number`);
            }
        }
        
        // Validate string fields
        if (settings.filenamePattern && typeof settings.filenamePattern !== 'string') {
            errors.push('Filename pattern must be a string');
        }
        
        if (settings.downloadFolder && typeof settings.downloadFolder !== 'string') {
            errors.push('Download folder must be a string');
        }
        
        // Validate boolean fields
        if (typeof settings.downloadImages !== 'boolean') {
            errors.push('Download images must be a boolean');
        }
        
        // Validate selectors
        if (settings.selectors) {
            const selectorFields = ['container', 'image', 'link', 'title'];
            for (const field of selectorFields) {
                if (settings.selectors[field] && typeof settings.selectors[field] !== 'string') {
                    errors.push(`${field} selector must be a string`);
                }
            }
        }
        
        return errors;
    }
    
    // Enhanced CSS selector validation
    function isValidCSSSelector(selector) {
        if (!selector || typeof selector !== 'string') {
            return false;
        }
        
        // Basic CSS selector validation
        const validPattern = /^[.#]?[a-zA-Z0-9_-]+(\s*[.#]?[a-zA-Z0-9_-]+)*$/;
        return validPattern.test(selector.trim());
    }
    
    // Enhanced input sanitization
    function sanitizeInput(input) {
        if (typeof input !== 'string') {
            return '';
        }
        
        // Remove potentially dangerous characters and patterns
        return input
            .replace(/[<>]/g, '') // Remove < and >
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/data:/gi, '') // Remove data: protocol
            .replace(/vbscript:/gi, '') // Remove vbscript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim()
            .substring(0, 1000); // Limit length
    }
    
    // Safe message sending with error handling
    // Note: safeSendMessage is defined globally above
    
    // Enhanced activity log management with detailed debugging
    function addToActivityLog(message, type = 'info', details = null) {
        const logContainer = document.getElementById('logContainer');
        if (!logContainer) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        let logContent = `<span class="log-timestamp">${timestamp}</span>`;
        logContent += `<span class="log-message">${sanitizeInput(message)}</span>`;
        
        // Add details if provided
        if (details) {
            const detailsStr = typeof details === 'object' ? JSON.stringify(details, null, 2) : details;
            logContent += `<div class="log-details">${sanitizeInput(detailsStr)}</div>`;
        }
        
        logEntry.innerHTML = logContent;
        
        logContainer.appendChild(logEntry);
        
        // Auto-scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Limit log entries to prevent memory issues (increased limit for debugging)
        const entries = logContainer.querySelectorAll('.log-entry');
        if (entries.length > 500) {
            entries[0].remove();
        }
        
        // Also log to console for debugging
        console.log(`[Activity Log ${type.toUpperCase()}] ${message}`, details || '');
    }
    
    // Enhanced notification system with XSS protection
    function showNotification(type, title, message) {
        const notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            console.warn('Notification container not found');
            return;
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const titleEl = document.createElement('div');
        titleEl.className = 'notification-title';
        titleEl.textContent = sanitizeInput(title);
        
        const messageEl = document.createElement('div');
        messageEl.className = 'notification-message';
        messageEl.textContent = sanitizeInput(message);
        
        notification.appendChild(titleEl);
        notification.appendChild(messageEl);
        
        notificationContainer.appendChild(notification);
        
        // Add notification to activity log
        addToActivityLog(`${title}: ${message}`, type);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    // Enhanced state management
    async function updateScrapingState() {
        try {
            const response = await safeSendMessage({ action: 'getScrapingState' });
            if (response && response.success) {
                backgroundState = response.data;
                updateUI();
            } else {
                console.warn('getScrapingState returned unsuccessful response', response);
            }
        } catch (error) {
            console.error('Error updating scraping state:', error);
        }
    }
    
    // Enhanced UI state management
    function updateUI() {
        // Update target page display
        updateTargetPageDisplay();
        
        // Update button states
        updateButtonStates();
        
        // Update progress display
        updateProgress();
        
        // Update status display
        updateStatus();
        
        // Update content displays
        updateImagePreview();
        updateDataPreview();
        updateLogs();
        
        // Update connection status
        updateConnectionStatus();
    }
    
    function updateTargetPageDisplay() {
        const currentTabUrl = document.getElementById('currentTabUrl');
        if (!currentTabUrl) {
            console.warn('❌ currentTabUrl element not found');
            addToActivityLog('currentTabUrl element not found', 'error');
            return;
        }
        
        // Ensure backgroundState exists
        if (!backgroundState) {
            console.warn('⚠️ backgroundState is null/undefined');
            addToActivityLog('backgroundState is null/undefined', 'warning');
            currentTabUrl.textContent = 'Connecting...';
            currentTabUrl.className = 'page-url disconnected';
            return;
        }
        
        addToActivityLog('Updating target page display', 'debug', {
            originalTabUrl: backgroundState.originalTabUrl,
            originalTabId: backgroundState.originalTabId,
            backgroundStateKeys: Object.keys(backgroundState)
        });
        
        console.log('🎯 Updating target page display:', {
            originalTabUrl: backgroundState.originalTabUrl,
            originalTabId: backgroundState.originalTabId
        });
        
        if (backgroundState.originalTabUrl) {
            // Extract domain and path for display
            try {
                const url = new URL(backgroundState.originalTabUrl);
                const displayUrl = url.hostname + (url.pathname !== '/' ? url.pathname : '');
                currentTabUrl.textContent = displayUrl;
                currentTabUrl.title = backgroundState.originalTabUrl; // Full URL in tooltip
                currentTabUrl.className = 'page-url connected';
                addToActivityLog('Target page displayed successfully', 'success', {
                    displayUrl: displayUrl,
                    fullUrl: backgroundState.originalTabUrl
                });
                console.log('✅ Target page displayed:', displayUrl);
            } catch (error) {
                currentTabUrl.textContent = 'Invalid URL';
                currentTabUrl.className = 'page-url error';
                addToActivityLog('Invalid URL in target display', 'error', {
                    url: backgroundState.originalTabUrl,
                    error: error.message
                });
                console.error('❌ Invalid URL:', error);
            }
        } else {
            currentTabUrl.textContent = 'No target page selected';
            currentTabUrl.className = 'page-url disconnected';
            addToActivityLog('No target page selected in display', 'warning', {
                backgroundState: backgroundState
            });
            console.log('⚠️ No target page selected');
        }
    }
    
    function updateButtonStates() {
        const startBtn = document.getElementById('startScraping');
        const pauseBtn = document.getElementById('pauseBtn');
        const resumeBtn = document.getElementById('resumeBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        if (backgroundState.isActive) {
            if (startBtn) startBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;
            
            if (backgroundState.isPaused) {
                if (pauseBtn) pauseBtn.disabled = true;
                if (resumeBtn) resumeBtn.disabled = false;
            } else {
                if (pauseBtn) pauseBtn.disabled = false;
                if (resumeBtn) resumeBtn.disabled = true;
            }
        } else {
            if (startBtn) startBtn.disabled = false;
            if (pauseBtn) pauseBtn.disabled = true;
            if (resumeBtn) resumeBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = true;
        }
    }
    
    function updateStatus() {
        const statusDisplay = document.getElementById('statusDisplay');
        if (!statusDisplay) return;
        
        if (backgroundState.isActive) {
            if (backgroundState.isPaused) {
                statusDisplay.textContent = 'Paused';
                statusDisplay.className = 'status-value paused';
            } else {
                statusDisplay.textContent = 'Scraping...';
                statusDisplay.className = 'status-value active';
            }
        } else {
            statusDisplay.textContent = 'Ready to scrape';
            statusDisplay.className = 'status-value ready';
        }
    }
    
    function updateConnectionStatus() {
        const connectionStatus = document.getElementById('connectionStatus');
        if (!connectionStatus) return;
        
        const statusIndicator = connectionStatus.querySelector('.status-indicator');
        const statusText = connectionStatus.querySelector('.status-text');
        
        if (backgroundState.originalTabId) {
            statusIndicator.className = 'status-indicator connected';
            statusText.textContent = 'Connected';
        } else {
            statusIndicator.className = 'status-indicator disconnected';
            statusText.textContent = 'No target page';
        }
    }
    
    // Enhanced progress tracking
    function updateProgress() {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressBar && progressText) {
            let progress = 0;
            let text = 'Ready';
            
            if (backgroundState.isActive) {
                if (backgroundState.totalImages > 0) {
                    progress = (backgroundState.downloadedImages / backgroundState.totalImages) * 100;
                    text = `${backgroundState.downloadedImages}/${backgroundState.totalImages} images`;
                } else {
                    text = 'Scanning...';
                }
            }
            
            progressBar.style.width = `${progress}%`;
            progressText.textContent = text;
        }
        
        // Update runtime
        updateRuntime();
    }
    
    // Enhanced runtime tracking
    function updateRuntime() {
        const runtimeElement = document.getElementById('runtime');
        if (!runtimeElement || !backgroundState.startTime) return;
        
        const elapsed = Date.now() - backgroundState.startTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        runtimeElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Safe DOM manipulation functions
    function safeSetInnerHTML(element, content) {
        if (!element) return;
        
        element.textContent = '';
        if (content) {
            const safeContent = document.createTextNode(content);
            element.appendChild(safeContent);
        }
    }

    function safeCreateElement(tag, className, textContent) {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (textContent) {
            element.textContent = sanitizeInput(textContent);
        }
        return element;
    }

    // Enhanced logging with safe DOM manipulation
    function updateLogs() {
        const logDisplay = document.getElementById('logDisplay');
        if (!logDisplay) return;
        
        logDisplay.textContent = '';
        
        if (!backgroundState.logs || backgroundState.logs.length === 0) {
            const noLogs = safeCreateElement('div', 'no-logs', 'No logs available');
            logDisplay.appendChild(noLogs);
            return;
        }
        
        backgroundState.logs.slice(-50).forEach(log => {
            const logEntry = safeCreateElement('div', 'log-entry');
            
            const timestamp = safeCreateElement('span', 'log-timestamp', 
                new Date(log.timestamp).toLocaleTimeString());
            const message = safeCreateElement('span', 'log-message', log.message);
            
            logEntry.appendChild(timestamp);
            logEntry.appendChild(message);
            logDisplay.appendChild(logEntry);
        });
        
        logDisplay.scrollTop = logDisplay.scrollHeight;
    }

    // Enhanced image preview with safe DOM manipulation
    function updateImagePreview() {
        const imagePreview = document.getElementById('imagePreview');
        if (!imagePreview) return;
        
        imagePreview.textContent = '';
        
        if (!backgroundState.collectedItems || backgroundState.collectedItems.length === 0) {
            const noImages = safeCreateElement('div', 'no-images', 'No images collected yet');
            imagePreview.appendChild(noImages);
            return;
        }
        
        const previewGrid = safeCreateElement('div', 'preview-grid');
        
        backgroundState.collectedItems.slice(-12).forEach(item => {
            const imageCard = safeCreateElement('div', 'image-card');
            
            const img = document.createElement('img');
            img.src = item.url || item.imageUrl || '';
            img.alt = sanitizeInput(item.title || 'Image');
            img.onerror = () => {
                const errorDiv = safeCreateElement('div', 'image-error', 'Failed to load');
                imageCard.textContent = '';
                imageCard.appendChild(errorDiv);
            };
            
            const title = safeCreateElement('div', 'image-title', item.title || 'Untitled');
            
            imageCard.appendChild(img);
            imageCard.appendChild(title);
            previewGrid.appendChild(imageCard);
        });
        
        imagePreview.appendChild(previewGrid);
    }

    // Enhanced data preview with safe DOM manipulation
    function updateDataPreview() {
        const dataPreview = document.getElementById('dataPreview');
        if (!dataPreview) return;
        
        dataPreview.textContent = '';
        
        if (!backgroundState.collectedItems || backgroundState.collectedItems.length === 0) {
            const noData = safeCreateElement('div', 'no-data', 'No data collected yet');
            dataPreview.appendChild(noData);
            return;
        }
        
        const table = safeCreateElement('table', 'data-table');
        const thead = safeCreateElement('thead');
        const tbody = safeCreateElement('tbody');
        
        // Create header
        const headerRow = safeCreateElement('tr');
        const headers = ['Title', 'URL', 'Status'];
        
        headers.forEach(text => {
            const th = safeCreateElement('th', '', text);
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create rows
        backgroundState.collectedItems.slice(-20).forEach(item => {
            const row = safeCreateElement('tr');
            
            const titleCell = safeCreateElement('td', '', item.title || 'Untitled');
            const urlCell = safeCreateElement('td', '', item.url || item.imageUrl || '');
            const statusCell = safeCreateElement('td', '', 'Collected');
            
            row.appendChild(titleCell);
            row.appendChild(urlCell);
            row.appendChild(statusCell);
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        dataPreview.appendChild(table);
    }
    
    // Enhanced filename preview with validation
    function updateFilenamePreview() {
        const previewElement = document.getElementById('filenamePreview');
        if (!previewElement) return;
        
        const pattern = document.getElementById('filenamePattern');
        if (!pattern) return;
        
        const sampleData = {
            name: 'sample_image',
            ext: 'jpg',
            num: '001',
            image_url: 'example.com',
            website_url: 'gallery.com',
            hh: '14',
            mm: '30',
            ss: '45',
            m: '12',
            d: '25',
            y: '23',
            yyyy: '2023'
        };
        
        let preview = pattern.value;
        
        // Replace tokens safely
        Object.entries(sampleData).forEach(([key, value]) => {
            preview = preview.replace(new RegExp(`\\*${key}\\*`, 'g'), value);
        });
        
        // Clean filename
        preview = preview.replace(/[<>:"/\\|?*]/g, '_');
        
        previewElement.textContent = preview;
    }
    
    // Enhanced event listeners
    function initializeEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }
        
        // Emergency stop
        const emergencyStop = document.getElementById('emergencyStop');
        if (emergencyStop) {
            emergencyStop.addEventListener('click', emergencyStopScraping);
        }
        
        // Scraping controls
        const startBtn = document.getElementById('startScraping');
        if (startBtn) {
            startBtn.addEventListener('click', startScraping);
        }
        
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', pauseScraping);
        }
        
        const resumeBtn = document.getElementById('resumeBtn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', resumeScraping);
        }
        
        const stopBtn = document.getElementById('stopBtn');
        if (stopBtn) {
            stopBtn.addEventListener('click', stopScraping);
        }
        
        // Site profile selection (use actual buttons)
        const profileButtons = document.querySelectorAll('.profile-btn');
        profileButtons.forEach(button => {
            button.addEventListener('click', () => selectSiteProfile(button.dataset.profile));
        });
        
        // Scraping mode selection
        const modeRadios = document.querySelectorAll('input[name="scrapingMode"]');
        modeRadios.forEach(radio => {
            radio.addEventListener('change', updateScrapingMode);
        });
        
        // Target page selection
            const selectCurrentTab = document.getElementById('selectCurrentTab');
    if (selectCurrentTab) {
        selectCurrentTab.addEventListener('click', () => selectCurrentTabAsTarget(false));
    }
    
    const forceSelectCurrentTab = document.getElementById('forceSelectCurrentTab');
    if (forceSelectCurrentTab) {
        forceSelectCurrentTab.addEventListener('click', () => selectCurrentTabAsTarget(true));
    }
        
        // Tab navigation
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => switchTab(button.dataset.tab));
        });
        
        // Export buttons
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', exportToJSON);
        }
        
        const exportCSVBtn = document.getElementById('exportCSVBtn');
        if (exportCSVBtn) {
            exportCSVBtn.addEventListener('click', exportToCSV);
        }
        
        const exportXLSXBtn = document.getElementById('exportXLSXBtn');
        if (exportXLSXBtn) {
            exportXLSXBtn.addEventListener('click', exportToXLSX);
        }
        
        // Filename pattern input
        const filenamePattern = document.getElementById('filenamePattern');
        if (filenamePattern) {
            filenamePattern.addEventListener('input', updateFilenamePreview);
        }
        
        // Token insertion
        const tokenButtons = document.querySelectorAll('.token-btn');
        tokenButtons.forEach(button => {
            button.addEventListener('click', () => insertToken(button.dataset.token));
        });
        
        // Clear logs
        const clearLog = document.getElementById('clearLog');
        if (clearLog) {
            clearLog.addEventListener('click', clearLogs);
        }
        
        // Advanced controls
        const selectContainer = document.getElementById('selectContainer');
        if (selectContainer) {
            selectContainer.addEventListener('click', () => startContainerSelection());
        }
        
        const extractImages = document.getElementById('extractImages');
        if (extractImages) {
            extractImages.addEventListener('click', () => extractImagesFromContainer());
        }
        
        // Pagination buttons removed; pagination handled automatically during scraping when mode=all
        
        const targetNextPage = document.getElementById('targetNextPage');
        if (targetNextPage) {
            targetNextPage.addEventListener('click', () => startNextPageTargeting());
        }
        
        const smartSelect = document.getElementById('smartSelect');
        if (smartSelect) {
            smartSelect.addEventListener('click', () => startSmartSelection());
        }
        
        const testSelectors = document.getElementById('testSelectors');
        if (testSelectors) {
            testSelectors.addEventListener('click', () => testSelectors());
        }
        
        // Selector actions
        const saveCustomSelectors = document.getElementById('saveCustomSelectors');
        if (saveCustomSelectors) {
            saveCustomSelectors.addEventListener('click', saveSelectors);
        }
        
        const resetCounter = document.getElementById('resetCounter');
        if (resetCounter) {
            resetCounter.addEventListener('click', resetFileCounter);
        }
        
        // Log actions
        const exportReport = document.getElementById('exportReport');
        if (exportReport) {
            exportReport.addEventListener('click', exportReportData);
        }
        
        // Download actions
        const downloadAll = document.getElementById('downloadAll');
        if (downloadAll) {
            downloadAll.addEventListener('click', downloadAllImages);
        }
        
        const stopDownloads = document.getElementById('stopDownloads');
        if (stopDownloads) {
            stopDownloads.addEventListener('click', stopAllDownloads);
        }
        
        const openDownloads = document.getElementById('openDownloads');
        if (openDownloads) {
            openDownloads.addEventListener('click', openDownloadsFolder);
        }
        
        // Debug actions
        const debugPage = document.getElementById('debugPage');
        if (debugPage) {
            debugPage.addEventListener('click', debugCurrentPage);
        }
        
        const refreshConnection = document.getElementById('refreshConnection');
        if (refreshConnection) {
            refreshConnection.addEventListener('click', refreshConnectionStatus);
        }
        
        // Settings inputs
        const settingInputs = document.querySelectorAll('.setting-input');
        settingInputs.forEach(input => {
            input.addEventListener('change', saveSettings);
        });
        
        // Selector inputs
        const selectorInputs = document.querySelectorAll('.selector-input');
        selectorInputs.forEach(input => {
            input.addEventListener('change', saveSelectors);
        });
        
        // Filters removed
    }
    
    // Enhanced scraping functions
    async function startScraping() {
        try {
            const settings = getCurrentSettings();
            const errors = validateSettings(settings);
            
            if (errors.length > 0) {
                showNotification('error', 'Validation Error', errors.join(', '));
                return;
            }
            
            if (!backgroundState.originalTabId) {
                showNotification('error', 'No Target', 'Please select a target page first');
                return;
            }
            
            await safeSendMessage({
                action: 'startScraping',
                data: {
                    tabId: backgroundState.originalTabId,
                    url: backgroundState.originalTabUrl,
                    settings: settings
                }
            });
            
            showNotification('success', 'Scraping Started', 'Image extraction has begun');
            startRuntimeTimer();
            
        } catch (error) {
            showNotification('error', 'Start Failed', error.message);
        }
    }
    
    async function pauseScraping() {
        try {
            await safeSendMessage({ action: 'pauseScraping' });
            showNotification('info', 'Scraping Paused', 'Image extraction has been paused');
        } catch (error) {
            showNotification('error', 'Pause Failed', error.message);
        }
    }
    
    async function resumeScraping() {
        try {
            await safeSendMessage({ action: 'resumeScraping' });
            showNotification('info', 'Scraping Resumed', 'Image extraction has resumed');
        } catch (error) {
            showNotification('error', 'Resume Failed', error.message);
        }
    }
    
    async function stopScraping() {
        try {
            await safeSendMessage({ action: 'stopScraping' });
            showNotification('info', 'Scraping Stopped', 'Image extraction has been stopped');
            stopRuntimeTimer();
        } catch (error) {
            showNotification('error', 'Stop Failed', error.message);
        }
    }
    
    async function emergencyStopScraping() {
        try {
            await safeSendMessage({ action: 'emergencyStop' });
            showNotification('warning', 'Emergency Stop', 'All operations have been stopped');
            stopRuntimeTimer();
        } catch (error) {
            showNotification('error', 'Emergency Stop Failed', error.message);
        }
    }
    
    // Enhanced settings management
    function getCurrentSettings() {
        const settings = {
            containerSelector: document.getElementById('containerSelector')?.value || '',
            imageSelector: document.getElementById('imageSelector')?.value || 'img, picture img, [data-src], [data-srcset], [style*="background-image"]',
            linkSelector: document.getElementById('linkSelector')?.value || 'a',
            titleSelector: document.getElementById('titleSelector')?.value || '.title',
            nextPageSelector: document.getElementById('nextPageSelector')?.value || '.next',
            filenamePattern: document.getElementById('filenamePattern')?.value || '*name*_*num*.*ext*',
            downloadFolder: document.getElementById('downloadFolder')?.value || 'STEPTWO_Images',
            maxPages: parseInt(document.getElementById('maxPages')?.value || '0') || 0,
            pageWait: parseInt(document.getElementById('pageWait')?.value || '3') || 3,
            imageWait: parseInt(document.getElementById('imageWait')?.value || '5000') || 5000,
            scrollDelay: parseInt(document.getElementById('scrollDelay')?.value || '1000') || 1000,
            maxScrollAttempts: parseInt(document.getElementById('maxScrollAttempts')?.value || '5') || 5,
            retryAttempts: parseInt(document.getElementById('retryAttempts')?.value || '3') || 3,
            downloadImages: document.getElementById('downloadImages')?.checked !== false,
            mode: document.querySelector('input[name="scrapingMode"]:checked')?.value || 'current'
        };
        
        return settings;
    }
    
    function selectSiteProfile(profileName) {
        const profile = siteProfiles[profileName];
        if (profile) {
            document.getElementById('containerSelector').value = profile.selectors.container;
            document.getElementById('imageSelector').value = profile.selectors.image;
            document.getElementById('linkSelector').value = profile.selectors.link;
            document.getElementById('titleSelector').value = profile.selectors.title;
            
            currentProfile = profileName;
            
            // Update active state
            document.querySelectorAll('.profile-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-profile="${profileName}"]`).classList.add('active');
            
            showNotification('success', 'Profile Selected', `${profile.name} profile loaded`);
            const label = document.getElementById('currentProfileLabel');
            if (label) label.textContent = profileName;
        }
    }
    
    function updateScrapingMode() {
        const selectedMode = document.querySelector('input[name="scrapingMode"]:checked').value;
        
        // Update UI based on mode
        updateModeUI(selectedMode);
        
        showNotification('info', 'Mode Updated', `${selectedMode} mode selected`);
    }
    
    function updateModeUI(mode) {
        // Show/hide relevant controls based on mode
        const advancedControls = document.querySelector('.advanced-controls');
        const paginationControls = document.querySelector('.control-group');
        
        if (mode === 'all') {
            paginationControls.style.display = 'block';
        } else {
            paginationControls.style.display = 'none';
        }
    }
    
    async function selectCurrentTabAsTarget(force = false) {
        try {
            addToActivityLog(`Starting target selection (force: ${force})`, 'debug');
            
            // Get all tabs in all windows to find the best candidate
            const tabs = await chrome.tabs.query({});
            
            addToActivityLog('Available tabs found', 'debug', {
                totalTabs: tabs.length,
                tabs: tabs.map(t => ({ 
                    id: t.id, 
                    url: t.url, 
                    active: t.active, 
                    windowId: t.windowId 
                }))
            });
            
            // Prefer active non-extension tab
            let candidate = tabs.find(t => t.active && !t.url.startsWith('chrome-extension://'));
            
            if (candidate) {
                addToActivityLog('Found active non-extension tab', 'debug', {
                    tabId: candidate.id,
                    url: candidate.url
                });
            }
            
            // If not found, pick first non-extension tab
            if (!candidate) {
                candidate = tabs.find(t => !t.url.startsWith('chrome-extension://'));
                if (candidate) {
                    addToActivityLog('Found first non-extension tab', 'debug', {
                        tabId: candidate.id,
                        url: candidate.url
                    });
                }
            }
            
            if (!candidate) {
                addToActivityLog('No non-extension tabs found', 'error', {
                    availableTabs: tabs.map(t => ({ id: t.id, url: t.url, active: t.active }))
                });
                showNotification('error', 'No Valid Target', 'No non-extension tabs available to select as target.');
                return;
            }
            
            addToActivityLog('Sending updateTargetTab message', 'debug', {
                tabId: candidate.id,
                url: candidate.url,
                force: force
            });
            
            const response = await safeSendMessage({
                action: 'updateTargetTab',
                data: {
                    originalTabId: candidate.id,
                    originalTabUrl: candidate.url,
                    force: force
                }
            });
            
            addToActivityLog('Received updateTargetTab response', 'debug', response);
            
            if (response && response.data && response.data.status === 'ignored') {
                addToActivityLog('Target update ignored', 'warning', {
                    reason: response.data.reason,
                    currentTarget: backgroundState?.originalTabUrl
                });
                
                if (response.data.reason === 'target-exists') {
                    showNotification('info', 'Target Exists', 'Target already set. Use "Force Update" to change it.');
                } else if (response.data.reason === 'sender-is-extension-page') {
                    showNotification('error', 'Invalid Target', 'Cannot select extension pages as targets');
                }
                return;
            }
            
            // Update local state to reflect the change
            await updateScrapingState();
            
            // Log force update action for debugging
            if (force) {
                addToActivityLog(`Force update executed - Target changed to: ${candidate.url}`, 'warning');
            }
            
            showNotification('success', 'Target Set', `Selected: ${candidate.url.substring(0, 50)}...`);
        } catch (error) {
            showNotification('error', 'Target Selection Failed', error.message);
        }
    }
    
    function switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Remove active from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        const selectedTab = document.getElementById(`${tabName}Tab`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Activate selected button
        const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }
    }
    
    function startContainerSelection() {
        if (!backgroundState.originalTabId) {
            showNotification('error', 'No Target', 'Please select a target page first');
            return;
        }
        
        chrome.runtime.sendMessage({
            action: 'startContainerSelection',
            tabId: backgroundState.originalTabId
        });
        
        showNotification('info', 'Container Selection', 'Click on any element to select its container');
    }
    
    function extractImagesFromContainer() {
        const containerSelector = document.getElementById('containerSelector').value;
        if (!containerSelector) {
            showNotification('error', 'No Selector', 'Please enter a container selector');
            return;
        }
        
        if (!backgroundState.originalTabId) {
            showNotification('error', 'No Target', 'Please select a target page first');
            return;
        }
        
        chrome.runtime.sendMessage({
            action: 'extractImagesFromContainer',
            tabId: backgroundState.originalTabId,
            data: { container: containerSelector }
        });
        
        showNotification('info', 'Extracting Images', 'Extracting images from container...');
    }
    
    function startSmartSelection() {
        if (!backgroundState.originalTabId) {
            showNotification('error', 'No Target', 'Please select a target page first');
            return;
        }
        
        chrome.runtime.sendMessage({
            action: 'startContainerSelection',
            tabId: backgroundState.originalTabId
        });
        
        showNotification('info', 'Smart Selection', 'Click on any element to automatically detect similar elements');
    }
    
    async function testSelectors() {
        const containerSelector = document.getElementById('containerSelector').value;
        const imageSelector = document.getElementById('imageSelector').value;
        const linkSelector = document.getElementById('linkSelector')?.value || 'a';
        const titleSelector = document.getElementById('titleSelector')?.value || '.title';
        
        if (!containerSelector || !imageSelector) {
            showNotification('error', 'Missing Selectors', 'Please enter container and image selectors');
            return;
        }
        
        if (!backgroundState.originalTabId) {
            showNotification('error', 'No Target', 'Please select a target page first');
            return;
        }
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'testSelectors',
                tabId: backgroundState.originalTabId,
                data: {
                    container: containerSelector,
                    image: imageSelector,
                    link: linkSelector,
                    title: titleSelector
                }
            });
            
            if (response && response.success) {
                showNotification('success', 'Selector Test', response.message || 'Selectors tested successfully');
                
                // Show detailed results in console for debugging
                console.log('Selector test results:', response.data);
            } else {
                showNotification('error', 'Selector Test Failed', response?.error || 'Unknown error');
            }
        } catch (error) {
            showNotification('error', 'Selector Test Failed', error.message);
        }
    }
    
    function saveSettings() {
        const settings = getCurrentSettings();
        localStorage.setItem('steptwo-settings', JSON.stringify(settings));
        showNotification('success', 'Settings Saved', 'Settings have been saved');
    }
    
    function saveSelectors() {
        const selectors = {
            container: document.getElementById('containerSelector').value,
            image: document.getElementById('imageSelector').value,
            link: document.getElementById('linkSelector').value,
            title: document.getElementById('titleSelector').value,
            nextPage: document.getElementById('nextPageSelector').value
        };
        
        localStorage.setItem('steptwo-selectors', JSON.stringify(selectors));
        showNotification('success', 'Selectors Saved', 'Selectors have been saved');
    }
    
    // Filters removed
    
    // Pagination functions
    // Manual pagination start/stop removed; use mode selector and Start/Stop scraping
    
    function startNextPageTargeting() {
        if (!backgroundState || !backgroundState.originalTabId) {
            showNotification('error', 'No Target', 'Please select a target page first');
            return;
        }
        
        chrome.runtime.sendMessage({
            action: 'startNextPageTargeting',
            tabId: backgroundState.originalTabId
        });
        
        showNotification('info', 'Next Page Targeting', 'Click on the next page button');
    }
    
    // Utility functions
    function resetFileCounter() {
        chrome.runtime.sendMessage({
            action: 'resetFileCounter'
        });
        
        showNotification('success', 'Counter Reset', 'File counter has been reset');
    }
    
    function exportReportData() {
        const reportData = {
            timestamp: new Date().toISOString(),
            state: backgroundState,
            settings: getCurrentSettings()
        };
        
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `steptwo-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        showNotification('success', 'Report Exported', 'Report data has been exported');
    }
    
    function downloadAllImages() {
        if (!backgroundState.collectedItems || backgroundState.collectedItems.length === 0) {
            showNotification('error', 'No Images', 'No images to download');
            return;
        }
        
        chrome.runtime.sendMessage({
            action: 'downloadAllImages',
            items: backgroundState.collectedItems
        });
        
        showNotification('info', 'Download Started', `Downloading ${backgroundState.collectedItems.length} images`);
    }
    
    function stopAllDownloads() {
        chrome.runtime.sendMessage({
            action: 'stopAllDownloads'
        });
        
        showNotification('info', 'Downloads Stopped', 'All downloads have been stopped');
    }
    
    function openDownloadsFolder() {
        chrome.runtime.sendMessage({
            action: 'openDownloadsFolder'
        });
        
        showNotification('info', 'Downloads Folder', 'Opening downloads folder');
    }
    
    function debugCurrentPage() {
        if (!backgroundState || !backgroundState.originalTabId) {
            showNotification('error', 'No Target', 'Please select a target page first');
            return;
        }
        
        chrome.runtime.sendMessage({
            action: 'debugPage',
            tabId: backgroundState.originalTabId
        });
        
        showNotification('info', 'Debug Started', 'Debugging current page');
    }
    
    function refreshConnectionStatus() {
        chrome.runtime.sendMessage({
            action: 'getScrapingState'
        }, (response) => {
            if (response && response.success) {
                backgroundState = response.data;
                updateUI();
                showNotification('success', 'Connection Refreshed', 'Connection status updated');
            } else {
                showNotification('error', 'Connection Failed', 'Failed to refresh connection');
            }
        });
    }
    
    // Enhanced export functions
    async function exportToJSON() {
        try {
            if (backgroundState.collectedItems.length === 0) {
                showNotification('warning', 'No Data', 'No data to export');
                return;
            }
            
            const data = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    totalItems: backgroundState.collectedItems.length,
                    source: backgroundState.originalTabUrl
                },
                items: backgroundState.collectedItems
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            await chrome.downloads.download({
                url: url,
                filename: `steptwo-export-${new Date().toISOString().split('T')[0]}.json`,
                saveAs: true
            });
            
            showNotification('success', 'Export Complete', 'Data exported to JSON file');
            
        } catch (error) {
            showNotification('error', 'Export Failed', error.message);
        }
    }
    
    async function exportToCSV() {
        try {
            if (backgroundState.collectedItems.length === 0) {
                showNotification('warning', 'No Data', 'No data to export');
                return;
            }
            
            const response = await safeSendMessage({ action: 'exportCSV' });
            if (response && response.status === 'success') {
                showNotification('success', 'Export Complete', 'Data exported to CSV file');
            } else {
                throw new Error('Export failed');
            }
            
        } catch (error) {
            showNotification('error', 'Export Failed', error.message);
        }
    }
    
    async function exportToXLSX() {
        try {
            if (backgroundState.collectedItems.length === 0) {
                showNotification('warning', 'No Data', 'No data to export');
                return;
            }
            
            const response = await safeSendMessage({ action: 'exportXLSX' });
            if (response && response.status === 'success') {
                showNotification('success', 'Export Complete', 'Data exported to XLSX file');
            } else {
                throw new Error('Export failed');
            }
            
        } catch (error) {
            showNotification('error', 'Export Failed', error.message);
        }
    }
    
    // Enhanced utility functions
    function insertToken(token) {
        const patternInput = document.getElementById('filenamePattern');
        if (patternInput) {
            const cursorPos = patternInput.selectionStart;
            const textBefore = patternInput.value.substring(0, cursorPos);
            const textAfter = patternInput.value.substring(cursorPos);
            
            patternInput.value = textBefore + `*${token}*` + textAfter;
            patternInput.setSelectionRange(cursorPos + token.length + 2, cursorPos + token.length + 2);
            patternInput.focus();
            
            updateFilenamePreview();
        }
    }
    
    async function clearLogs() {
        try {
            await safeSendMessage({ action: 'clearLogs' });
            showNotification('info', 'Logs Cleared', 'Activity log has been cleared');
        } catch (error) {
            showNotification('error', 'Clear Failed', error.message);
        }
    }
    
    async function clearAll() {
        try {
            await safeSendMessage({ action: 'clearScrapingState' });
            showNotification('info', 'All Cleared', 'All data and state have been cleared');
        } catch (error) {
            showNotification('error', 'Clear Failed', error.message);
        }
    }
    
    function toggleTheme() {
        const html = document.documentElement;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        html.setAttribute('data-theme', newTheme);
        currentTheme = newTheme;
        
        localStorage.setItem('steptwo-theme', newTheme);
        showNotification('info', 'Theme Changed', `${newTheme} theme applied`);
    }
    
    function startRuntimeTimer() {
        if (runtimeInterval) {
            clearInterval(runtimeInterval);
        }
        
        runtimeInterval = setInterval(updateRuntime, 1000);
    }
    
    function stopRuntimeTimer() {
        if (runtimeInterval) {
            clearInterval(runtimeInterval);
            runtimeInterval = null;
        }
    }
    
    // Enhanced message handling for differential updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
            if (message.action === 'updateState') {
                handleStateUpdate(message);
            } else if (message.action === 'heartbeat') {
                handleHeartbeat(message);
            } else if (message.action === 'serviceWorkerShutdown') {
                handleServiceWorkerShutdown(message);
            } else if (message.action === 'errorNotification') {
                handleErrorNotification(message);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
    
    function handleStateUpdate(message) {
        console.log('📨 Dashboard received state update:', message);
        if (message.type === 'full') {
            // Full state update
            backgroundState = message.data;
            console.log('📄 Full state received:', {
                originalTabId: backgroundState.originalTabId,
                originalTabUrl: backgroundState.originalTabUrl
            });
            updateUI();
        } else if (message.type === 'diff') {
            // Differential update
            applyStateDiff(message.data);
            updateUI();
        }
    }
    
    function applyStateDiff(diff) {
        const changes = diff.changes;
        
        for (const [key, value] of Object.entries(changes)) {
            if (key === 'logs' && typeof value === 'object' && value.type === 'append') {
                // Append new logs
                if (!backgroundState.logs) backgroundState.logs = [];
                backgroundState.logs.push(...value.data);
                
                // Trim logs if too many
                if (backgroundState.logs.length > 1000) {
                    backgroundState.logs = backgroundState.logs.slice(-1000);
                }
            } else {
                // Direct update
                backgroundState[key] = value;
            }
        }
    }
    
    function handleHeartbeat(message) {
        // Update connection status
        updateConnectionStatus(true);
        
        // Update last heartbeat time (if this variable exists)
        if (typeof lastHeartbeat !== 'undefined') {
            lastHeartbeat = message.timestamp;
        }
    }
    
    function handleServiceWorkerShutdown(message) {
        updateConnectionStatus(false);
        showNotification('warning', 'Service Worker', 'Background service is restarting...');
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
            updateScrapingState();
        }, 2000);
    }
    
    function handleErrorNotification(message) {
        const error = message.data;
        showNotification('error', 'Error', `${error.messageAction}: ${error.error}`);
    }

    // Enhanced state update function with detailed logging
    async function updateScrapingState() {
        try {
            addToActivityLog('Requesting state from background script', 'debug');
            const response = await safeSendMessage({ action: 'getScrapingState' });
            
            if (response && response.success) {
                backgroundState = response.data;
                addToActivityLog('State received from background', 'info', {
                    originalTabId: response.data?.originalTabId,
                    originalTabUrl: response.data?.originalTabUrl,
                    isActive: response.data?.isActive,
                    isPaused: response.data?.isPaused
                });
                updateUI();
            } else {
                addToActivityLog('No response from getScrapingState', 'warning');
                console.warn('No response or unsuccessful from getScrapingState', response);
            }
        } catch (error) {
            addToActivityLog('Failed to update scraping state', 'error', {
                error: error.message,
                stack: error.stack
            });
            console.error('Failed to update scraping state:', error);
            showNotification('error', 'State Update Failed', error.message);
        }
    }

    // Enhanced initialization without polling
    async function initializeDashboard() {
        try {
            addToActivityLog('Initializing STEPTWO Gallery Scraper Dashboard', 'info');
            console.log('Initializing STEPTWO Gallery Scraper Dashboard...');
            
            // Load theme
            const savedTheme = localStorage.getItem('steptwo-theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            currentTheme = savedTheme;
            
            // Validate required DOM elements
            const requiredElements = [
                'notification-container',
                'currentTabUrl',
                'startScraping',
                'containerSelector',
                'imageSelector'
            ];
            
            const missingElements = requiredElements.filter(id => !document.getElementById(id));
            if (missingElements.length > 0) {
                console.error('Missing required DOM elements:', missingElements);
                showNotification('error', 'Initialization Error', `Missing elements: ${missingElements.join(', ')}`);
                return;
            }
            
            // Initialize event listeners
            initializeEventListeners();
            
            // Test connection to background script first
            try {
                addToActivityLog('Testing connection to background script', 'debug');
                const pingResponse = await safeSendMessage({ action: 'ping' });
                if (pingResponse) {
                    addToActivityLog('Background connection established', 'success');
                    console.log('Background connection established');
                    
                    // Open a persistent port for live state sync
                    try {
                        bgPort = chrome.runtime.connect({ name: 'dashboard' });
                        addToActivityLog('Opened port to background for live updates', 'info');
                        
                        bgPort.onMessage.addListener((msg) => {
                            if (msg && msg.action === 'stateUpdate') {
                                addToActivityLog('Live state update received', 'debug', {
                                    originalTabId: msg.data?.originalTabId,
                                    originalTabUrl: msg.data?.originalTabUrl
                                });
                                backgroundState = msg.data || backgroundState;
                                updateUI();
                            }
                        });
                        
                        bgPort.onDisconnect.addListener(() => {
                            addToActivityLog('Background port disconnected', 'warning');
                        });
                        
                        // Notify background that dashboard is ready to receive updates
                        bgPort.postMessage({ action: 'dashboardConnected' });
                    } catch (e) {
                        addToActivityLog('Failed to open background port', 'error', e.message);
                    }
                    
                    // Load initial state after connection is confirmed
                    await updateScrapingState();
                    
                    // Check if we need to auto-select a target
                    if (!backgroundState.originalTabId || !backgroundState.originalTabUrl) {
                        addToActivityLog('No existing target found, auto-selecting', 'info');
                        await selectCurrentTabAsTarget(false); // Don't force overwrite
                    } else {
                        addToActivityLog('Existing target found, skipping auto-selection', 'info', {
                            targetUrl: backgroundState.originalTabUrl
                        });
                    }
                    
                    showNotification('success', 'Dashboard Ready', 'STEPTWO Gallery Scraper is ready');
                } else {
                    throw new Error('No response from background script');
                }
            } catch (error) {
                addToActivityLog('Background connection failed', 'error', {
                    error: error.message,
                    stack: error.stack
                });
                console.error('Background connection failed:', error);
                showNotification('warning', 'Connection Issue', 'Dashboard loaded but connection to background may be unstable');
            }
            
            // Initialize filename preview
            updateFilenamePreview();
            
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            showNotification('error', 'Initialization Failed', `Failed to initialize dashboard: ${error.message}`);
        }
    }
    
    // Start initialization
    initializeDashboard();
});