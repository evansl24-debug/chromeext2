// Enhanced error handling for content script
function handleScrapingError(message) {
    try {
        chrome.runtime.sendMessage({
            action: 'contentScriptError',
            error: message,
            timestamp: Date.now(),
            url: window.location.href
        });
    } catch (error) {
        console.error('Failed to send error to background:', error);
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    log('Global error in content script:', event.error);
    handleScrapingError(`Global error: ${event.error.message}`);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    log('Unhandled promise rejection in content script:', event.reason);
    handleScrapingError(`Unhandled promise rejection: ${event.reason}`);
});

// STEPTWO Gallery Scraper - Content Script
// Critical fixes for memory leaks, security, and reliability

// Set DEBUG to false for production
const CONTENT_DEBUG = false;

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