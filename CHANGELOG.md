# Changelog

All notable changes to Just REST Client will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2026-01-26

### Added
- Draggable vertical divider between sidebar and main content for resizable panes
  - Persist width preference to localStorage
  - Responsive design that hides divider on mobile
- Type-ahead script selector with autocomplete
  - Keyboard navigation support (arrow keys, enter, escape)
  - Mouse and keyboard interaction
  - Real-time filtering as you type
- Active group name display below each tab (Variables, Requests, Scripts)
  - Updates dynamically when switching groups
- Filtered script selection in pre/post request dropdowns
  - Only shows scripts from active script group plus global group
  - Reduces clutter and prevents incorrect script selection

### Improved
- Search functionality across all tabs with better UX
- Layout improvements for better usability
- Better spacing around UI elements

## [1.1.2] - 2024-12-20

### Fixed
- Tauri HTTP plugin configuration issues
- Resolved CORS and localhost connectivity problems
- Improved error handling for HTTP requests

## [1.1.1] - 2024-12-15

### Added
- Multiple scripts per request support
  - Ability to assign both pre-request and post-request scripts
  - Enhanced scripting workflow

## [1.1.0] - 2024-12-10

### Changed
- Updated release workflow to use semantic versioning pattern
- Improved documentation and README
- Build process enhancements

## [1.0.0] - 2024-12-01

### Added
- Initial stable release
- Core REST API client functionality
- Request/response management
- Variable system for dynamic values
- Script execution (pre-request and post-request)
- Collections organization with grouping support
- Import/Export functionality
  - Postman collection import
  - cURL command import
- Advanced JSON editor with syntax highlighting
- Resizable editors and viewers
- Full-screen mode for response body
- Custom application icon
- Splash screen
- Multi-platform support (macOS, Linux, Windows)
- GitHub Actions CI/CD for automated builds

### Features
- **HTTP Methods**: Support for GET, POST, PUT, DELETE, PATCH, and more
- **Request Configuration**:
  - Headers management
  - Query parameters
  - Request body (JSON, form data, raw text)
- **Response Handling**:
  - Syntax-highlighted response body
  - Response headers display
  - Status code and timing information
- **Variables**:
  - Environment variables support
  - Variable interpolation in requests
  - Group-based variable organization
- **Scripting**:
  - JavaScript-based pre-request scripts
  - Post-request scripts for response processing
  - Access to request/response context
- **Organization**:
  - Collections for grouping requests
  - Group management for variables, requests, and scripts
  - Search functionality across all tabs
- **Import/Export**:
  - Import Postman collections
  - Parse and import cURL commands
  - Export collections for sharing
- **UI/UX**:
  - Clean, modern interface with Tailwind CSS
  - Dark mode support
  - Resizable panes and editors
  - Keyboard shortcuts
  - Mobile-responsive design

### Technical Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 with Tailwind
- **Desktop Framework**: Tauri v2
- **Build Tool**: Vite
- **HTTP Client**: Tauri HTTP plugin (native, secure)
- **Storage**: localStorage for persistence

---

## Release Links

- [1.1.3](https://github.com/nicechester/just-rest-client/releases/tag/1.1.3)
- [1.1.2](https://github.com/nicechester/just-rest-client/releases/tag/1.1.2)
- [1.1.1](https://github.com/nicechester/just-rest-client/releases/tag/1.1.1)
- [1.1.0](https://github.com/nicechester/just-rest-client/releases/tag/1.1.0)
- [1.0.0](https://github.com/nicechester/just-rest-client/releases/tag/v1.0.0)
