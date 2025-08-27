# STEPTWO Gallery Scraper

A professional Chrome extension for scraping image galleries from authenticated websites with **intelligent single-click pattern recognition**, professional UI design, and enterprise-grade reliability.

> **🎉 NEW in v2.2.0**: Complete professional dashboard redesign, live preview filename masks, enhanced smart selection feedback, enterprise-grade reliability features, and comprehensive debugging tools. [See recent updates](#-recent-updates) for full details.

## 🚀 Features

### Core Functionality
- **Gallery Scraping**: Extract images, thumbnails, and metadata from gallery pages
- **Authentication Support**: Works seamlessly on sites requiring login (assumes active session)
- **Infinite Scroll**: Automatically handles lazy-loading and infinite scroll galleries with smooth UX
- **Pagination**: Navigate through multiple pages automatically with configurable settings
- **Local Processing**: All data processing happens locally in your browser for privacy
- **Enterprise Reliability**: Service worker persistence, memory optimization for large galleries
- **Download Concurrency Control**: Advanced worker pool system with configurable concurrent downloads

### 🎨 Professional Dashboard (NEW!)
- **Two-Column Layout**: Professional UI with organized controls and information panels
- **Enhanced Tab Interface**: Modern tabbed navigation with smooth animations and gradients
- **Settings Organization**: Logically grouped settings with visual separators:
  - 🚀 **Scraping Behavior** (Timing, retries, presets)
  - 💾 **Download Options** (Concurrency, folders, export settings)
  - 📝 **Filename Customization** (Advanced mask system with live preview)
- **Visual Feedback**: Hover effects, animations, and professional styling throughout
- **Responsive Design**: Optimized for various screen sizes with dedicated scroll areas

### 🧠 Smart Selection (ENHANCED!)
- **🎯 Single-Click Pattern Recognition**: Click once on any item to automatically find all similar elements
- **Intelligent DOM Analysis**: Advanced algorithm analyzes page structure to identify repeating patterns
- **Enhanced Visual Feedback**: 
  - Instant green highlighting shows all matching elements
  - Smart selector notifications with element counts
  - Auto-switch to Selectors tab with input highlighting
- **Professional-Grade**: Works like Easy Scraper and other commercial tools
- **Auto-Detection**: Automatically detects common gallery patterns (.gallery-item, .product-card, etc.)
- **Custom Selectors**: Override with custom CSS/XPath if needed
- **Selector Testing**: Test selectors before running full scrapes with live results and detailed feedback

### 📝 Advanced Filename Mask System (ENHANCED!)
- **Live Preview**: Real-time filename preview as you type with instant validation
- **Smart *subdirs* Extraction**: Intelligent directory parsing for cleaner filenames
  - Example: `https://imago-images.com/bild/st/0820921639/w.jpg` → `0820921639.jpg`
- **Enhanced Help System**: 
  - Static examples with real URLs
  - Live preview with mock data
  - Color-coded validation feedback
- **Available Tokens**: *name*, *ext*, *num*, *url*, *subdirs*, *text*, *hh*, *mm*, *ss*, *m*, *d*, *y*, *yyyy*
- **Persistent Counters**: File numbering persists across browser sessions and service worker restarts

### Data Management
- **Multiple Export Formats**: JSON, CSV, and direct image downloads
- **Memory Optimization**: Batch processing for galleries with 100,000+ items
- **Data Preview**: Live preview of collected data with sorting and filtering
- **Recipe System**: Save and reuse scraping configurations
- **Progress Tracking**: Real-time progress with detailed logging and status indicators
- **Duplicate Handling**: Advanced deduplication with persistent URL tracking
- **Enhanced Error Handling**: Detailed error messages with specific failure reasons

### 🔧 Debugging & Development Tools (NEW!)
- **Comprehensive Debug Utility**: Professional debug panel with:
  - 📋 Tab information and state analysis
  - 🔐 Extension permissions verification
  - 📊 Extension state monitoring
  - 📑 Browser tabs validation
  - 💾 Storage information and metrics
- **Enhanced Error Logging**: Detailed download failure tracking with retry information
- **Performance Monitoring**: Memory usage tracking and optimization alerts

### Site Profiles
Built-in support for popular image agencies:
- Getty Images
- Shutterstock
- Imago (imago-images.com)
- MirrorPix
- WENN
- RexFeatures
- ActionPress
- Universal fallback for other sites

## 📦 Installation

### Method 1: Load Unpacked Extension

1. **Download the Extension**
   - Clone or download this repository to your local machine
   - Extract the files to a folder

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/` in Chrome
   - Enable "Developer mode" (toggle in top right)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

4. **Pin the Extension**
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "STEPTWO Gallery Scraper" and click the pin icon

### Method 2: Build from Source

**Note**: This extension is designed to work directly without a build process. The source files are ready to use as-is.

1. **Prerequisites (Optional)**
   - Node.js (v14 or higher) - only needed for packaging
   - npm or yarn - only needed for development scripts

2. **Development Commands**
   ```bash
   npm install  # Optional: installs no dependencies, just validates package.json
   npm run package  # Creates a zip file for distribution
   npm test  # Opens test.html in browser
   ```

3. **Load the extension** following Method 1

## 🎯 Usage

### Getting Started

1. **Navigate to a Gallery Page**
   - Go to any supported image gallery website
   - Ensure you're logged in if the site requires authentication
   - Make sure the page is fully loaded

2. **Open the Dashboard**
   - Click the STEPTWO Gallery Scraper extension icon
   - A new dashboard window will open

3. **Configure Settings**
   - Choose a preset (Balanced, Fast, Thorough, Max Compatible)
   - Adjust custom settings as needed
   - Set export preferences

### Scraping Modes

#### Current Page Mode
- Scrapes only the currently visible page
- Handles infinite scroll if enabled
- Good for quick testing and single-page galleries

#### All Pages Mode
- Automatically navigates through all available pages
- Detects and follows pagination links
- Ideal for comprehensive data collection

### 🧠 Smart Point-and-Click Selection

1. **Enable Selector Mode**
   - Click "🎯 Enable Selector Mode" in the dashboard
   - An intelligent overlay appears on the target page
   - Instructions show: "Click once on any item to automatically find all similar elements!"

2. **Single-Click Pattern Recognition**
   - **Click ANY element** (image, title, container, etc.) just once
   - The AI algorithm instantly analyzes the page structure
   - **All similar elements are highlighted in green automatically**
   - The perfect CSS selector is generated and sent to dashboard

3. **Instant Results**
   - Container selector field is auto-populated
   - Success notification shows count: "✅ Selector updated! Found X matching elements"
   - Dashboard auto-switches to Selectors tab
   - Ready to test and scrape immediately

4. **Professional Intelligence**
   - Works like Easy Scraper and commercial tools
   - Recognizes patterns like `.gallery-item`, `.product-card`, `#content .post`
   - Handles complex nested structures automatically
   - No manual selector writing needed

5. **Test and Refine** (if needed)
   - Use "Test Selectors" button to verify with live results
   - Manually edit selectors only if needed
   - Save as a recipe for future use

### Data Export (ENHANCED!)
- Images are downloaded with advanced worker pool concurrency control
- **Live Preview Filename Masks**: Real-time preview with intelligent *subdirs* parsing
- Enhanced duplicate handling with persistent URL tracking across sessions
- Memory-optimized processing for massive galleries (100,000+ items)
- Configurable download folder with advanced organization

##### Advanced Filename Mask System (NEW!)
The extension features a completely redesigned filename mask system with live preview:

**Enhanced Features:**
- **🔄 Live Preview**: See filename results instantly as you type
- **🧠 Smart *subdirs* Parsing**: Intelligent directory extraction for cleaner names
- **✅ Real-time Validation**: Color-coded feedback for mask syntax
- **📚 Interactive Examples**: Static examples with real URLs
- **💾 Persistent Counters**: File numbering survives browser restarts

**Available Tokens:**
- `*name*` - Original filename (without extension)
- `*ext*` - File extension (jpg, png, etc.)
- `*url*` - Domain name (e.g., example.com)
- `*subdirs*` - **ENHANCED**: Intelligent directory segment extraction
- `*text*` - Associated text content from the page
- `*num*` - **PERSISTENT**: Incremental number (persists across sessions)
- `*hh*`, `*mm*`, `*ss*` - Current time (hours, minutes, seconds)
- `*m*`, `*d*`, `*y*`, `*yyyy*` - Current date (month, day, year)

**Enhanced *subdirs* Examples:**
- URL: `https://imago-images.com/bild/st/0820921639/w.jpg`
- Old result: `bildst0820921639` (flattened)
- **New result**: `0820921639` (intelligent last directory)

**Mask Examples:**
- `*name*.*ext*` → `document.jpg`
- `*subdirs*.*ext*` → `0820921639.jpg` (from imago-images.com)
- `*url*_*name*.*ext*` → `example.com_document.jpg`
- `*y*-*m*-*d*_*num*_*name*.*ext*` → `23-12-25_042_document.jpg`

#### JSON Export
- Complete structured data with metadata
- Includes scraping logs and summary statistics
- Timestamped for easy tracking

#### CSV Export
- Tabular format for spreadsheet applications
- All extracted fields included
- Proper escaping for special characters

## ⚙️ Configuration

### Professional Dashboard Interface (NEW!)
The extension now features a completely redesigned two-column dashboard:

**Left Panel - Controls & Configuration:**
- Statistics panel with real-time progress
- Control panel with enhanced action buttons
- Organized settings with logical grouping

**Right Panel - Information & Data:**
- Modern tabbed interface with smooth animations
- Enhanced logs with better formatting
- Data preview with improved table design
- Selectors configuration with visual feedback

### Presets

- **Balanced**: Good performance with reliability (default)
- **Fast**: Quick scraping with minimal delays
- **Thorough**: Maximum data quality with longer waits
- **Max Compatible**: Optimized for problematic sites

### Enhanced Custom Settings

#### 🚀 Scraping Behavior
- **Page Wait**: Time to wait after page loads (500-30000ms)
- **Scroll Delay**: Delay between scroll attempts (100-10000ms)  
- **Max Scroll Attempts**: Maximum infinite scroll attempts (1-50)
- **Download Retry Count**: **NEW**: Configurable retry attempts (0-10)

#### 💾 Download Options
- **Download Folder**: Custom folder name for downloads
- **Max Concurrent Downloads**: **ENHANCED**: Worker pool system (1-10)
- **Download Images**: Toggle image downloading
- **Return to Top After Scroll**: **NEW**: Configurable scroll behavior

#### 📝 Filename Customization
- **Filename Mask**: **ENHANCED**: Live preview with real-time validation
- **Interactive Help**: Static examples and live preview
- **Smart Validation**: Color-coded feedback and error detection

### 🔧 Developer Tools (NEW!)
- **Debug Utility**: Comprehensive system information panel
- **Permissions Monitor**: Extension permissions verification
- **Performance Tracking**: Memory usage and optimization alerts
- **Enhanced Logging**: Detailed error tracking with specific failure reasons

### Selectors

- **Container**: CSS selector for gallery item containers
- **Image**: CSS selector for image elements
- **Link**: CSS selector for destination links
- **Next Page**: CSS selector for pagination controls

## 🔧 Advanced Features

### Recipe System
- Save complete scraping configurations
- Import/export recipes as JSON files
- One-click recipe execution
- Share recipes with team members

### Data Cleaning
- Automatic whitespace trimming
- URL validation and normalization
- Duplicate detection and removal
- Custom transformation rules

### Error Handling
- Comprehensive retry logic
- Graceful failure handling
- Detailed error logging
- Recovery from interruptions

## 🛡️ Privacy & Security

- **Local-Only Processing**: No data leaves your browser
- **No Telemetry**: Zero tracking or analytics
- **Session Respect**: Uses existing browser cookies
- **Secure Storage**: All data stored locally

## 🐛 Troubleshooting

### Common Issues

#### Extension Not Loading
- Ensure Developer mode is enabled
- Check for syntax errors in console
- Verify all required files are present

#### Scraping Not Working
- Check if you're logged into the target site
- Verify the page is fully loaded
- Test selectors manually
- Check browser console for errors

#### Downloads Failing
- Verify download permissions are granted
- Check available disk space
- Ensure target folder is writable
- Review download logs for specific errors

### Debug Mode
- Open browser developer tools
- Check Console tab for detailed logs
- Monitor Network tab for requests
- Use Elements tab to verify selectors

## 📁 File Structure

```
steptwo-gallery-scraper/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content.js            # Content script
├── dashboard.html        # Dashboard interface
├── dashboard.js          # Dashboard logic
├── dashboard.css         # Dashboard styles
├── icons/                # Extension icons
├── README.md             # This file
└── CHANGELOG.md          # Version history
```

## 🔄 Updates

### Updating the Extension
1. Download the latest version
2. Replace existing files
3. Reload the extension in Chrome
4. Clear browser cache if needed

### Version Compatibility
- Chrome 88+ (Manifest V3)
- Manifest V2 not supported
- Tested on Windows, macOS, and Linux

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style
- Follow existing code patterns
- Add comments for complex logic
- Maintain consistent formatting
- Include error handling

## 🔄 Recent Updates

### Version 2.2.0 - Professional UI & Enterprise Features (LATEST)

#### 🎨 Professional Dashboard Redesign
- **Two-Column Layout**: Complete UI overhaul with organized left/right panels
- **Modern Tab Interface**: Gradient backgrounds, smooth animations, professional styling
- **Enhanced Visual Feedback**: Hover effects, depth animations, and visual hierarchy
- **Settings Organization**: Logically grouped settings with visual separators

#### 📝 Advanced Filename Mask System
- **Live Preview**: Real-time filename preview with instant validation
- **Smart *subdirs* Parsing**: Intelligent directory extraction (e.g., `0820921639` from imago-images.com)
- **Enhanced Help System**: Static examples with real URLs and color-coded feedback
- **Persistent Counters**: File numbering survives browser restarts and service worker cycles

#### 🧠 Enhanced Smart Selection
- **Comprehensive Feedback**: Detailed notifications with element counts and selector display
- **Visual Input Highlighting**: Auto-switch to Selectors tab with green border animations
- **Improved Reliability**: Fixed selector inconsistency issues with stored `bestSelector` logic

#### 🔧 Enterprise-Grade Reliability
- **Memory Optimization**: Batch processing for massive galleries (100,000+ items)
- **Service Worker Persistence**: Persistent state for `globalFileCounter` and `processedUrls`
- **Enhanced Error Handling**: Detailed error messages with specific `chrome.runtime.lastError` information
- **Advanced Debug Utility**: Comprehensive system information with permissions monitoring

#### ⚙️ Advanced Configuration
- **Worker Pool Downloads**: Sophisticated concurrent download management
- **Configurable Retry Logic**: User-controlled download retry attempts
- **Professional Settings Groups**: 
  - 🚀 Scraping Behavior (timing, retries, presets)
  - 💾 Download Options (concurrency, folders, export)
  - 📝 Filename Customization (live preview system)

#### 🔍 Developer Tools Enhancement
- **Professional Debug Panel**: Emoji-organized system information
- **Permissions Verification**: Critical permissions monitoring
- **Performance Tracking**: Memory usage and optimization alerts
- **Enhanced Error Logging**: Detailed failure tracking with retry information

### Version 2.1.0 - Major Intelligence Upgrade
- **🧠 Smart Selector**: Revolutionary single-click pattern recognition
- **🚀 Professional-Grade**: Works like Easy Scraper and commercial tools
- **⚡ Performance**: Download concurrency control and optimized messaging
- **🐛 Bug Fixes**: Fixed initialization issues, messaging conflicts, and memory leak.
