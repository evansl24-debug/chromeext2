// STEPTWO Gallery Scraper - Background Script (Service Worker)
// Production-ready with robust state management, memory optimization, and error handling

// Configuration
const CONFIG = {
    DEBUG: false,
    MAX_STORED_ITEMS: 5000,
    MAX_LOG_ENTRIES: 500,
    MAX_FAILED_ITEMS: 1000,
    CLEANUP_INTERVAL: 30000,
    MESSAGE_TIMEOUT: 30000,
    MAX_RETRIES: 3,
    BATCH_SIZE: 10,
    KEEP_ALIVE_INTERVAL: 25000
};

// Immutable state management with atomic updates
class ScrapingStateManager {
    constructor() {
        this.state = {
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
            logs: [],
            downloadedUrls: new Set(),
            seenItems: new Set(),
            consecutiveEmptyPages: 0,
            maxPages: 0,
            fileCounter: 1,
            lastActivity: Date.now()
        };
        
        this.subscribers = new Set();
        this.updateQueue = [];
        this.isProcessing = false;
    }
    
    // Atomic state updates
    async update(updateFn) {
        return new Promise((resolve) => {
            this.updateQueue.push({ updateFn, resolve });
            this.processUpdates();
        });
    }
    
    async processUpdates() {
        if (this.isProcessing || this.updateQueue.length === 0) return;
        
        this.isProcessing = true;
        
        try {
            while (this.updateQueue.length > 0) {
                const { updateFn, resolve } = this.updateQueue.shift();
                
                // Create immutable copy for update
                const newState = { ...this.state };
                
                // Apply update function
                const result = await updateFn(newState);
                
                // Update state atomically
                this.state = { ...newState, lastActivity: Date.now() };
                
                // Notify subscribers
                this.notifySubscribers();
                
                // Cleanup if needed
                this.cleanupIfNeeded();
                
                resolve(result);
            }
        } catch (error) {
            console.error('State update failed:', error);
            this.addLog('error', `State update failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }
    
    // Memory management
    cleanupIfNeeded() {
        // Limit collected items
        if (this.state.collectedItems.length > CONFIG.MAX_STORED_ITEMS) {
            this.state.collectedItems = this.state.collectedItems.slice(-CONFIG.MAX_STORED_ITEMS);
        }
        
        // Limit logs
        if (this.state.logs.length > CONFIG.MAX_LOG_ENTRIES) {
            this.state.logs = this.state.logs.slice(-CONFIG.MAX_LOG_ENTRIES);
        }
        
        // Limit failed items
        if (this.state.failedItems.length > CONFIG.MAX_FAILED_ITEMS) {
            this.state.failedItems = this.state.failedItems.slice(-CONFIG.MAX_FAILED_ITEMS);
        }
    }
    
    // Subscriber management
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }
    
    notifySubscribers() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('Subscriber callback failed:', error);
            }
        });
    }
    
    // Helper methods
    async addLog(level, message) {
        await this.update(state => {
            state.logs.push({
                level,
                message,
                timestamp: Date.now()
            });
        });
    }
    
    async addCollectedItem(item) {
        await this.update(state => {
            state.collectedItems.push(item);
            state.totalImages++;
        });
    }
    
    async addFailedItem(item, error) {
        await this.update(state => {
            state.failedItems.push({ item, error: error.message, timestamp: Date.now() });
            state.failedDownloads++;
        });
    }
    
    getState() {
        return { ...this.state };
    }
}

// Enhanced download manager with retry logic and batching
class DownloadManager {
    constructor() {
        this.downloadQueue = [];
        this.activeDownloads = new Set();
        this.maxConcurrent = 3;
        this.retryDelays = [1000, 2000, 5000];
    }
    
    async queueDownload(imageUrl, filename, settings) {
        const downloadTask = {
            id: this.generateId(),
            imageUrl,
            filename,
            settings,
            retryCount: 0,
            maxRetries: CONFIG.MAX_RETRIES
        };
        
        this.downloadQueue.push(downloadTask);
        this.processQueue();
        
        return downloadTask.id;
    }
    
    async processQueue() {
        if (this.activeDownloads.size >= this.maxConcurrent || this.downloadQueue.length === 0) {
            return;
        }
        
        const task = this.downloadQueue.shift();
        this.activeDownloads.add(task.id);
        
        try {
            await this.downloadWithRetry(task);
        } catch (error) {
            console.error('Download failed permanently:', error);
            stateManager.addFailedItem({ url: task.imageUrl, filename: task.filename }, error);
        } finally {
            this.activeDownloads.delete(task.id);
            this.processQueue();
        }
    }
    
    async downloadWithRetry(task) {
        for (let attempt = 0; attempt <= task.maxRetries; attempt++) {
            try {
                await this.performDownload(task);
                return;
            } catch (error) {
                if (attempt === task.maxRetries) {
                    throw error;
                }
                
                const delay = this.retryDelays[attempt] || 5000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    async performDownload(task) {
        return new Promise((resolve, reject) => {
            chrome.downloads.download({
                url: task.imageUrl,
                filename: task.filename,
                conflictAction: 'uniquify'
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(downloadId);
                }
            });
        });
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Robust message handler with proper async support
class MessageHandler {
    constructor() {
        this.handlers = new Map();
        this.setupHandlers();
    }
    
    setupHandlers() {
        this.handlers.set('ping', this.handlePing.bind(this));
        this.handlers.set('dashboardConnected', this.handleDashboardConnected.bind(this));
        this.handlers.set('getScrapingState', this.handleGetScrapingState.bind(this));
        this.handlers.set('updateTargetTab', this.handleUpdateTargetTab.bind(this));
        this.handlers.set('contentScriptError', this.handleContentScriptError.bind(this));
        this.handlers.set('startScraping', this.handleStartScraping.bind(this));
        this.handlers.set('pauseScraping', this.handlePauseScraping.bind(this));
        this.handlers.set('resumeScraping', this.handleResumeScraping.bind(this));
        this.handlers.set('stopScraping', this.handleStopScraping.bind(this));
        this.handlers.set('emergencyStop', this.handleEmergencyStop.bind(this));
        this.handlers.set('clearScrapingState', this.handleClearScrapingState.bind(this));
        this.handlers.set('clearLogs', this.handleClearLogs.bind(this));
        this.handlers.set('clearStorage', this.handleClearStorage.bind(this));
        this.handlers.set('exportCSV', this.handleExportCSV.bind(this));
        this.handlers.set('exportXLSX', this.handleExportXLSX.bind(this));
        this.handlers.set('startContainerSelection', this.handleStartContainerSelection.bind(this));
        this.handlers.set('extractImagesFromContainer', this.handleExtractImagesFromContainer.bind(this));
        this.handlers.set('testSelectors', this.handleTestSelectors.bind(this));
        this.handlers.set('startNextPageTargeting', this.handleStartNextPageTargeting.bind(this));
        // Gracefully handle dashboard actions not yet implemented
        this.handlers.set('stopAllDownloads', this.handleStopAllDownloads.bind(this));
        this.handlers.set('downloadAllImages', this.handleDownloadAllImages.bind(this));
        this.handlers.set('openDownloadsFolder', this.handleOpenDownloadsFolder.bind(this));
        this.handlers.set('startPagination', async () => ({ status: 'noop' }));
        this.handlers.set('stopPagination', async () => ({ status: 'noop' }));
    }
    
    async handleMessage(message, sender) {
        const { action, data, tabId } = message;
        
        try {
            const handler = this.handlers.get(action);
            if (!handler) {
                throw new Error(`Unknown action: ${action}`);
            }
            
            return await handler(data, tabId, sender);
        } catch (error) {
            console.error(`Message handler failed for action ${action}:`, error);
            await stateManager.addLog('error', `Message handler failed: ${error.message}`);
            throw error;
        }
    }
    
    // Handler implementations
    async handlePing() {
        return { pong: true, timestamp: Date.now() };
    }
    
    async handleDashboardConnected() {
        sendStateUpdate();
    }
    
    async handleGetScrapingState() {
        return stateManager.getState();
    }
    
    async handleUpdateTargetTab(data, sender) {
        const { originalTabId, originalTabUrl } = data || {};
        
        // Defensive: if sender is an extension page, ignore (dashboard should not become the target)
        const senderUrl = (sender && sender.url) || (sender && sender.tab && sender.tab.url);
        if (senderUrl && senderUrl.startsWith('chrome-extension://')) {
            console.warn('Ignored updateTargetTab from extension page:', senderUrl);
            await stateManager.addLog('warning', `Ignored target update from extension page: ${senderUrl}`);
            return { status: 'ignored', reason: 'sender-is-extension-page' };
        }

        // Defensive: if there's already a valid target, do NOT overwrite it unless caller explicitly asks
        const current = stateManager.getState();
        if (current.originalTabId && current.originalTabUrl) {
            // Optionally allow overwrite if data.force === true
            if (!data.force) {
                console.warn('Ignored updateTargetTab - target already exists:', current.originalTabUrl);
                await stateManager.addLog('warning', `Ignored target update - target already exists: ${current.originalTabUrl}`);
                return { status: 'ignored', reason: 'target-exists' };
            }
        }

        // Validate then set
        if (!originalTabId || !originalTabUrl) {
            throw new Error('updateTargetTab requires originalTabId and originalTabUrl');
        }

        await stateManager.update(state => {
            state.originalTabId = originalTabId;
            state.originalTabUrl = originalTabUrl;
        });

        await stateManager.addLog('info', `Target tab set: ${originalTabUrl} (id ${originalTabId})`);

        // Broadcast new state to any dashboards / ports
        sendStateUpdate();

                return { status: 'ok' };
    }

    async handleContentScriptError(data) {
        const { error, timestamp, url, filename, lineno, type } = data || {};
        
        // Handle undefined or null error messages
        const errorMessage = error || 'Unknown error';
        const errorDetails = {
            timestamp: timestamp || Date.now(),
            url: url || 'unknown',
            filename: filename || 'unknown',
            lineno: lineno || 'unknown',
            type: type || 'error'
        };
        
        await stateManager.addLog('error', `Content Script Error: ${errorMessage}`, errorDetails);

        console.error('Content script error:', {
            error: errorMessage,
            ...errorDetails
        });

        return { status: 'logged' };
    }

    async handleStartScraping(data) {
        const { tabId, url, settings } = data;
        
        if (!tabId || !url || !this.validateImageUrl(url)) {
            throw new Error('Invalid scraping parameters');
        }
        
        await stateManager.update(state => {
            state.originalTabId = tabId;
            state.originalTabUrl = url;
            state.settings = settings;
            state.isActive = true;
            state.isPaused = false;
            state.startTime = Date.now();
            state.currentPage = 1;
            state.totalImages = 0;
            state.downloadedImages = 0;
            state.failedDownloads = 0;
            state.collectedItems = [];
            state.failedItems = [];
            state.consecutiveEmptyPages = 0;
            state.maxPages = settings.maxPages || 0;
        });
        
        await stateManager.addLog('info', `Starting scraping on ${new URL(url).hostname}`);
        
        // Start scraping process
        this.startScrapingProcess(tabId, url, settings);
    }
    
    async handlePauseScraping() {
        await stateManager.update(state => {
            state.isPaused = true;
        });
        await stateManager.addLog('info', 'Scraping paused');
    }
    
    async handleResumeScraping() {
        await stateManager.update(state => {
            state.isPaused = false;
        });
        await stateManager.addLog('info', 'Scraping resumed');
        
        // Resume scraping process
        const state = stateManager.getState();
        if (state.isActive && !state.isPaused) {
            this.startScrapingProcess(state.originalTabId, state.originalTabUrl, state.settings);
        }
    }
    
    async handleStopScraping() {
        await stateManager.update(state => {
            state.isActive = false;
            state.isPaused = false;
        });
        await stateManager.addLog('info', 'Scraping stopped');
    }
    
    async handleEmergencyStop() {
        await stateManager.update(state => {
            state.isActive = false;
            state.isPaused = false;
        });
        await stateManager.addLog('warning', 'Emergency stop activated');
    }
    
    async handleClearScrapingState() {
        await stateManager.update(state => {
            state.collectedItems = [];
            state.failedItems = [];
            state.logs = [];
            state.downloadedUrls.clear();
            state.seenItems.clear();
        });
    }
    
    async handleClearLogs() {
        await stateManager.update(state => {
            state.logs = [];
        });
    }
    
    async handleClearStorage() {
        await chrome.storage.local.clear();
        await stateManager.addLog('info', 'Storage cleared');
    }
    
    async handleExportCSV() {
        const state = stateManager.getState();
        return await this.generateCSV(state.collectedItems);
    }
    
    async handleExportXLSX() {
        const state = stateManager.getState();
        return await this.generateXLSX(state.collectedItems);
    }
    
    async handleStartContainerSelection(data, tabId) {
        await this.injectContentScript(tabId);
        await chrome.tabs.sendMessage(tabId, { action: 'startContainerSelection' });
    }
    
    async handleExtractImagesFromContainer(data, tabId) {
        await this.injectContentScript(tabId);
        const result = await chrome.tabs.sendMessage(tabId, {
            action: 'extractImagesFromContainer',
            data
        });
        return result;
    }
    
    async handleTestSelectors(data, tabId) {
        await this.injectContentScript(tabId);
        const result = await chrome.tabs.sendMessage(tabId, {
            action: 'testSelectors',
            data
        });
        return result;
    }
    
    async handleStartNextPageTargeting(data, tabId) {
        await this.injectContentScript(tabId);
        await chrome.tabs.sendMessage(tabId, { action: 'startNextPageTargeting' });
    }

    async handleStopAllDownloads() {
        // Clear pending queue and active downloads softly
        downloadManager.downloadQueue = [];
        return { status: 'stopped' };
    }

    async handleDownloadAllImages(data) {
        const state = stateManager.getState();
        const items = (data && data.items) || state.collectedItems || [];
        for (const it of items) {
            try {
                await downloadManager.queueDownload(it.url, it.filename || this.generateFilename({ url: it.url }, state.settings), state.settings);
            } catch (e) {
                console.warn('queue download failed', e);
            }
        }
        return { status: 'queued', count: items.length };
    }

    async handleOpenDownloadsFolder() {
        // Chrome does not allow programmatic opening of the downloads folder from service worker
        return { status: 'unsupported' };
    }
    
    // Helper methods
    validateImageUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }
    
    async startScrapingProcess(tabId, url, settings) {
        try {
            await this.injectContentScript(tabId);
            await this.scrapePage(tabId, url, settings);
        } catch (error) {
            await stateManager.addLog('error', `Scraping process failed: ${error.message}`);
            await stateManager.update(state => {
                state.isActive = false;
            });
        }
    }
    
    async injectContentScript(tabId) {
        // No-op: content.js is injected via manifest.json (all_frames=true)
        // Avoid double-injecting to prevent "Identifier has already been declared" errors
        return;
    }
    
    async scrapePage(tabId, url, settings) {
        const state = stateManager.getState();
        if (!state.isActive || state.isPaused) return;
        
        // Wait for page load
        await this.waitForPageLoad(tabId, settings.pageWait * 1000);
        
        // Extract images
        const results = await chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            func: async (settings) => {
                try {
                    if (window.extractImagesFromPage) {
                        return await window.extractImagesFromPage(settings);
                    }
                } catch (e) {}
                // Fallback ad-hoc extractor when content script is unavailable
                function pickBestFromSrcset(srcset) {
                    if (!srcset) return null;
                    const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
                    let best = null; let bestScore = -1;
                    for (const p of parts) {
                        const [url, desc] = p.split(/\s+/);
                        if (!url) continue;
                        const mW = desc && desc.match(/^(\d+)w$/);
                        const mX = desc && desc.match(/^([\d.]+)x$/);
                        let score = -1;
                        if (mW) score = parseInt(mW[1], 10);
                        else if (mX) score = parseFloat(mX[1]);
                        if (score > bestScore) { bestScore = score; best = url; }
                        if (!desc && !best) best = url;
                    }
                    return best;
                }
                function getImageUrlFromEl(el) {
                    const tag = el.tagName && el.tagName.toLowerCase();
                    if (tag === 'img') {
                        if (el.currentSrc && !String(el.currentSrc).startsWith('data:')) return el.currentSrc;
                        if (el.src && !String(el.src).startsWith('data:')) return el.src;
                        const dataAttrs = ['data-src','data-original','data-lazy','data-file','data-large_image'];
                        for (const a of dataAttrs) { const v = el.getAttribute(a); if (v) return v; }
                        const dss = el.getAttribute('data-srcset'); if (dss) { const p = pickBestFromSrcset(dss); if (p) return p; }
                        const ss = el.getAttribute('srcset'); if (ss) { const p = pickBestFromSrcset(ss); if (p) return p; }
                    }
                    if (tag === 'source') {
                        const ss = el.getAttribute('srcset'); if (ss) { const p = pickBestFromSrcset(ss); if (p) return p; }
                        if (el.src) return el.src;
                    }
                    const child = el.querySelector && el.querySelector('img, picture img, source');
                    if (child) { const u = getImageUrlFromEl(child); if (u) return u; }
                    const cs = getComputedStyle(el);
                    if (cs && cs.backgroundImage && cs.backgroundImage !== 'none') {
                        const m = cs.backgroundImage.match(/url\(["']?(.*?)["']?\)/); if (m && m[1]) return m[1];
                    }
                    const inline = el.getAttribute && el.getAttribute('style');
                    if (inline && inline.includes('background-image')) {
                        const m = inline.match(/url\(["']?(.*?)["']?\)/); if (m && m[1]) return m[1];
                    }
                    return null;
                }
                try {
                    const robustDefault = 'img, picture img, [data-src], [data-srcset], [style*="background-image"]';
                    const imageSel = settings && (settings.imageSelector || (settings.selectors && settings.selectors.image)) || robustDefault;
                    const containerSel = settings && (settings.containerSelector || (settings.selectors && settings.selectors.container)) || '';
                    let nodes = [];
                    if (containerSel) {
                        document.querySelectorAll(containerSel).forEach(c => {
                            try { c.querySelectorAll(imageSel).forEach(n => nodes.push(n)); } catch(e) {}
                        });
                    } else {
                        nodes = Array.from(document.querySelectorAll(imageSel));
                    }
                    const seen = new Set();
                    const images = [];
                    for (const el of nodes) {
                        let url = getImageUrlFromEl(el);
                        if (!url) continue;
                        if (url.startsWith('//')) url = location.protocol + url;
                        try { url = new URL(url, location.href).toString(); } catch(e) { continue; }
                        if (url.startsWith('data:')) continue;
                        if (seen.has(url)) continue;
                        seen.add(url);
                        images.push({ url });
                    }
                    return { images };
                } catch (e) {
                    return { images: [] };
                }
            },
            args: [settings]
        });
        
        // Combine results from all frames and dedupe by URL
        let combined = [];
        for (const frame of results) {
            const data = frame && frame.result;
            if (data && Array.isArray(data.images)) {
                combined = combined.concat(data.images);
            }
        }
        // Filter out obvious non-photo assets (icons, sprites)
        const filtered = combined.filter(i => {
            try {
                const u = (i && i.url || '').toLowerCase();
                if (!u) return false;
                if (u.startsWith('data:')) return false;
                if (u.includes('favicon') || u.includes('/icon/') || u.includes('/icons/') || u.includes('sprite') || u.endsWith('.svg')) return false;
                return true;
            } catch { return false; }
        });
        const deduped = Array.from(new Map(filtered.map(i => [i.url, i])).values());
        
        if (deduped.length > 0) {
            await this.processImages(deduped, settings);
            await stateManager.update(state => {
                state.consecutiveEmptyPages = 0;
            });
        } else {
            // Fallback: attempt to scroll to trigger lazy-loaded images, then retry once
            const retryResults = await chrome.scripting.executeScript({
                target: { tabId, allFrames: true },
                func: async (settings) => {
                    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                    for (let i = 0; i < 4; i++) {
                        try { window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }); } catch (e) {}
                        await sleep(800);
                    }
                    if (window.extractImagesFromPage) {
                        try {
                            return await window.extractImagesFromPage({ ...settings, imageWait: (settings.imageWait || 5000) + 3000 });
                        } catch (e) {}
                    }
                    return { images: [] };
                },
                args: [settings]
            });
            let retryCombined = [];
            for (const frame of retryResults) {
                const data = frame && frame.result;
                if (data && Array.isArray(data.images)) {
                    retryCombined = retryCombined.concat(data.images);
                }
            }
            const retryFiltered = retryCombined.filter(i => {
                try {
                    const u = (i && i.url || '').toLowerCase();
                    if (!u) return false;
                    if (u.startsWith('data:')) return false;
                    if (u.includes('favicon') || u.includes('/icon/') || u.includes('/icons/') || u.includes('sprite') || u.endsWith('.svg')) return false;
                    return true;
                } catch { return false; }
            });
            const retryDeduped = Array.from(new Map(retryFiltered.map(i => [i.url, i])).values());
            if (retryDeduped.length > 0) {
                await this.processImages(retryDeduped, settings);
                await stateManager.update(state => { state.consecutiveEmptyPages = 0; });
            } else {
            await stateManager.update(state => {
                state.consecutiveEmptyPages++;
            });
            await stateManager.addLog('warning', `No images found on page ${state.currentPage}`);
            }
        }
        
        // Check for pagination
        if (settings.mode === 'all' && !state.isPaused) {
            const hasNextPage = await this.checkForNextPage(tabId, settings);
            if (hasNextPage) {
                await this.navigateToNextPage(tabId, settings);
            }
        }
    }
    
    async processImages(images, settings) {
        const batchSize = CONFIG.BATCH_SIZE;
        
        for (let i = 0; i < images.length; i += batchSize) {
            const batch = images.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (image) => {
                try {
                    const filename = this.generateFilename(image, settings);
                    await downloadManager.queueDownload(image.url, filename, settings);
                    
                    await stateManager.addCollectedItem({
                        url: image.url,
                        filename,
                        title: image.title || '',
                        timestamp: Date.now()
                    });
                    
                    await stateManager.update(state => {
                        state.downloadedImages++;
                    });
                } catch (error) {
                    await stateManager.addFailedItem(image, error);
                }
            }));
            
            // Small delay between batches to prevent overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    generateFilename(image, settings) {
        const url = new URL(image.url);
        const extension = url.pathname.split('.').pop() || 'jpg';
        const name = image.title || 'image';
        const num = stateManager.getState().fileCounter;
        
        let filename = settings.filenamePattern
            .replace('*name*', name.replace(/[^a-zA-Z0-9]/g, '_'))
            .replace('*num*', num.toString().padStart(4, '0'))
            .replace('*ext*', extension);
        
        if (settings.downloadFolder) {
            filename = `${settings.downloadFolder}/${filename}`;
        }
        
        return filename;
    }
    
    async waitForPageLoad(tabId, timeout) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(false), timeout);
            
            chrome.tabs.sendMessage(tabId, { action: 'waitForPageLoad' }, (response) => {
                clearTimeout(timer);
                resolve(true);
            });
        });
    }
    
    async checkForNextPage(tabId, settings) {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (nextPageSelector) => {
                const nextButton = document.querySelector(nextPageSelector);
                return nextButton && nextButton.offsetParent !== null;
            },
            args: [settings.nextPageSelector]
        });
        
        return results[0].result;
    }
    
    async navigateToNextPage(tabId, settings) {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (nextPageSelector) => {
                const nextButton = document.querySelector(nextPageSelector);
                if (nextButton) {
                    nextButton.click();
                }
            },
            args: [settings.nextPageSelector]
        });
        
        await stateManager.update(state => {
            state.currentPage++;
        });
        
        // Continue scraping
        setTimeout(() => {
            const state = stateManager.getState();
            if (state.isActive && !state.isPaused) {
                this.scrapePage(tabId, state.originalTabUrl, state.settings);
            }
        }, settings.pageWait * 1000);
    }
    
    async generateCSV(items) {
        const headers = ['URL', 'Filename', 'Title', 'Timestamp'];
        const rows = items.map(item => [
            item.url,
            item.filename,
            item.title,
            new Date(item.timestamp).toISOString()
        ]);
        
        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
        
        return csv;
    }
    
    async generateXLSX(items) {
        // Simplified XLSX generation - in production, use a proper library
        const csv = await this.generateCSV(items);
        return csv; // For now, return CSV format
    }
}

// Global instances
const stateManager = new ScrapingStateManager();
const downloadManager = new DownloadManager();
const messageHandler = new MessageHandler();
let activeConnections = new Set();

// Connection management
chrome.runtime.onConnect.addListener((port) => {
    activeConnections.add(port);
    
    port.onDisconnect.addListener(() => {
        activeConnections.delete(port);
    });
    
    port.onMessage.addListener(async (message) => {
        try {
            const response = await messageHandler.handleMessage(message);
            port.postMessage({ success: true, data: response });
        } catch (error) {
            port.postMessage({ success: false, error: error.message });
        }
    });
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    messageHandler.handleMessage(message, sender)
        .then(response => sendResponse({ success: true, data: response }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
});

// State update broadcasting
function sendStateUpdate() {
    const state = stateManager.getState();
    activeConnections.forEach(port => {
        try {
            port.postMessage({
                action: 'stateUpdate',
                data: state
            });
        } catch (error) {
            console.error('Failed to send state update:', error);
            activeConnections.delete(port);
        }
    });
}

// Subscribe to state changes
stateManager.subscribe(() => {
    sendStateUpdate();
});

// Service worker lifecycle management
chrome.runtime.onStartup.addListener(() => {
    stateManager.addLog('info', 'Service worker started');
});

chrome.runtime.onInstalled.addListener((details) => {
    stateManager.addLog('info', `Extension ${details.reason}: version ${chrome.runtime.getManifest().version}`);
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    try {
        console.log('Extension icon clicked for tab:', tab);
        
        // Store the current tab as the target for scraping
        if (tab && tab.id && tab.url) {
            await stateManager.update(state => {
                state.originalTabId = tab.id;
                state.originalTabUrl = tab.url;
            });
            
            await stateManager.addLog('info', `Target tab set: ${tab.url}`);
            
            // Inject content script into target tab if needed
            try {
                await messageHandler.injectContentScript(tab.id);
                await stateManager.addLog('info', `Connected to tab: ${tab.url}`);
            } catch (error) {
                console.warn('Could not inject content script:', error);
                await stateManager.addLog('warning', 'Content script injection failed - some features may not work');
            }
        }
        
        // Open dashboard window
        const dashboardUrl = chrome.runtime.getURL('dashboard.html');
        console.log('Opening dashboard at:', dashboardUrl);
        
        const window = await chrome.windows.create({
            url: dashboardUrl,
            type: 'popup',
            width: 1200,
            height: 800
        });
        
        console.log('Dashboard window created:', window.id);
        await stateManager.addLog('info', 'Dashboard opened');
        
    } catch (error) {
        console.error('Error in icon click handler:', error);
        await stateManager.addLog('error', `Icon click handler failed: ${error.message}`);
    }
});

// Keep-alive mechanism for long-running operations
let keepAliveInterval;

function startKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }
    
    keepAliveInterval = setInterval(() => {
        const state = stateManager.getState();
        if (state.isActive) {
            stateManager.update(state => {
                state.lastActivity = Date.now();
            });
        }
    }, CONFIG.KEEP_ALIVE_INTERVAL);
}

function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

// Cleanup on service worker termination
self.addEventListener('beforeunload', () => {
    stopKeepAlive();
});

// Periodic cleanup
setInterval(() => {
    const state = stateManager.getState();
    if (state.collectedItems.length > CONFIG.MAX_STORED_ITEMS ||
        state.logs.length > CONFIG.MAX_LOG_ENTRIES ||
        state.failedItems.length > CONFIG.MAX_FAILED_ITEMS) {
        stateManager.cleanupIfNeeded();
    }
}, CONFIG.CLEANUP_INTERVAL);