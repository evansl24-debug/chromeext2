// Enhanced error handling for content script
function handleScrapingError(input) {
    try {
        const payload = typeof input === 'string' ? { error: input } : (input || {});
        chrome.runtime.sendMessage({
            action: 'contentScriptError',
            error: payload.error || 'Unknown error',
            timestamp: payload.timestamp || Date.now(),
            url: payload.url || window.location.href,
            filename: payload.filename || undefined,
            lineno: payload.lineno || undefined,
            type: payload.type || 'error'
        });
    } catch (error) {
        console.error('Failed to send error to background:', error);
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    try {
        const filename = event && event.filename;
        // Ignore page-origin errors; report only extension-related ones
        if (filename && !String(filename).startsWith('chrome-extension://')) return;
        const message = (event && event.error && event.error.message) || event.message || 'Unknown error';
        log('Global error in content script:', message);
        // Avoid overly noisy reporting in production
        if (CONTENT_DEBUG) {
            handleScrapingError({ error: `Global error: ${message}` , filename, lineno: event && event.lineno, type: 'error' });
        }
    } catch (e) {
        // swallow
    }
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    try {
        const reason = (event && event.reason && (event.reason.message || String(event.reason))) || 'Unknown rejection';
        log('Unhandled promise rejection in content script:', reason);
        if (CONTENT_DEBUG) {
            handleScrapingError({ error: `Unhandled promise rejection: ${reason}`, type: 'unhandledrejection' });
        }
    } catch (e) {
        // swallow
    }
});

// STEPTWO Gallery Scraper - Content Script
// Critical fixes for memory leaks, security, and reliability

// Set DEBUG to false for production
if (!window.__STEPTWO_CONTENT_DEFINED__) {
    window.__STEPTWO_CONTENT_DEFINED__ = true;
    var CONTENT_DEBUG = false;
}

// Logging function with debug control
function log(...args) {
    if (CONTENT_DEBUG) {
        console.log('STEPTWO Content:', ...args);
    }
}

// Memory management constants
const MAX_EXECUTION_TIME = 30000; // 30 seconds timeout
const MAX_SELECTOR_ATTEMPTS = 10;

// Enhanced memory management for content script
class MemoryManager {
    constructor() {
        this.eventListeners = new Map(); // Map of element -> Set of listeners
        this.timers = new Set(); // Track all timers
        this.observers = new Set(); // Track all observers
        this.intervals = new Set(); // Track all intervals
        this.timeouts = new Set(); // Track all timeouts
        this.references = new WeakMap(); // Weak references to DOM elements
        this.cleanupCallbacks = new Set(); // Custom cleanup callbacks
    }
    
