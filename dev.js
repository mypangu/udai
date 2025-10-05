// enhanced-dev-protection.js - Advanced Developer Tools Protection
// Fixes: Better initial detection + Network request interception

class EnhancedDevToolsProtection {
  constructor() {
    this.isDevToolsOpen = false;
    this.protectionActive = false;
    this.warningShown = false;
    this.networkRequests = new Map();
    this.originalFetch = null;
    this.originalXHR = null;
    
    // CRITICAL: Initialize protection before anything else
    this.interceptNetworkRequests();
    this.initImmediateDetection();
  }

  // Intercept network requests BEFORE dev tools detection
  interceptNetworkRequests() {
    // Store original functions
    this.originalFetch = window.fetch;
    this.originalXHR = window.XMLHttpRequest.prototype.open;
    
    const self = this;
    
    // Override fetch
    window.fetch = function(...args) {
      if (self.isDevToolsOpen) {
        // Block or modify request when dev tools are open
        console.log('🚫 Network request blocked');
        
        // Return fake successful response
        return Promise.resolve(new Response(
          JSON.stringify({ error: 'Access denied - Close developer tools' }),
          { 
            status: 403,
            statusText: 'Forbidden',
            headers: { 'Content-Type': 'application/json' }
          }
        ));
      }
      
      // Store request info for monitoring
      const url = args[0];
      self.networkRequests.set(Date.now(), url);
      
      return self.originalFetch.apply(this, args);
    };
    
    // Override XMLHttpRequest
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      if (self.isDevToolsOpen) {
        console.log('🚫 XHR request blocked');
        // Block the request by not calling original open
        return;
      }
      
      // Store request info
      self.networkRequests.set(Date.now(), url);
      
      return self.originalXHR.apply(this, [method, url, ...args]);
    };
  }

  initImmediateDetection() {
    // Multiple detection methods running immediately
    this.detectDevToolsMultipleMethods();
    
    // Set up all event listeners
    this.disableAllDevToolsAccess();
    
    // Start aggressive continuous monitoring
    this.startAggressiveDetection();
    
    // Setup when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupAdvancedProtection();
      });
    } else {
      this.setupAdvancedProtection();
    }
  }

  // Enhanced detection for already-open dev tools
  detectDevToolsMultipleMethods() {
    let detectionCount = 0;
    
    // Method 1: Console API detection (most reliable)
    try {
      const element = new Image();
      let consoleOpen = false;
      
      Object.defineProperty(element, 'id', {
        get: function() {
          consoleOpen = true;
          throw new Error('Dev tools detected');
        }
      });
      
      console.log('%c ', element);
      
      if (consoleOpen) {
        detectionCount++;
      }
    } catch (e) {
      detectionCount++;
    }

    // Method 2: Window size analysis (improved thresholds)
    const heightThreshold = Math.min(window.screen.height * 0.3, 200);
    const widthThreshold = Math.min(window.screen.width * 0.3, 200);
    
    const heightDiff = window.outerHeight - window.innerHeight;
    const widthDiff = window.outerWidth - window.innerWidth;
    
    if (heightDiff > heightThreshold || widthDiff > widthThreshold) {
      detectionCount++;
    }

    // Method 3: Debugger timing with multiple attempts
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      debugger;
      const end = performance.now();
      
      if (end - start > 50) {
        detectionCount++;
        break;
      }
    }

    // Method 4: DevTools-specific globals detection
    const devToolsGlobals = ['$', '$$', '$x', 'inspect', 'monitor', 'debug', 'console', '$0'];
    const detectedGlobals = devToolsGlobals.filter(varName => {
      try {
        return window[varName] && typeof window[varName] === 'function' && 
               window[varName].toString().includes('[native code]');
      } catch (e) {
        return false;
      }
    });
    
    if (detectedGlobals.length > 3) {
      detectionCount++;
    }

    // Method 5: CSS media query detection
    try {
      const mediaQuery = window.matchMedia('(max-device-width: 1200px) and (orientation: landscape)');
      if (window.innerWidth < window.outerWidth * 0.7 || 
          window.innerHeight < window.outerHeight * 0.7) {
        detectionCount++;
      }
    } catch (e) {
      // Ignore
    }

    // Method 6: Performance API detection
    try {
      const perfEntries = performance.getEntriesByType('navigation');
      if (perfEntries.length > 0 && perfEntries[0].loadEventEnd - perfEntries[0].fetchStart > 2000) {
        // Slow load might indicate dev tools inspection
        detectionCount++;
      }
    } catch (e) {
      // Ignore
    }

    // If 2 or more methods detect dev tools, consider them open
    if (detectionCount >= 2) {
      console.log(`🚨 Dev tools detected by ${detectionCount} methods`);
      this.handleDevToolsDetected();
    }
  }

  // Block ALL access methods
  disableAllDevToolsAccess() {
    // Enhanced keyboard blocking
    const blockKeyEvent = (e) => {
      let blocked = false;
      
      // All F-keys that could be problematic
      if (['F12', 'F1', 'F3', 'F7', 'F8', 'F9', 'F10', 'F11'].includes(e.key)) {
        blocked = true;
      }
      
      // Chrome shortcuts
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(e.key)) {
        blocked = true;
      }
      
      // View source
      if (e.ctrlKey && e.key.toLowerCase() === 'u') {
        blocked = true;
      }
      
      // Safari/Mac shortcuts
      if (e.metaKey && e.altKey && ['I', 'C'].includes(e.key)) {
        blocked = true;
      }
      
      // Additional Firefox shortcuts
      if (e.ctrlKey && e.shiftKey && ['E', 'S', 'M', 'Q'].includes(e.key)) {
        blocked = true;
      }

      // Ctrl+A (Select All) when protection is active
      if (this.protectionActive && e.ctrlKey && e.key.toLowerCase() === 'a') {
        blocked = true;
      }

      if (blocked) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.handleDevToolsDetected();
        return false;
      }
    };

    // Add to both capture and bubble phases
    document.addEventListener('keydown', blockKeyEvent, true);
    document.addEventListener('keyup', blockKeyEvent, true);
    window.addEventListener('keydown', blockKeyEvent, true);
    window.addEventListener('keyup', blockKeyEvent, true);

    // Block context menu completely
    const blockContext = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.handleDevToolsDetected();
      return false;
    };

    document.addEventListener('contextmenu', blockContext, true);
    window.addEventListener('contextmenu', blockContext, true);
    document.body.addEventListener('contextmenu', blockContext, true);

    // Block all mouse interactions that could trigger inspection
    document.addEventListener('mousedown', (e) => {
      // Block middle click and right click
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.handleDevToolsDetected();
        return false;
      }
      
      // Block Ctrl+Click (inspect element)
      if (e.ctrlKey && e.button === 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.handleDevToolsDetected();
        return false;
      }
    }, true);
  }

  // More aggressive continuous detection
  startAggressiveDetection() {
    // High-frequency detection
    setInterval(() => this.detectByMultipleMethods(), 200);
    
    // Window resize detection
    window.addEventListener('resize', () => {
      setTimeout(() => this.detectByWindowSize(), 100);
    });
    
    // Focus/blur detection (dev tools opening/closing)
    window.addEventListener('blur', () => {
      setTimeout(() => this.detectDevToolsMultipleMethods(), 300);
    });
    
    window.addEventListener('focus', () => {
      setTimeout(() => this.detectDevToolsMultipleMethods(), 300);
    });

    // Visibility change detection
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(() => this.detectDevToolsMultipleMethods(), 500);
      }
    });
  }

  detectByMultipleMethods() {
    // Rapid console detection
    this.detectByConsoleImproved();
    
    // Window size detection
    this.detectByWindowSize();
    
    // Element inspection detection
    this.detectByElementManipulation();
  }

  detectByConsoleImproved() {
    try {
      // Create multiple console detectors
      const detectors = [];
      let detected = false;
      
      for (let i = 0; i < 3; i++) {
        const detector = {
          toString: function() {
            detected = true;
            return '';
          },
          valueOf: function() {
            detected = true;
            return '';
          }
        };
        detectors.push(detector);
        console.log('%c', detector);
      }
      
      if (detected && !this.isDevToolsOpen) {
        this.handleDevToolsDetected();
      }
    } catch (e) {
      // Console access might be blocked, which is also suspicious
      if (!this.isDevToolsOpen) {
        this.handleDevToolsDetected();
      }
    }
  }

  detectByWindowSize() {
    // More intelligent window size detection
    const screenHeight = window.screen.height;
    const screenWidth = window.screen.width;
    
    // Calculate ratios instead of fixed thresholds
    const heightRatio = window.innerHeight / screenHeight;
    const widthRatio = window.innerWidth / screenWidth;
    
    // Only consider dev tools open if window is significantly smaller than screen
    // AND there's a large toolbar/panel difference
    const heightDiff = window.outerHeight - window.innerHeight;
    const widthDiff = window.outerWidth - window.innerWidth;
    
    const suspiciousSize = (heightRatio < 0.7 && heightDiff > 200) || 
                          (widthRatio < 0.7 && widthDiff > 250) ||
                          (heightDiff > 300 || widthDiff > 400);
    
    if (suspiciousSize && !this.isDevToolsOpen) {
      // Double-check with another method before triggering
      setTimeout(() => {
        this.detectByConsoleImproved();
      }, 200);
    } else if (this.isDevToolsOpen && heightRatio > 0.85 && widthRatio > 0.85 && 
               heightDiff < 150 && widthDiff < 150) {
      this.checkIfReallyClosed();
    }
  }

  detectByElementManipulation() {
    // Create hidden element to detect inspection
    const detector = document.createElement('div');
    detector.id = 'devtools-detector-' + Date.now();
    detector.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
    
    // Add to document
    document.body.appendChild(detector);
    
    // Check if element is being inspected
    setTimeout(() => {
      try {
        const computed = window.getComputedStyle(detector);
        // If someone is inspecting, computed style access might be different
        if (computed.getPropertyValue('position') !== 'absolute') {
          this.handleDevToolsDetected();
        }
      } catch (e) {
        this.handleDevToolsDetected();
      }
      
      // Clean up
      if (detector.parentNode) {
        detector.remove();
      }
    }, 100);
  }

  checkIfReallyClosed() {
    // Multiple verification methods
    setTimeout(() => {
      let closedCount = 0;
      
      // Check window size
      const heightDiff = window.outerHeight - window.innerHeight;
      const widthDiff = window.outerWidth - window.innerWidth;
      if (heightDiff < 100 && widthDiff < 100) closedCount++;
      
      // Check console access
      try {
        let consoleAccessed = false;
        const testObj = { toString: () => { consoleAccessed = true; return ''; } };
        console.log('%c', testObj);
        if (!consoleAccessed) closedCount++;
      } catch (e) {
        closedCount++;
      }
      
      // Check debugger timing
      const start = performance.now();
      debugger;
      const end = performance.now();
      if (end - start < 50) closedCount++;
      
      // If 2+ methods confirm closure, deactivate
      if (closedCount >= 2) {
        this.deactivateProtection();
      }
    }, 1000);
  }

  // Enhanced network request blocking
  blockNetworkRequests() {
    if (!this.isDevToolsOpen) return;
    
    // Block new requests
    window.fetch = function(...args) {
      console.log('🚫 Fetch request blocked - Dev tools detected');
      return Promise.reject(new Error('Network access blocked - Close developer tools'));
    };
    
    // Block XHR requests
    XMLHttpRequest.prototype.open = function() {
      console.log('🚫 XHR request blocked - Dev tools detected');
      throw new Error('Network access blocked - Close developer tools');
    };
    
    // Block WebSocket connections
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function() {
      throw new Error('WebSocket access blocked - Close developer tools');
    };
    
    // Block EventSource
    const OriginalEventSource = window.EventSource;
    window.EventSource = function() {
      throw new Error('EventSource access blocked - Close developer tools');
    };
  }

  restoreNetworkRequests() {
    // Restore original network functions
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    
    if (this.originalXHR) {
      XMLHttpRequest.prototype.open = this.originalXHR;
    }
  }

  disableAllDevToolsAccess() {
    // Enhanced keyboard blocking with immediate response
    const blockKeyEvent = (e) => {
      let blocked = false;
      const key = e.key.toLowerCase();
      
      // F12 only (most important)
      if (key === 'f12') {
        blocked = true;
      }
      
      // Chrome/Edge dev tools shortcuts only
      if (e.ctrlKey && e.shiftKey) {
        if (['i', 'j', 'c', 'k'].includes(key)) {
          blocked = true;
        }
      }
      
      // View source only (but allow Ctrl+S for save)
      if (e.ctrlKey && key === 'u') {
        blocked = true;
      }
      
      // Mac dev tools shortcuts
      if (e.metaKey && e.altKey && ['i', 'c', 'j'].includes(key)) {
        blocked = true;
      }

      if (blocked) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.handleDevToolsDetected();
        return false;
      }
    };

    // Only keydown for dev tools shortcuts
    document.addEventListener('keydown', blockKeyEvent, true);

    // Enhanced context menu blocking - but only right-click
    const blockContextMenu = (e) => {
      // Only block actual right-click context menu
      if (e.type === 'contextmenu') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.handleDevToolsDetected();
        return false;
      }
    };

    document.addEventListener('contextmenu', blockContextMenu, true);

    // Smart mouse event blocking
    document.addEventListener('mousedown', (e) => {
      // Only block right click and middle click
      if (e.button === 2 || e.button === 1) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.handleDevToolsDetected();
        return false;
      }
      
      // Only block Ctrl+Click on non-interactive elements
      if ((e.ctrlKey || e.metaKey) && e.button === 0) {
        const target = e.target;
        const isInteractive = target.tagName === 'A' || 
                             target.tagName === 'BUTTON' || 
                             target.tagName === 'INPUT' || 
                             target.onclick !== null ||
                             target.closest('a') !== null ||
                             target.closest('button') !== null ||
                             target.closest('[onclick]') !== null ||
                             target.closest('[role="button"]') !== null ||
                             target.classList.contains('clickable') ||
                             target.classList.contains('card') ||
                             target.classList.contains('video-card');
        
        // Only block if it's NOT an interactive element
        if (!isInteractive) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.handleDevToolsDetected();
          return false;
        }
      }
    }, true);
  }

  setupAdvancedProtection() {
    // Comprehensive CSS protection
    this.injectProtectionCSS();
    
    // Monitor for DOM manipulation
    this.setupDOMProtection();
    
    // Block common bypass methods
    this.blockBypassMethods();
  }

  injectProtectionCSS() {
    const style = document.createElement('style');
    style.id = 'advanced-protection-css';
    style.textContent = `
      /* Comprehensive protection styles */
      .protection-active {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        pointer-events: auto !important; /* Allow some interaction */
      }
      
      .protection-active * {
        -webkit-user-drag: none !important;
        user-drag: none !important;
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      
      /* Hide content when dev tools detected */
      .dev-tools-detected {
        filter: blur(10px) !important;
        opacity: 0.1 !important;
        pointer-events: none !important;
      }
      
      /* Block screenshot attempts */
      @media print {
        * { display: none !important; }
        body::after {
          content: "Printing disabled - Close developer tools";
          display: block !important;
          font-size: 24px;
          text-align: center;
          margin-top: 100px;
        }
      }
      
      /* Hide on small screens (dev tools open) */
      @media screen and (max-height: 400px), screen and (max-width: 600px) {
        .protection-active {
          opacity: 0.05 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  setupDOMProtection() {
    // Monitor DOM for inspection attempts
    const observer = new MutationObserver((mutations) => {
      if (this.protectionActive) {
        mutations.forEach((mutation) => {
          // If attributes are being modified during protection, it's suspicious
          if (mutation.type === 'attributes') {
            this.handleDevToolsDetected();
          }
        });
      }
    });
    
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class', 'id']
    });
  }

  blockBypassMethods() {
    // Override console methods to detect usage
    const originalConsole = { ...console };
    
    Object.keys(console).forEach(method => {
      console[method] = (...args) => {
        if (this.protectionActive) {
          this.handleDevToolsDetected();
          return;
        }
        originalConsole[method](...args);
      };
    });

    // Block eval and Function constructor
    window.eval = function() {
      throw new Error('eval() is disabled');
    };
    
    window.Function = function() {
      throw new Error('Function constructor is disabled');
    };

    // Monitor global scope pollution
    setInterval(() => {
      const suspiciousProps = ['$', '$$', '$x', 'inspect', 'monitor', 'debug'];
      suspiciousProps.forEach(prop => {
        if (window[prop] && !this.isDevToolsOpen) {
          this.handleDevToolsDetected();
        }
      });
    }, 1000);
  }

  activateProtection() {
    if (this.protectionActive) return;
    
    this.protectionActive = true;
    console.log('🛡️ FULL PROTECTION ACTIVATED');
    
    // Apply all protection measures
    document.body.classList.add('protection-active', 'dev-tools-detected');
    
    // Block network requests
    this.blockNetworkRequests();
    
    // Start console flooding
    this.startConsoleFlood();
    
    // Apply visual restrictions
    this.applyVisualLock();
  }

  deactivateProtection() {
    this.protectionActive = false;
    this.isDevToolsOpen = false;
    
    console.log('✅ Protection deactivated - dev tools closed');
    
    // Remove restrictions
    document.body.classList.remove('protection-active', 'dev-tools-detected');
    
    // Restore network requests
    this.restoreNetworkRequests();
    
    // Clear visual restrictions
    this.clearVisualLock();
    
    // Stop console flood
    this.stopConsoleFlood();
    
    // Remove overlay
    const overlay = document.getElementById('devtools-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  applyVisualLock() {
    // Apply blur and opacity with smooth transition
    document.body.style.transition = 'all 0.5s ease';
    document.body.style.filter = 'blur(12px) grayscale(100%)';
    document.body.style.opacity = '0.2';
    document.body.style.pointerEvents = 'none';
    
    // Disable scrolling
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }

  clearVisualLock() {
    document.body.style.transition = 'all 0.5s ease';
    document.body.style.filter = '';
    document.body.style.opacity = '';
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  startConsoleFlood() {
    if (this.consoleFloodInterval) return;
    
    this.consoleFloodInterval = setInterval(() => {
      if (!this.protectionActive) {
        this.stopConsoleFlood();
        return;
      }
      
      try {
        console.clear();
        console.log('%c🛡️ CONTENT PROTECTED', 'color: red; font-size: 50px; font-weight: bold; text-shadow: 3px 3px 6px rgba(0,0,0,0.8);');
        console.log('%cDeveloper tools access is restricted.', 'color: orange; font-size: 20px; font-weight: bold;');
        console.log('%cClose all developer tools to restore access.', 'color: yellow; font-size: 16px;');
        console.log('%c' + '═'.repeat(60), 'color: red; font-weight: bold;');
        
        // Flood with warnings
        for (let i = 0; i < 25; i++) {
          console.warn('⚠️ UNAUTHORIZED ACCESS DETECTED ⚠️');
          console.error('🚫 ACCESS DENIED 🚫');
        }
      } catch (e) {
        // Ignore errors
      }
    }, 50); // Very aggressive flooding
  }

  stopConsoleFlood() {
    if (this.consoleFloodInterval) {
      clearInterval(this.consoleFloodInterval);
      this.consoleFloodInterval = null;
    }
  }

  handleDevToolsDetected() {
    if (this.isDevToolsOpen) return;
    
    this.isDevToolsOpen = true;
    console.log('🚨 DEVELOPER TOOLS DETECTED!');
    
    // Immediate protection activation
    this.activateProtection();
    this.showEnhancedProtectionOverlay();
    
    // Optional: Redirect after delay (uncomment if needed)
    // setTimeout(() => {
    //   if (this.isDevToolsOpen) {
    //     window.location.href = 'about:blank';
    //   }
    // }, 10000);
  }

  showEnhancedProtectionOverlay() {
    const existing = document.getElementById('devtools-overlay');
    if (existing) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'devtools-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98));
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      text-align: center;
      padding: 20px;
      backdrop-filter: blur(25px);
      cursor: not-allowed;
      user-select: none;
    `;
    
    overlay.innerHTML = `
      <div style="max-width: 600px; animation: slideInUp 0.6s ease;">
        <div style="font-size: 100px; margin-bottom: 30px; animation: pulse 2s infinite;">🛡️</div>
        <h1 style="color: #ff3838; margin-bottom: 25px; font-size: 36px; font-weight: 800; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
          DEVELOPER TOOLS BLOCKED
        </h1>
        <div style="background: rgba(255,56,56,0.1); border: 2px solid #ff3838; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
          <p style="font-size: 18px; margin-bottom: 15px; line-height: 1.6; font-weight: 600;">
            🚨 Unauthorized access attempt detected
          </p>
          <p style="font-size: 16px; margin-bottom: 15px; opacity: 0.9; line-height: 1.5;">
            This content is protected. All network requests are now blocked.
          </p>
          <p style="font-size: 14px; opacity: 0.8; color: #ffaa00;">
            Close ALL developer tools (F12, Right-click menu, Browser menu) to restore access.
          </p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; margin-bottom: 25px;">
          <p style="font-size: 13px; opacity: 0.7; line-height: 1.4;">
            Blocked: Console, Elements, Network, Sources, Performance, Memory, Application, Security tabs
          </p>
        </div>
        
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
          <button onclick="window.location.reload()" style="
            background: linear-gradient(135deg, #4ecdc4, #44a08d);
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            color: white;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 4px 15px rgba(78, 205, 196, 0.3);
          " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            🔄 Reload Page
          </button>
          <button onclick="window.close()" style="
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            color: white;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
          " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            ❌ Close Tab
          </button>
        </div>
        
        <div style="margin-top: 30px; font-size: 12px; opacity: 0.5;">
          Protection ID: ${Date.now().toString(36)}
        </div>
      </div>
      
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }
        @keyframes slideInUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
    `;
    
    document.body.appendChild(overlay);
    
    // Make overlay completely unclickable except for buttons
    overlay.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Block any attempts to remove overlay
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node.id === 'devtools-overlay') {
              // Recreate overlay if removed
              setTimeout(() => this.showEnhancedProtectionOverlay(), 100);
            }
          });
        }
      });
    });
    
    observer.observe(document.body, { childList: true });
  }

  showWarning(message = 'Developer tools access is restricted') {
    if (this.warningShown) return;
    this.warningShown = true;
    
    const warning = document.createElement('div');
    warning.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ff4757, #c44569);
      color: white;
      padding: 20px 25px;
      border-radius: 15px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 10px 30px rgba(255, 71, 87, 0.4);
      font-weight: 600;
      font-size: 15px;
      max-width: 350px;
      animation: slideInBounce 0.6s ease;
      border: 2px solid rgba(255,255,255,0.2);
    `;
    
    warning.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">🚫</span>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(warning);
    
    // Add bounce animation
    const animationStyle = document.createElement('style');
    animationStyle.textContent = `
      @keyframes slideInBounce {
        0% { transform: translateX(100%) scale(0.8); opacity: 0; }
        60% { transform: translateX(-10px) scale(1.05); opacity: 1; }
        100% { transform: translateX(0) scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(animationStyle);
    
    setTimeout(() => {
      if (warning.parentNode) {
        warning.style.animation = 'slideInBounce 0.4s ease reverse';
        setTimeout(() => {
          warning.remove();
          if (animationStyle.parentNode) {
            animationStyle.remove();
          }
        }, 400);
      }
      this.warningShown = false;
    }, 5000);
  }

  // Additional utility methods for enhanced protection
  disableTextSelection() {
    document.body.style.webkitUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    document.body.style.userSelect = 'none';
  }

  enableTextSelection() {
    document.body.style.webkitUserSelect = '';
    document.body.style.mozUserSelect = '';
    document.body.style.msUserSelect = '';
    document.body.style.userSelect = '';
  }

  // Method to check protection status
  getProtectionStatus() {
    return {
      active: this.protectionActive,
      devToolsOpen: this.isDevToolsOpen,
      networkBlocked: this.isDevToolsOpen,
      timestamp: new Date().toISOString()
    };
  }

  // Method to manually trigger protection (for testing)
  triggerProtection() {
    this.handleDevToolsDetected();
  }
}

// Initialize protection immediately when script loads
(function() {
  'use strict';
  
  console.log('🛡️ Enhanced protection system loading...');
  
  // Create global instance
  window.devToolsProtection = new EnhancedDevToolsProtection();
  
  // Additional global protections
  
  // Block window.open with dev tools URLs
  const originalWindowOpen = window.open;
  window.open = function(url, ...args) {
    if (url && (url.includes('chrome://') || url.includes('about:debugging') || url.includes('devtools'))) {
      console.log('🚫 Blocked dev tools URL');
      return null;
    }
    return originalWindowOpen.apply(this, [url, ...args]);
  };
  
  // Block iframe with dev tools content
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    const element = originalCreateElement.call(this, tagName);
    
    if (tagName.toLowerCase() === 'iframe') {
      const originalSrcSetter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src').set;
      Object.defineProperty(element, 'src', {
        set: function(value) {
          if (value && (value.includes('chrome://') || value.includes('devtools'))) {
            console.log('🚫 Blocked dev tools iframe');
            return;
          }
          originalSrcSetter.call(this, value);
        },
        get: function() {
          return this.getAttribute('src');
        }
      });
    }
    
    return element;
  };
  
  // Block Service Worker registration (can be used for bypassing)
  if ('serviceWorker' in navigator) {
    const originalRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = function() {
      console.log('🚫 Service Worker registration blocked');
      return Promise.reject(new Error('Service Worker registration blocked'));
    };
  }
  
  // Monitor for external script injection
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.tagName === 'SCRIPT' && node.src && !node.src.includes(window.location.origin)) {
          console.log('🚫 External script blocked:', node.src);
          node.remove();
        }
      });
    });
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
  
  console.log('✅ Enhanced protection system loaded and active');
  
  // Final check after a short delay to catch any missed cases
  setTimeout(() => {
    window.devToolsProtection.detectDevToolsMultipleMethods();
  }, 500);
  
})();