    addEventListener(element, event, handler, options = {}) {
        // Create bound handler for easier removal
        const boundHandler = handler.bind(this);
        
        // Store listener info
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, new Set());
        }
        
        const listenerInfo = {
            event,
            handler: boundHandler,
            originalHandler: handler,
            options,
            element
        };
        
        this.eventListeners.get(element).add(listenerInfo);
        
        // Add the actual listener
        element.addEventListener(event, boundHandler, options);
        
        return boundHandler;
    }
    
    removeEventListener(element, event, handler) {
        if (!this.eventListeners.has(element)) return;
        
        const listeners = this.eventListeners.get(element);
        const listenerToRemove = Array.from(listeners).find(
            l => l.event === event && (l.handler === handler || l.originalHandler === handler)
        );
        
        if (listenerToRemove) {
            element.removeEventListener(event, listenerToRemove.handler, listenerToRemove.options);
            listeners.delete(listenerToRemove);
            
            if (listeners.size === 0) {
                this.eventListeners.delete(element);
            }
        }
    }
    
    createObserver(observerClass, callback, options = {}) {
        const observer = new observerClass(callback, options);
        this.observers.add(observer);
        return observer;
    }
    
    setTimeout(callback, delay) {
        const timeoutId = setTimeout(() => {
            this.timeouts.delete(timeoutId);
            callback();
        }, delay);
        this.timeouts.add(timeoutId);
        return timeoutId;
    }
    
    setInterval(callback, delay) {
        const intervalId = setInterval(callback, delay);
        this.intervals.add(intervalId);
        return intervalId;
    }
    
    clearTimeout(timeoutId) {
        if (this.timeouts.has(timeoutId)) {
            clearTimeout(timeoutId);
            this.timeouts.delete(timeoutId);
        }
    }
    
    clearInterval(intervalId) {
        if (this.intervals.has(intervalId)) {
            clearInterval(intervalId);
            this.intervals.delete(intervalId);
        }
    }
    
    addCleanupCallback(callback) {
        this.cleanupCallbacks.add(callback);
    }
    
    removeCleanupCallback(callback) {
        this.cleanupCallbacks.delete(callback);
    }
    
    cleanupAll() {
        // Clean up all event listeners
        for (const [element, listeners] of this.eventListeners) {
            for (const listener of listeners) {
                try {
                    element.removeEventListener(listener.event, listener.handler, listener.options);
                } catch (error) {
                    console.warn('Error removing event listener:', error);
                }
            }
        }
        this.eventListeners.clear();
        
        // Clean up all observers
        for (const observer of this.observers) {
            try {
                observer.disconnect();
            } catch (error) {
                console.warn('Error disconnecting observer:', error);
            }
        }
        this.observers.clear();
        
        // Clean up all timers
        for (const timeoutId of this.timeouts) {
            try {
                clearTimeout(timeoutId);
            } catch (error) {
                console.warn('Error clearing timeout:', error);
            }
        }
        this.timeouts.clear();
        
        for (const intervalId of this.intervals) {
            try {
                clearInterval(intervalId);
            } catch (error) {
                console.warn('Error clearing interval:', error);
            }
        }
        this.intervals.clear();
        
        // Execute custom cleanup callbacks
        for (const callback of this.cleanupCallbacks) {
            try {
                callback();
            } catch (error) {
                console.warn('Error in cleanup callback:', error);
            }
        }
        this.cleanupCallbacks.clear();
        
        log('Memory cleanup completed');
    }
    
    getMemoryUsage() {
        return {
            eventListeners: this.eventListeners.size,
            observers: this.observers.size,
            timeouts: this.timeouts.size,
            intervals: this.intervals.size,
            cleanupCallbacks: this.cleanupCallbacks.size
        };
    }
}

// Global state for content script with proper memory management
let isActive = false;
let currentSelectors = null;
let overlayManager = null;
let selectorTool = null;
let mutationObserver = null;
const memoryManager = new MemoryManager();

// Safe execution wrapper with timeout
function safeContentExecute(fn, context = 'content') {
    return async (...args) => {
        const startTime = Date.now();
        
        try {
            const result = await Promise.race([
                fn(...args),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Execution timeout')), MAX_EXECUTION_TIME)
                )
            ]);
            
            const executionTime = Date.now() - startTime;
            if (executionTime > 5000) {
                log(`Slow execution in ${context}: ${executionTime}ms`);
            }
            
            return result;
        } catch (error) {
            log(`Error in ${context}:`, error);
            throw error;
        }
    };
}

// Initialize
log('Content script loaded');

// Robust image extraction helpers and message handling

// Parse a srcset string and return the best candidate (largest width or density)
function pickBestFromSrcset(srcset) {
    if (!srcset || typeof srcset !== 'string') return null;
    const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
    let bestUrl = null;
    let bestScore = -1;
    for (const part of parts) {
        const [url, descriptor] = part.split(/\s+/);
        if (!url) continue;
        if (!descriptor) {
            bestUrl = url;
            continue;
        }
        const widthMatch = descriptor.match(/^(\d+)w$/);
        const densityMatch = descriptor.match(/^([\d.]+)x$/);
        let score = -1;
        if (widthMatch) {
            score = parseInt(widthMatch[1], 10);
        } else if (densityMatch) {
            score = parseFloat(densityMatch[1]);
        }
        if (score > bestScore) {
            bestScore = score;
            bestUrl = url;
        }
    }
    return bestUrl;
}

// Extract a usable image URL from a DOM element
function getImageUrlFromElement(element) {
    if (!element) return null;
    try {
        const tagName = element.tagName ? element.tagName.toLowerCase() : '';

        // IMG element handling
        if (tagName === 'img') {
            if (element.currentSrc && !String(element.currentSrc).startsWith('data:')) return element.currentSrc;
            if (element.src && !String(element.src).startsWith('data:')) return element.src;

            const lazyAttrs = [
                'data-src','data-original','data-lazy','data-file','data-large_image',
                'data-original-src','data-thumb','data-image','data-lazy-src','data-ll-src',
                'data-hires','data-zoom','data-large','data-url'
            ];
            for (const attr of lazyAttrs) {
                const val = element.getAttribute(attr);
                if (val && !String(val).startsWith('data:')) return val;
            }

            const dataSrcset = element.getAttribute('data-srcset');
            if (dataSrcset) {
                const best = pickBestFromSrcset(dataSrcset);
                if (best) return best;
            }

            const srcset = element.getAttribute('srcset');
            if (srcset) {
                const best = pickBestFromSrcset(srcset);
                if (best) return best;
            }
        }

        // SOURCE inside PICTURE
        if (tagName === 'source') {
            const dss = element.getAttribute('data-srcset');
            if (dss) {
                const best = pickBestFromSrcset(dss);
                if (best) return best;
            }
            const ds = element.getAttribute('data-src');
            if (ds) return ds;
            const ss = element.getAttribute('srcset');
            if (ss) {
                const best = pickBestFromSrcset(ss);
                if (best) return best;
            }
            if (element.src && !String(element.src).startsWith('data:')) return element.src;
        }

        // Child IMG or SOURCE
        if (element.querySelector) {
            const child = element.querySelector('img, picture img, source');
            if (child) {
                const url = getImageUrlFromElement(child);
                if (url) return url;
            }
        }

        // CSS background-image (computed style and inline style)
        const style = window.getComputedStyle(element);
        if (style && style.backgroundImage && style.backgroundImage !== 'none') {
            const match = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
            if (match && match[1]) return match[1];
        }
        // Pseudo elements
        try {
            const beforeStyle = window.getComputedStyle(element, '::before');
            if (beforeStyle && beforeStyle.backgroundImage && beforeStyle.backgroundImage !== 'none') {
                const m = beforeStyle.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
                if (m && m[1]) return m[1];
            }
            const afterStyle = window.getComputedStyle(element, '::after');
            if (afterStyle && afterStyle.backgroundImage && afterStyle.backgroundImage !== 'none') {
                const m = afterStyle.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
                if (m && m[1]) return m[1];
            }
        } catch (e) {}
        const inline = element.getAttribute && element.getAttribute('style');
        if (inline && inline.includes('background-image')) {
            const match = inline.match(/url\(["']?(.*?)["']?\)/);
            if (match && match[1]) return match[1];
        }

        // Any data-* that looks like a URL
        if (element.attributes) {
            for (const attr of element.attributes) {
                if (!attr.name.startsWith('data-')) continue;
                const v = attr.value;
                if (v && (v.startsWith('http') || v.startsWith('//') || v.startsWith('/'))) return v;
            }
        }
    } catch (error) {
        log('getImageUrlFromElement error:', error);
    }
    return null;
}

// Query elements across Shadow DOM
function queryAllWithShadowRoots(root, selector) {
    const results = [];
    const start = root || document;
    try {
        if (start.querySelectorAll) {
            start.querySelectorAll(selector).forEach(el => results.push(el));
        }
    } catch (e) {
        // ignore invalid selector errors on certain roots
    }

    const walker = document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT, null);
    let node = walker.nextNode();
    while (node) {
        if (node.shadowRoot) {
            try {
                node.shadowRoot.querySelectorAll(selector).forEach(el => results.push(el));
            } catch (e) {}
        }
        node = walker.nextNode();
    }
    return results;
}

// Collect image-like URLs from <noscript>, <meta>, and <link rel="preload">
function collectHeadAndNoscriptImages() {
    const urls = [];
    try {
        // Meta OpenGraph/Twitter
        document.querySelectorAll('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]').forEach(m => {
            const c = m.getAttribute('content');
            if (c) urls.push(c);
        });
        // Preloads
        document.querySelectorAll('link[rel~="preload"][as="image"][href], link[rel~="preload"][imagesrcset], link[as="image"][href]').forEach(l => {
            const href = l.getAttribute('href');
            const srcset = l.getAttribute('imagesrcset');
            if (srcset) {
                const best = pickBestFromSrcset(srcset);
                if (best) urls.push(best);
            } else if (href) {
                urls.push(href);
            }
        });
        // <noscript>
        document.querySelectorAll('noscript').forEach(ns => {
            try {
                const html = ns.textContent || ns.innerHTML;
                if (!html) return;
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                tmp.querySelectorAll('img, source').forEach(el => {
                    const u = getImageUrlFromElement(el);
                    if (u) urls.push(u);
                });
            } catch (e) {}
        });
    } catch (e) {}
    return urls;
}

// Collect image URLs observed in Performance entries (network-level)
function collectNetworkImageUrls() {
    const urls = [];
    try {
        const entries = performance.getEntriesByType && performance.getEntriesByType('resource');
        const imageExt = /\.(?:jpe?g|png|gif|webp|bmp|svg|avif|tiff?)(?:$|[?#])/i;
        if (entries && entries.length) {
            for (const e of entries) {
                const name = e && e.name;
                if (!name || typeof name !== 'string') continue;
                // Prefer entries likely to be images
                const it = (e.initiatorType || '').toLowerCase();
                if (it === 'img' || it === 'image' || it === 'css' || it === 'link') {
                    if (imageExt.test(name)) urls.push(name);
                } else if (imageExt.test(name)) {
                    urls.push(name);
                }
            }
        }
    } catch (e) {}
    return urls;
}

function isLikelyValidImage(element, url) {
    try {
        // Basic URL-based exclusions for common non-photo assets
        const lower = (url || '').toLowerCase();
        const excludedSubstrings = ['sprite', 'favicon', '/icons/', '/icon/', '/logo', 'data:image/svg', '.svg'];
        if (excludedSubstrings.some(s => lower.includes(s))) return false;

        // Dimension-based filtering
        const rect = element && element.getBoundingClientRect ? element.getBoundingClientRect() : { width: 0, height: 0 };
        const approxWidth = Math.round(rect.width || 0);
        const approxHeight = Math.round(rect.height || 0);

        // Natural sizes for <img>
        let naturalW = element && element.naturalWidth ? element.naturalWidth : 0;
        let naturalH = element && element.naturalHeight ? element.naturalHeight : 0;

        // Use the best available measurement
        const width = Math.max(naturalW || 0, approxWidth || 0);
        const height = Math.max(naturalH || 0, approxHeight || 0);

        // Generic minimum thresholds to avoid icons
        const MIN_SIZE = 80; // px
        if (width && height && (width < MIN_SIZE || height < MIN_SIZE)) return false;

        // Aspect ratio sanity: allow most photos; skip extremely thin assets
        if (width > 0 && height > 0) {
            const ratio = width > height ? width / height : height / width;
            if (ratio > 8) return false; // extremely long banners/sprites
        }

        return true;
    } catch (e) {
        return true;
    }
}

// Wait until at least one real image candidate appears or timeout
function waitForImages(timeoutMs, imageSelector) {
    const timeout = typeof timeoutMs === 'number' ? timeoutMs : 5000;
    const selector = imageSelector || 'img, picture img, [data-src], [data-srcset], [style*="background-image"]';
    return new Promise(resolve => {
        const checkNow = () => {
            const candidates = queryAllWithShadowRoots(document, selector);
            return candidates.some(el => !!getImageUrlFromElement(el));
        };
        if (checkNow()) return resolve(true);
        const observer = memoryManager.createObserver(MutationObserver, () => {
            if (checkNow()) {
                try { observer.disconnect(); } catch (e) {}
                memoryManager.observers.delete(observer);
                resolve(true);
            }
        });
        observer.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true });
        memoryManager.setTimeout(() => {
            try { observer.disconnect(); } catch (e) {}
            memoryManager.observers.delete(observer);
            resolve(false);
        }, timeout);
    });
}

async function extractImagesInternal(settings = {}) {
    const robustDefaultSelector = 'img, picture img, [data-src], [data-srcset], [style*="background-image"]';
    const containerSelector = settings.containerSelector || (settings.selectors && settings.selectors.container) || '';
    const imageSelector = settings.imageSelector || (settings.selectors && settings.selectors.image) || robustDefaultSelector;
    const waitTimeout = (settings.imageWait && Number.isFinite(settings.imageWait)) ? settings.imageWait : 5000;
    const maxImages = Number.isFinite(settings.maxImages) ? settings.maxImages : 1000;

    await waitForImages(waitTimeout, imageSelector);

    let nodes = [];
    if (containerSelector) {
        const containers = queryAllWithShadowRoots(document, containerSelector);
        for (const container of containers) {
            try {
                container.querySelectorAll(imageSelector).forEach(el => nodes.push(el));
            } catch (e) {}
        }
    } else {
        nodes = queryAllWithShadowRoots(document, imageSelector);
    }

    const seen = new Set();
    const images = [];
    for (const el of nodes) {
        const urlRaw = getImageUrlFromElement(el);
        if (!urlRaw) continue;
        let url = urlRaw.startsWith('//') ? window.location.protocol + urlRaw : urlRaw;
        if (!/^https?:/i.test(url)) {
            try { url = new URL(url, window.location.href).toString(); } catch (e) { continue; }
        }
        if (url.startsWith('data:')) continue;
        if (!isLikelyValidImage(el, url)) continue;
        if (seen.has(url)) continue;
        seen.add(url);

        const item = {
            url,
            alt: el.getAttribute && (el.getAttribute('alt') || '') || '',
            width: el.naturalWidth || el.width || null,
            height: el.naturalHeight || el.height || null,
            tag: el.tagName ? el.tagName.toLowerCase() : undefined
        };
        images.push(item);
        if (images.length >= maxImages) break;
    }

    // Supplement from head/noscript
    if (images.length < maxImages) {
        const extras = collectHeadAndNoscriptImages();
        for (const raw of extras) {
            let url = raw.startsWith('//') ? window.location.protocol + raw : raw;
            try { url = new URL(url, window.location.href).toString(); } catch (e) { continue; }
            if (url.startsWith('data:')) continue;
            // No element to size-check; allow only non-obvious sprite/icon names
            const lower = url.toLowerCase();
            if (['sprite', 'favicon', '/icons/', '/icon/', '/logo', '.svg'].some(s => lower.includes(s))) continue;
            if (seen.has(url)) continue;
            seen.add(url);
            images.push({ url });
            if (images.length >= maxImages) break;
        }
    }

    // Supplement from network performance entries
    if (images.length < maxImages) {
        const extras = collectNetworkImageUrls();
        for (const raw of extras) {
            let url = raw.startsWith('//') ? window.location.protocol + raw : raw;
            try { url = new URL(url, window.location.href).toString(); } catch (e) { continue; }
            if (url.startsWith('data:')) continue;
            const lower = url.toLowerCase();
            if (['sprite', 'favicon', '/icons/', '/icon/', '/logo', '.svg'].some(s => lower.includes(s))) continue;
            if (seen.has(url)) continue;
            seen.add(url);
            images.push({ url });
            if (images.length >= maxImages) break;
        }
    }

    return { images };
}

// Expose as global and wrap with safe execution
window.extractImagesFromPage = safeContentExecute(extractImagesInternal, 'extractImagesFromPage');

// Test selector utility for debugging via dashboard
function testSelectorsInternal(data) {
    const containerSelector = data && (data.container || data.containerSelector) || '';
    const imageSelector = data && (data.image || data.imageSelector) || 'img, picture img, [data-src], [data-srcset], [style*="background-image"]';
    let scopeElements = [];
    if (containerSelector) {
        scopeElements = queryAllWithShadowRoots(document, containerSelector);
    } else {
        scopeElements = [document];
    }
    let matches = [];
    for (const scope of scopeElements) {
        try {
            scope.querySelectorAll(imageSelector).forEach(el => matches.push(el));
        } catch (e) {}
    }
    const sample = matches.slice(0, 10).map(el => ({
        url: getImageUrlFromElement(el),
        tag: el.tagName ? el.tagName.toLowerCase() : '',
        hasBg: !!(el.getAttribute && el.getAttribute('style') && el.getAttribute('style').includes('background-image'))
    }));
    return { count: matches.length, sample };
}

// Message handling from background/dashboard
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (!message || !message.action) return;
        if (message.action === 'waitForPageLoad') {
            const respond = () => sendResponse({ ready: true });
            if (document.readyState === 'complete') {
                respond();
            } else {
                window.addEventListener('load', () => respond(), { once: true });
            }
            return true;
        }
        if (message.action === 'testSelectors') {
            try {
                const result = testSelectorsInternal(message.data || {});
                sendResponse({ success: true, message: `Matched ${result.count} elements`, data: result });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
            return true;
        }
        if (message.action === 'extractImagesFromContainer') {
            (async () => {
                try {
                    const data = message.data || {};
                    const container = data.container || data.containerSelector || '';
                    const result = await extractImagesInternal({ containerSelector: container });
                    sendResponse({ success: true, data: result });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        }
        if (message.action === 'extractImagesNow') {
            (async () => {
                try {
                    const result = await extractImagesInternal(message.data || {});
                    sendResponse({ success: true, data: result });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        }
        if (message.action === 'startContainerSelection') {
            // Minimal stub to acknowledge command (full UI selection not implemented here)
            sendResponse({ success: true });
            return true;
        }
        if (message.action === 'startNextPageTargeting') {
            sendResponse({ success: true });
            return true;
        }
    } catch (error) {
        try { sendResponse({ success: false, error: error.message }); } catch (e) {}
        return true;
    }
});