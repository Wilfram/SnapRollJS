/**
 * @file snaproll.js
 * @author [Wil]
 * @version 2.0.4
 * @description A lightweight, dependency-free library for creating full-page, snap-scrolling presentations with configurable animations for vertical sections and horizontal slides.
 */

(function (global) {
  "use strict";

  /**
   * A Set of HTML tag names that are considered user-editable, to prevent navigation hijacking.
   * @private
   * @const {Set<string>}
   */
  const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

  /**
   * @typedef {object} SnapRollOptions
   * @property {string|HTMLElement} [container='.sr-cont'] - The selector or element for the main container.
   * @property {string} [sectionSelector='.sr-sec'] - The selector for section elements.
   * @property {string} [activeClass='sr-active'] - The class applied to the active section.
   * @property {string} [prevClass='sr-prev'] - The class applied to sections that have been scrolled past.
   * @property {string} [sectionAnimation='slide'] - Default animation for sections ('slide', 'fade', 'zoom', 'flip', 'skew', 'rotate'). Can be overridden by `data-sr-section-animation`.
   * @property {boolean} [keyboard=true] - Whether to enable keyboard navigation.
   * @property {boolean} [loop=false] - Whether to loop from the last section/slide to the first and vice versa.
   * @property {number} [scrollTimeout=800] - The debounce timeout in ms for section transitions.
   * @property {number} [slideScrollTimeout=600] - The debounce timeout in ms for slide transitions.
   * @property {number} [touchThreshold=50] - The minimum swipe distance in pixels to trigger navigation.
   * @property {number} [wheelDeltaThreshold=5] - The minimum mouse wheel delta to trigger navigation.
   * @property {number} [wheelGestureEndDelay=300] - The delay in ms to reset the wheel gesture detection.
   * @property {string} [pageTitle=''] - A base title for the document, to be combined with section titles.
   * @property {string[]} [sectionTitles=[]] - An array of titles for each section, used for the document title.
   * @property {Object.<number, string[]>} [slideHashes={}] - An object to define hashes for slides, e.g., `{ 1: ['hash1', 'hash2'] }`.
   * @property {boolean} [pagination=true] - Whether to create and display pagination dots for sections.
   * @property {'right'|'left'|'top'|'bottom'} [paginationPosition='right'] - Position of the section pagination dots.
   * @property {string} [hashSeparator='--'] - The separator used in the URL between section and slide hashes.
   * @property {string} [slideSelector='.sr-slide'] - The selector for slide elements within a section.
   * @property {string} [slideAnimation='slide'] - Default animation for slides. Can be overridden by `data-sr-slide-animation`.
   * @property {string} [slideActiveClass='sr-slide-active'] - The class applied to the active slide.
   * @property {string} [slidePrevClass='sr-slide-prev'] - The class applied to slides that come before the active one.
   * @property {boolean} [slideArrows=true] - Whether to create and display navigation arrows for slides.
   * @property {boolean} [slidePagination=true] - Whether to create and display pagination dots for slides.
   * @property {'bottom'|'top'} [slidePaginationPosition='bottom'] - Position of the slide pagination dots.
   * @property {boolean} [debug=false] - Whether to log internal state and events to the console.
   */

  /** @type {SnapRollOptions} */
  const DEFAULTS = {
    container: ".sr-cont",
    sectionSelector: ".sr-sec",
    activeClass: "sr-active",
    prevClass: "sr-prev",
    sectionAnimation: "slide",
    keyboard: true,
    loop: false,
    scrollTimeout: 800,
    slideScrollTimeout: 600,
    touchThreshold: 50,
    wheelDeltaThreshold: 5,
    wheelGestureEndDelay: 300,
    pageTitle: "",
    sectionTitles: [],
    slideHashes: {},
    pagination: true,
    paginationPosition: "right",
    hashSeparator: "--",
    slideSelector: ".sr-slide",
    slideAnimation: "slide",
    slideActiveClass: "sr-slide-active",
    slidePrevClass: "sr-slide-prev",
    slideArrows: true,
    slidePagination: true,
    slidePaginationPosition: "bottom",
    debug: false,
  };

  /**
   * Creates a full-page, snap-scrolling presentation with configurable animations.
   * @class SnapRoll
   */
  class SnapRoll {
    /**
     * Initializes a new SnapRoll instance, setting up configuration and state.
     * @param {SnapRollOptions} [options={}] - Configuration options to override the defaults.
     */
    constructor(options = {}) {
      // 1. Merge configuration options with defaults
      this.opts = { ...DEFAULTS, ...options };

      // 2. Initialize core state properties
      this.sectionData = [];
      this.sections = [];
      this.currentIndex = 0;
      this.currentSlideIndices = {};
      this._isAnimating = false; // Debounce flag for transitions
      this._touchStart = { x: null, y: null };
      this._wheelGestureTimeout = null;
      this.paginationContainer = null;

      // 3. Find and validate the main container element
      this._findAndValidateContainer();

      // 4. Validate configuration options
      this._validateOptions(this.opts);

      // 5. Define all event listeners and bind handlers
      this.listeners = this._defineListeners();

      // 6. Initialize the instance
      this.init();
    }

    /**
     * Finds and validates the main container element.
     * Throws an Error if the container element is not found.
     * @private
     * @throws {Error} If the container element cannot be found.
     */
    _findAndValidateContainer() {
      const container =
        typeof this.opts.container === "string"
          ? document.querySelector(this.opts.container)
          : this.opts.container;

      if (!container) {
        throw new Error(
          `SnapRoll: Container not found (${this.opts.container})`
        );
      }
      /** @type {HTMLElement} The main scrollable container element. */
      this.container = container;
    }

    /**
     * Defines the configuration array for all required event listeners.
     * @private
     * @returns {Array<object>} The list of listener objects.
     */
    _defineListeners() {
      return [
        {
          target: window,
          event: "hashchange",
          handler: this._handleHashChange.bind(this),
        },
        {
          target: window,
          event: "keydown",
          handler: this._onKeyDown.bind(this),
        },
        {
          target: this.container,
          event: "wheel",
          handler: this._onWheel.bind(this),
          options: { passive: false },
        },
        {
          target: this.container,
          event: "touchstart",
          handler: this._onTouchStart.bind(this),
          options: { passive: true },
        },
        {
          target: this.container,
          event: "touchend",
          handler: this._onTouchEnd.bind(this),
          options: { passive: true },
        },
      ];
    }

    /**
     * Logs messages to the console if the debug option is enabled.
     * @public
     * @param {...any} args - Data to be logged to the console.
     */
    log(...args) {
      if (this.opts.debug) {
        console.log("[SnapRoll]", ...args);
      }
    }

    /**
     * Validates the provided configuration options (opts) and issues warnings
     * for incorrect data types, but does not stop execution.
     * @private
     * @param {SnapRollOptions} opts - The final merged configuration options.
     */
    _validateOptions(opts) {
      // Check 'sectionTitles': should be an array if provided.
      if (opts.sectionTitles && !Array.isArray(opts.sectionTitles)) {
        console.warn(
          `[SnapRoll] Config warning: 'sectionTitles' should be an array. Received type: ${typeof opts.sectionTitles}`
        );
      }

      // Check 'slideHashes': should be a non-array object if provided.
      // The check is performed explicitly for safety and readability.
      const isInvalidSlideHashes =
        opts.slideHashes &&
        (typeof opts.slideHashes !== "object" ||
          Array.isArray(opts.slideHashes));

      if (isInvalidSlideHashes) {
        console.warn(
          `[SnapRoll] Config warning: 'slideHashes' should be a plain object (e.g., { 1: ['hash1'] }). Received type: ${typeof opts.slideHashes}`
        );
      }
    }

    /**
     * Initializes the SnapRoll instance: scans the DOM, sets up the internal structure,
     * determines the initial position, and activates all event listeners.
     * @public
     */
    init() {
      // 1. Scan the DOM and rebuild the internal data structure
      this.refresh();

      // 2. Critical check: If no sections are found, stop initialization immediately.
      if (this.sectionData.length === 0) {
        this.log("Initialization stopped: No sections found.");
        return;
      }

      // 3. Check for a hash in the URL to determine the starting section/slide.
      this._parseInitialHash(true);

      // 4. Attach all defined event listeners (wheel, touch, keydown, hashchange).
      this._toggleEventListeners(true);
    }

    /**
     * Re-scans the DOM for sections and slides, rebuilds the internal data structure (this.sectionData),
     * and re-initializes controls (arrows, pagination). Useful after dynamic DOM changes.
     * @public
     */
    refresh() {
      this.log("Refreshing instance: Re-scanning DOM for sections and slides.");

      // 1. Rebuild this.sectionData by scanning the container for all section elements.
      this.sectionData = Array.from(
        this.container.querySelectorAll(this.opts.sectionSelector)
      ).map((el, index) => {
        // --- Section Setup ---

        // Determine section animation: data-attr > JS option > default ('slide')
        const sectionAnim =
          el.dataset.srSectionAnimation || this.opts.sectionAnimation;
        if (sectionAnim && sectionAnim !== "slide") {
          el.classList.add(`sr-anim-${sectionAnim}`);
        }

        // 2. Map through all slides within the current section.
        const slides = Array.from(
          el.querySelectorAll(this.opts.slideSelector)
        ).map((slideEl, slideIndex) => {
          // Determine slide animation: slide data-attr > section data-attr > JS option > default
          const slideAnim =
            slideEl.dataset.srSlideAnimation ||
            el.dataset.srSlideAnimation ||
            this.opts.slideAnimation;

          if (slideAnim && slideAnim !== "slide") {
            slideEl.classList.add(`sr-slide-anim-${slideAnim}`);
          }

          // Generate a unique hash for the slide (used for deep linking)
          const slideHash =
            this.opts.slideHashes[index]?.[slideIndex] ||
            slideEl.dataset.srHash ||
            slideEl.id ||
            (slideIndex + 1).toString();

          return {
            el: slideEl,
            index: slideIndex,
            hash: slideHash,
          };
        });

        // Add a marker class if the section contains slides.
        if (slides.length > 0) el.classList.add("sr-has-slides");

        // Generate section hash and title.
        const sectionHash = el.dataset.srHash || el.id || null;
        const sectionTitle =
          this.opts.sectionTitles[index] || el.dataset.srTitle || null;

        // Build the section data object.
        const data = {
          el,
          index,
          slides,
          hash: sectionHash,
          title: sectionTitle,
          // Initialize references for future DOM elements (arrows/pagination)
          slidePagination: null,
          arrowLeft: null,
          arrowRight: null,
        };

        // Initialize current slide index for this section to 0.
        this.currentSlideIndices[index] = 0;

        // Setup slide controls (arrows and pagination) for the section.
        this._setupSlides(data);

        return data;
      });

      // 3. Update the simplified sections array for quick reference.
      this.sections = this.sectionData.map((data) => data.el);

      // 4. Create main section navigation (dots/menu).
      this._createPagination();

      this.log(`Refresh complete. Found ${this.sectionData.length} sections.`);
    }

    /**
     * Destroys the SnapRoll instance: removes all event listeners, cleans up
     * injected UI elements (pagination, arrows), and resets the internal state.
     * @public
     */
    destroy() {
      this.log("Destroying SnapRoll instance.");

      // 1. Deactivate all registered event listeners to prevent memory leaks.
      this._toggleEventListeners(false);

      // 2. Remove the main section pagination container.
      this.paginationContainer?.remove();

      // 3. Clean up section-specific injected elements and reset classes.
      this.sectionData.forEach((section) => {
        // Remove injected slide controls (arrows and pagination for each section)
        section.arrowLeft?.remove();
        section.arrowRight?.remove();
        section.slidePagination?.remove();

        // Remove transient classes from section elements.
        section.el.classList.remove(
          "sr-anim-fade",
          "sr-anim-scale",
          "sr-anim-zoom",
          "sr-has-slides"
          // Add all other dynamic classes here
        );
      });

      // 4. Clear internal data structures and reset core state for clean disposal.
      this.sectionData = [];
      this.sections = [];
      this.currentIndex = 0;
      this.currentSlideIndices = {};

      this.log("SnapRoll instance destroyed successfully.");
    }

    /**
     * Adds or removes all core event listeners (wheel, touch, keydown, hashchange).
     * Ensures listeners are only active when needed, preventing memory leaks.
     * @private
     * @param {boolean} add - If true, registers listeners; otherwise, deregisters them.
     */
    _toggleEventListeners(add) {
      const action = add ? "addEventListener" : "removeEventListener";

      this.listeners.forEach(({ target, event, handler, options }) => {
        if (event === "keydown" && !this.opts.keyboard) {
          this.log(`Skipping keyboard listener (keyboard option is false).`);
          return;
        }

        // Attach or detach the event listener.
        target[action](event, handler, options);
      });
    }

    /**
     * Utility to create a DOM element with specified attributes and children.
     * @private
     * @param {string} tag - The HTML tag name (e.g., 'div', 'button').
     * @param {object} [attrs={}] - A map of attribute names and values (e.g., { className: 'my-class', 'aria-label': 'Next' }).
     * @param {Array<HTMLElement|Text>} [children=[]] - An array of child nodes to append.
     * @returns {HTMLElement} The created and configured element.
     */
    _createEl(tag, attrs = {}, children = []) {
      const el = document.createElement(tag);

      // 1. Assign attributes dynamically for robustness and flexibility.
      for (const key in attrs) {
        if (key === "className") {
          el.className = attrs[key];
        } else if (key === "ariaLabel") {
          // Conventionally map JS properties like ariaLabel to DOM attributes like aria-label
          el.setAttribute("aria-label", attrs[key]);
        } else if (key.startsWith("data-")) {
          // Handle data attributes (e.g., 'data-index')
          el.dataset[key.substring(5)] = attrs[key];
        } else {
          // Set all other standard attributes
          el.setAttribute(key, attrs[key]);
        }
      }

      // 2. Append all child elements efficiently.
      children.forEach((child) => el.appendChild(child));

      return el;
    }

    /**
     * Creates and attaches navigation controls (arrows and pagination dots) for sections
     * that contain multiple slides. Ensures old controls are cleaned up before re-creation.
     * @private
     * @param {object} sectionData - The internal data object for the current section.
     */
    _setupSlides(sectionData) {
      // Exit early if the section doesn't have at least two slides.
      if (sectionData.slides.length < 2) return;

      // --- 1. Clean up existing controls (crucial for refresh robustness) ---

      // Define a utility function for repetitive cleanup logic
      const cleanupControl = (selector) => {
        const existing = sectionData.el.querySelector(selector);
        if (existing) existing.remove();
      };

      cleanupControl(".sr-arrow-left");
      cleanupControl(".sr-arrow-right");
      cleanupControl(".sr-slide-dots");

      // Reset references on the data object after cleanup
      sectionData.arrowLeft = null;
      sectionData.arrowRight = null;
      sectionData.slidePagination = null;

      // --- 2. Setup Slide Arrows ---

      if (this.opts.slideArrows) {
        // Create arrow elements
        sectionData.arrowLeft = this._createEl("button", {
          className: "sr-arrow sr-arrow-left",
          ariaLabel: "Previous slide",
        });
        sectionData.arrowRight = this._createEl("button", {
          className: "sr-arrow sr-arrow-right",
          ariaLabel: "Next slide",
        });

        // Add event listeners for navigation and debouncing (using arrow functions to retain 'this')
        const addArrowListener = (arrowEl, directionFn) => {
          arrowEl.addEventListener("click", () => {
            // Debounce: Prevents interaction during animation or if at the visual limit
            if (
              this._isAnimating ||
              arrowEl.classList.contains("sr-arrow-hidden")
            ) {
              return;
            }
            directionFn();
          });
        };

        addArrowListener(sectionData.arrowLeft, this.prevSlide.bind(this));
        addArrowListener(sectionData.arrowRight, this.nextSlide.bind(this));

        // Append arrows to the section element
        sectionData.el.append(sectionData.arrowLeft, sectionData.arrowRight);
      }

      // --- 3. Setup Slide Pagination Dots ---

      if (this.opts.slidePagination) {
        const dots = sectionData.slides.map((_, index) =>
          this._createEl("li", {}, [
            this._createEl("a", {
              className: "sr-slide-dot",
              "data-index": index,
            }),
          ])
        );

        // Create the pagination container (UL)
        sectionData.slidePagination = this._createEl(
          "ul",
          {
            className: `sr-slide-dots sr-slide-dots-${this.opts.slidePaginationPosition}`,
          },
          dots
        );

        // Add click listener for dot navigation
        sectionData.slidePagination.addEventListener("click", (e) => {
          const target = e.target.closest("[data-index]");
          if (!target) return;

          const index = parseInt(target.dataset.index, 10);
          if (!isNaN(index)) {
            // Ensure parsing was successful and index is valid
            this.goToSlide(index);
          }
        });

        // Append pagination to the section element
        sectionData.el.appendChild(sectionData.slidePagination);
      }
    }

    /**
     * Creates, attaches, and updates the main pagination dots for navigating between sections.
     * This method is idempotent: it cleans up or reuses existing containers efficiently.
     * @private
     */
    _createPagination() {
      // 1. Exit early and clean up if pagination is disabled or there are fewer than two sections.
      if (!this.opts.pagination || this.sections.length < 2) {
        this.paginationContainer?.remove();
        this.paginationContainer = null;
        this.log(
          "Pagination controls skipped (disabled or insufficient sections)."
        );
        return;
      }

      // 2. Create the main pagination container (UL) only if it doesn't exist yet.
      if (!this.paginationContainer) {
        this.paginationContainer = this._createEl("ul", {
          className: `sr-dots sr-dots-${this.opts.paginationPosition}`,
        });

        // Attach event listener to the container (using event delegation for efficiency)
        this.paginationContainer.addEventListener("click", (e) => {
          // Prevent default hash navigation if a hash exists
          e.preventDefault();

          const target = e.target.closest("[data-index]");
          if (!target) return;

          const index = parseInt(target.dataset.index, 10);

          // Ensure the index is valid before navigating.
          if (!isNaN(index)) {
            this.goToSection(index);
          }
        });

        // Append to the main container
        this.container.appendChild(this.paginationContainer);
        this.log("Main section pagination container created.");
      }

      // 3. Generate new dot elements based on current section data.
      const dots = this.sectionData.map((data, index) => {
        // Determine the label for accessibility and usability
        const label = data.title || `section ${index + 1}`;

        const link = this._createEl("a", {
          className: "sr-dot",
          "data-index": index,
          ariaLabel: `Go to ${label}`,
        });

        // Conditionally set the hash URL for deep linking
        if (data.hash) link.href = `#${data.hash}`;

        return this._createEl("li", {}, [link]);
      });

      // 4. Update the pagination container using the efficient replaceChildren API.
      // This is highly performant for updating lists.
      this.paginationContainer.replaceChildren(...dots);

      this.log(`Pagination updated with ${dots.length} dots.`);
    }

    /**
     * Reads the URL hash to determine the initial or current target section and slide.
     * Navigates to the identified target if it differs from the current position.
     * @private
     * @param {boolean} [isInitialLoad=false] - True if this is called during instance initialization.
     */
    _parseInitialHash(isInitialLoad = false) {
      const fullHash = window.location.hash.substring(1);
      let targetSectionIndex = 0;
      let targetSlideIndex = 0;

      if (fullHash) {
        this.log(`Attempting to parse URL hash: #${fullHash}`);

        // Split the hash using the configured separator (e.g., 'sectionHash/slideHash')
        const [sectionHash, slideHash] = fullHash.split(
          this.opts.hashSeparator
        );

        // --- 1. Find Section Index ---
        const foundSectionIndex = this.sectionData.findIndex(
          (data) => data.hash === sectionHash
        );

        if (foundSectionIndex !== -1) {
          targetSectionIndex = foundSectionIndex;

          // --- 2. Find Slide Index (if slideHash is present) ---
          if (slideHash) {
            const section = this.sectionData[targetSectionIndex];
            let foundSlideIndex = -1;

            // a) Try matching by slide hash (string)
            foundSlideIndex = section.slides.findIndex(
              (s) => s.hash === slideHash
            );

            // b) If hash match failed, try matching by slide number (1-based index)
            if (foundSlideIndex === -1) {
              const slideNum = parseInt(slideHash, 10);

              if (
                !isNaN(slideNum) &&
                slideNum > 0 &&
                slideNum <= section.slides.length
              ) {
                // Convert 1-based number (slideNum) to 0-based index
                foundSlideIndex = slideNum - 1;
              }
            }

            // Assign the found index, defaulting to 0 if no slide was matched
            targetSlideIndex = foundSlideIndex !== -1 ? foundSlideIndex : 0;
          }
        } else {
          this.log(`Section hash '${sectionHash}' not found.`);
        }
      }

      // --- 3. Navigate only if necessary ---
      const currentSlideIndex =
        this.currentSlideIndices[targetSectionIndex] || 0;

      const shouldNavigate =
        isInitialLoad ||
        this.currentIndex !== targetSectionIndex ||
        currentSlideIndex !== targetSlideIndex;

      if (shouldNavigate) {
        this.log(
          `Navigating to target section ${targetSectionIndex}, slide ${targetSlideIndex}.`
        );

        // Update internal state
        this.currentIndex = targetSectionIndex;
        this.currentSlideIndices[targetSectionIndex] = targetSlideIndex;

        // Apply changes to the DOM and UI controls
        // Using `_updateActiveElements` ensures that the position is set without animation.
        this._updateActiveElements();
      } else {
        this.log("Hash matches current position; no navigation required.");
      }
    }

    /**
     * Handles the 'hashchange' window event. Re-parses the URL hash
     * to navigate the user to the corresponding section/slide.
     * @private
     */
    _handleHashChange() {
      this._parseInitialHash();
    }

    /**
     * Checks if a given DOM element is an editable input field (e.g., input, textarea, or contenteditable).
     * This prevents navigation events (like keydown) from firing when the user is typing.
     * @private
     * @param {HTMLElement|null} target - The DOM element to check.
     * @returns {boolean} True if the element is editable; otherwise, false.
     */
    _isEditableTarget(target) {
      // Use a null check for robustness.
      if (!target) return false;

      // Prioritize checking the `isContentEditable` property.
      if (target.isContentEditable) return true;

      // Check against a predefined set of tags (EDITABLE_TAGS).
      // Tag names must be converted to uppercase for consistent comparison.
      return EDITABLE_TAGS.has(target.tagName);
    }

    /**
     * Checks if the event originated from within a scrollable child element.
     * This is crucial for preventing unwanted section/slide transitions when
     * the user is scrolling content inside a nested element (e.g., a modal or a div with overflow).
     * @private
     * @param {HTMLElement|null} target - The starting DOM element (where the event originated).
     * @param {number} deltaY - The direction of the scroll (positive for down, negative for up).
     * @returns {boolean} True if a scrollable ancestor is found and is not at its scroll limit; otherwise, false.
     */
    _hasScrollableAncestor(target, deltaY) {
      let el = target;

      // Traverse up the DOM tree until the SnapRoll container is reached.
      while (el && el !== this.container) {
        const style = window.getComputedStyle(el);
        const hasScrollbar =
          style.overflowY === "auto" || style.overflowY === "scroll";

        if (hasScrollbar) {
          // Calculate scroll limits
          const isAtTop = el.scrollTop <= 0;
          // Use tolerance of 1px for bottom calculation due to floating point inaccuracies
          const isAtBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight <= 1;

          // Determine if there is still room to scroll in the current direction (deltaY)
          const canScrollDown = deltaY > 0 && !isAtBottom;
          const canScrollUp = deltaY < 0 && !isAtTop;

          if (canScrollDown || canScrollUp) {
            this.log(
              "Ignoring scroll event: Found active scrollable ancestor.",
              el
            );
            return true;
          }
        }
        el = el.parentElement;
      }

      return false;
    }

    /**
     * Handles the 'keydown' event for keyboard navigation.
     * Prevents navigation if an animation is in progress or if the user is typing in an editable field.
     * @private
     * @param {KeyboardEvent} e - The keyboard event object.
     */
    _onKeyDown(e) {
      // Exit immediately if animating or interacting with an input/editable field.
      if (this._isAnimating || this._isEditableTarget(e.target)) return;

      const keyMap = {
        // Navigate Next
        ArrowDown: this.next.bind(this),
        PageDown: this.next.bind(this),
        " ": this.next.bind(this), // Spacebar
        // Navigate Previous
        ArrowUp: this.prev.bind(this),
        PageUp: this.prev.bind(this),
        // Navigate to Start/End Sections
        Home: () => this.goToSection(0),
        End: () => this.goToSection(this.sections.length - 1),
      };

      const action = keyMap[e.key];

      if (action) {
        this.log(`Keyboard key pressed: ${e.key}. Navigating.`);
        e.preventDefault();
        action();
      }
    }

    /**
     * Handles the 'wheel' event for scroll navigation. Implements a debouncing logic
     * to ensure that a single, continuous scroll gesture only triggers one transition.
     * @private
     * @param {WheelEvent} e - The wheel event object.
     */
    _onWheel(e) {
      // Store the absolute deltaY for cleaner checks.
      const absDeltaY = Math.abs(e.deltaY);

      // 1. Exit if animating, scroll movement is too small, or scroll is internal to a child element.
      if (
        this._isAnimating ||
        absDeltaY < this.opts.wheelDeltaThreshold ||
        this._hasScrollableAncestor(e.target, e.deltaY)
      ) {
        return;
      }

      // Prevent default page scroll behavior.
      e.preventDefault();

      // 2. Debouncing logic: Only trigger navigation if a gesture is NOT already in progress.
      // The logic is: "If the timeout is NOT set, this is the start of a new gesture, so navigate."
      if (!this._wheelGestureTimeout) {
        this.log(
          `Wheel event detected (Delta: ${e.deltaY}). Triggering navigation.`
        );
        e.deltaY > 0 ? this.next() : this.prev();
      }

      // 3. Reset the timeout with every wheel event within the gesture.
      // This extends the gesture and prevents a new navigation event until the user stops scrolling.
      clearTimeout(this._wheelGestureTimeout);
      this._wheelGestureTimeout = setTimeout(() => {
        this.log("Wheel gesture timeout reached. Ready for next gesture.");
        this._wheelGestureTimeout = null;
      }, this.opts.wheelGestureEndDelay);
    }

    /**
     * Captures the starting coordinates of the first touch point.
     * This is the beginning of a potential swipe gesture.
     * @private
     * @param {TouchEvent} e - The touch event object.
     */
    _onTouchStart(e) {
      // Only register the start point if no animation is currently running.
      if (this._isAnimating) return;

      // Ensure touches array exists and has at least one entry.
      if (e.touches && e.touches.length > 0) {
        this._touchStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    }

    /**
     * Calculates the direction and magnitude of the swipe gesture upon touch release.
     * Triggers section navigation (vertical swipe) or slide navigation (horizontal swipe).
     * @private
     * @param {TouchEvent} e - The touch event object.
     */
    _onTouchEnd(e) {
      // Exit if animating or if a start point was never registered (e.g., failed capture or multi-touch issue).
      if (this._isAnimating || this._touchStart.x === null) return;

      // 1. Calculate the distance and direction of the swipe.
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const delta = {
        x: this._touchStart.x - endX, // Positive X = swipe left (next slide)
        y: this._touchStart.y - endY, // Positive Y = swipe up (next section)
      };

      // Reset the starting coordinates to null immediately after calculation.
      this._touchStart = { x: null, y: null };

      const absDeltaX = Math.abs(delta.x);
      const absDeltaY = Math.abs(delta.y);

      // 2. Determine Dominant Direction (Vertical vs. Horizontal)
      if (absDeltaY > absDeltaX) {
        // --- Vertical Swipe (Section/Global Navigation) ---

        if (
          absDeltaY > this.opts.touchThreshold &&
          !this._hasScrollableAncestor(e.target, delta.y)
        ) {
          this.log(
            `Vertical swipe detected (DeltaY: ${delta.y}). Navigating section.`
          );
          delta.y > 0 ? this.next() : this.prev();
        }
      } else {
        // --- Horizontal Swipe (Slide Navigation) ---

        // Check if the current section has more than one slide to justify horizontal navigation.
        const currentSectionHasSlides =
          this.sectionData[this.currentIndex]?.slides.length > 1;

        if (absDeltaX > this.opts.touchThreshold && currentSectionHasSlides) {
          this.log(
            `Horizontal swipe detected (DeltaX: ${delta.x}). Navigating slide.`
          );
          delta.x > 0 ? this.nextSlide() : this.prevSlide();
        }
      }
    }

    /**
     * Navigates to the next slide if the current section has more slides,
     * otherwise attempts to navigate to the next section.
     * @public
     */
    next() {
      const currentSectionData = this.sectionData[this.currentIndex];
      // Use optional chaining and nullish coalescing for safe access
      const slideIndex = this.currentSlideIndices[this.currentIndex] ?? 0;
      const slidesSize = currentSectionData?.slides.length ?? 0;

      // Prioritize slide navigation if not on the last slide
      if (slidesSize > 1 && slideIndex < slidesSize - 1) {
        this.log("Next: Navigating to next slide.");
        this.nextSlide();
      } else {
        this.log("Next: End of slides reached, attempting next section.");
        this.nextSection();
      }
    }

    /**
     * Navigates to the previous slide if the current section is not at the first slide,
     * otherwise attempts to navigate to the previous section.
     * @public
     */
    prev() {
      const currentSectionData = this.sectionData[this.currentIndex];
      const slideIndex = this.currentSlideIndices[this.currentIndex] ?? 0;
      const slidesSize = currentSectionData?.slides.length ?? 0;

      // Prioritize slide navigation if not on the first slide
      if (slidesSize > 1 && slideIndex > 0) {
        this.log("Prev: Navigating to previous slide.");
        this.prevSlide();
      } else {
        this.log("Prev: Start of slides reached, attempting previous section.");
        this.prevSection();
      }
    }

    /**
     * Calculates and navigates to the next available section index,
     * respecting the loop option.
     * @public
     */
    nextSection() {
      const totalSections = this.sections.length;
      const nextIndex = this.currentIndex + 1;
      let targetIndex;

      // Check if moving to the next section is possible
      if (nextIndex < totalSections) {
        targetIndex = nextIndex;
      }
      // Check if looping to the first section is allowed
      else if (this.opts.loop) {
        targetIndex = 0;
      }
      // Stay on the current section (limit reached without loop)
      else {
        targetIndex = this.currentIndex;
      }

      this.log(`Navigating to next section. Target index: ${targetIndex}`);
      this.goToSection(targetIndex);
    }

    /**
     * Calculates and navigates to the previous available section index,
     * respecting the loop option.
     * @public
     */
    prevSection() {
      const totalSections = this.sections.length;
      const prevIndex = this.currentIndex - 1;
      let targetIndex;

      // Check if moving to the previous section is possible
      if (prevIndex >= 0) {
        targetIndex = prevIndex;
      }
      // Check if looping to the last section is allowed
      else if (this.opts.loop) {
        targetIndex = totalSections - 1;
      }
      // Stay on the current section (limit reached without loop)
      else {
        targetIndex = this.currentIndex;
      }

      this.log(`Navigating to previous section. Target index: ${targetIndex}`);
      // The 'true' argument (isReverse) is important for transition direction/history management.
      this.goToSection(targetIndex, true);
    }

    /**
     * Navigates the current section to the next slide, if one exists.
     * Does not wrap around (loop) slides.
     * @public
     */
    nextSlide() {
      const section = this.sectionData[this.currentIndex];

      // Ensure the section data exists before proceeding.
      if (!section) {
        this.log("nextSlide: Current section data is missing.");
        return;
      }

      // Use nullish coalescing for safe default value.
      const slideIndex = this.currentSlideIndices[this.currentIndex] ?? 0;
      const slidesCount = section.slides.length;

      // Navigate if the current slide is not the last one.
      if (slideIndex < slidesCount - 1) {
        this.log(`Navigating slide from ${slideIndex} to ${slideIndex + 1}.`);
        this.goToSlide(slideIndex + 1);
      } else {
        this.log("nextSlide: Already on the last slide.");
      }
    }

    /**
     * Navigates the current section to the previous slide, if one exists.
     * Does not wrap around (loop) slides.
     * @public
     */
    prevSlide() {
      const section = this.sectionData[this.currentIndex];

      // Ensure the section data exists before proceeding.
      if (!section) {
        this.log("prevSlide: Current section data is missing.");
        return;
      }

      // Use nullish coalescing for safe default value.
      const slideIndex = this.currentSlideIndices[this.currentIndex] ?? 0;

      // Navigate if the current slide is not the first one.
      if (slideIndex > 0) {
        this.log(`Navigating slide from ${slideIndex} to ${slideIndex - 1}.`);
        this.goToSlide(slideIndex - 1);
      } else {
        this.log("prevSlide: Already on the first slide.");
      }
    }

    /**
     * Alias for goToSection(). Navigates to a specific section index.
     * @public
     * @param {number} index - The zero-based index of the target section.
     */
    scrollTo(index) {
      this.goToSection(index);
    }

    /**
     * Navigates to a specific section, handling animation debouncing and initial slide selection.
     * This is the core navigation function for sections.
     * @public
     * @param {number} index - The zero-based index of the section to navigate to.
     * @param {boolean} [isReverse=false] - True if navigating in the reverse direction (e.g., from prevSection). Used to determine the target slide.
     */
    goToSection(index, isReverse = false) {
      // 1. Debounce check: Prevent navigation if an animation is already in progress.
      if (this._isAnimating) {
        this.log("goToSection blocked: Animation is in progress.");
        return;
      }

      // 2. Bound Check: Prevent navigation if the index is outside the valid range (redundant check if next/prevSection is robust, but safe).
      if (index < 0 || index >= this.sections.length) {
        this.log(`goToSection blocked: Index ${index} is out of bounds.`);
        return;
      }

      // 3. Prevent unnecessary re-navigation if already at the target section.
      // Note: Only skips if the initial slide index would also be the same (0 or last slide).
      if (index === this.currentIndex) {
        this.log(`goToSection skipped: Already on section ${index}.`);
        return;
      }

      this.log(`Navigating section from ${this.currentIndex} to ${index}.`);

      // Start animation debounce
      this._isAnimating = true;
      this.currentIndex = index;
      const section = this.sectionData[index];

      // 4. Set initial slide index based on navigation direction (prev/reverse).
      const targetSlideIndex =
        isReverse && section?.slides.length > 0
          ? section.slides.length - 1 // Start on the last slide if navigating in reverse
          : 0; // Default to the first slide

      this.currentSlideIndices[index] = targetSlideIndex;

      // 5. Apply changes to the DOM (scroll to position, update classes/UI)
      this._updateActiveElements();

      // 6. End animation debounce after the transition timeout
      setTimeout(() => {
        this._isAnimating = false;
        this.log("Section transition complete. Animation reset.");
      }, this.opts.scrollTimeout);
    }

    /**
     * Navigates to a specific slide within the current section, handling animation debouncing.
     * This is the core navigation function for slides.
     * @public
     * @param {number} index - The zero-based index of the target slide.
     */
    goToSlide(index) {
      const section = this.sectionData[this.currentIndex];
      const currentSlideIndex =
        this.currentSlideIndices[this.currentIndex] ?? 0;

      // 1. Pre-checks: Exit if animating or section data is missing.
      if (this._isAnimating) {
        this.log("goToSlide blocked: Animation is in progress.");
        return;
      }
      if (!section) {
        this.log("goToSlide blocked: Current section data is missing.");
        return;
      }

      // 2. Bound Check: Prevent navigation if the index is out of bounds or the same as the current.
      if (index < 0 || index >= section.slides.length) {
        this.log(
          `goToSlide blocked: Slide index ${index} is out of bounds (0-${
            section.slides.length - 1
          }).`
        );
        return;
      }
      if (index === currentSlideIndex) {
        this.log(`goToSlide skipped: Already on slide ${index}.`);
        return;
      }

      this.log(`Navigating slide from ${currentSlideIndex} to ${index}.`);

      // 3. Start animation debounce and update state
      this._isAnimating = true;
      this.currentSlideIndices[this.currentIndex] = index;

      // 4. Apply changes to the DOM (horizontal transform, update classes/UI)
      this._updateActiveSlide();

      // 5. End animation debounce after the transition timeout
      setTimeout(() => {
        this._isAnimating = false;
        this.log("Slide transition complete. Animation reset.");
      }, this.opts.slideScrollTimeout);
    }

    /**
     * Updates the URL hash in the browser's history without triggering a page reload.
     * The hash format includes both the section hash and, optionally, the slide hash.
     * @private
     */
    _updateURLHash() {
      const section = this.sectionData[this.currentIndex];

      // Exit if the current section doesn't have a hash defined (no deep linking possible).
      if (!section || !section.hash) return;

      const slideIndex = this.currentSlideIndices[this.currentIndex] ?? 0;
      let newHash = `#${section.hash}`;

      // Conditionally append the slide hash if the section has multiple slides.
      if (section.slides.length > 1) {
        const slide = section.slides[slideIndex];

        // Only append slide hash if the slide object exists and has a hash value
        if (slide?.hash) {
          newHash += this.opts.hashSeparator + slide.hash;
        }
      }

      // Use history.replaceState to update the URL without adding a new history entry.
      if (window.location.hash !== newHash) {
        this.log(`Updating URL hash: ${newHash}`);
        history.replaceState(null, "", newHash);
      } else {
        this.log("URL hash is already current.");
      }
    }

    /**
     * Updates all visual elements (classes, page title, main pagination)
     * to reflect the currently active section (this.currentIndex).
     * @private
     */
    _updateActiveElements() {
      // 1. Update Section Classes (Active and Previous)
      this.sections.forEach((section, i) => {
        // Optimization: Use a single classList.remove() for both classes
        section.classList.remove(this.opts.activeClass, this.opts.prevClass);

        if (i < this.currentIndex) {
          // Apply class for sections that are visually 'above' the current one
          section.classList.add(this.opts.prevClass);
        } else if (i === this.currentIndex) {
          // Apply the active class
          section.classList.add(this.opts.activeClass);
        }
        // Optimization: No 'else' needed here, as classes are removed first.
      });

      // 2. Update Slide-Specific Elements (Delegated to separate method)
      this._updateActiveSlide();

      // 3. Update Page Title (Document Title)
      const sectionData = this.sectionData[this.currentIndex];
      if (sectionData?.title) {
        const newTitle = this.opts.pageTitle
          ? `${sectionData.title} - ${this.opts.pageTitle}` // Combine with optional base title
          : sectionData.title;

        // Update only if the title actually changes
        if (document.title !== newTitle) {
          document.title = newTitle;
        }
      }

      // 4. Update Main Pagination Dots
      // Use a nullish check for safety, and use querySelectorAll on the container
      // if `childNodes` is not iterable or contains unexpected nodes (like text nodes).
      this.paginationContainer
        ?.querySelectorAll(".sr-dot")
        ?.forEach((dotLink, i) =>
          dotLink.classList.toggle("sr-dot-active", i === this.currentIndex)
        );
    }

    /**
     * Updates all visual elements (classes, arrows, slide pagination)
     * within the current section to reflect the active slide index.
     * @private
     */
    _updateActiveSlide() {
      const section = this.sectionData[this.currentIndex];
      if (!section) return; // Exit if the section data is not available.

      const slideIndex = this.currentSlideIndices[this.currentIndex] ?? 0;
      const slides = section.slides;
      const slidesCount = slides.length;

      // 1. Update Slide Classes (Active and Previous)
      if (slidesCount > 0) {
        slides.forEach((slide, i) => {
          // Optimization: Use a single classList.remove()
          slide.el.classList.remove(
            this.opts.slideActiveClass,
            this.opts.slidePrevClass
          );

          if (i < slideIndex) {
            slide.el.classList.add(this.opts.slidePrevClass);
          } else if (i === slideIndex) {
            slide.el.classList.add(this.opts.slideActiveClass);
          }
        });

        // 2. Toggle Slide Arrows visibility (Debounce limits)
        // Removed console.log for clean code
        const isAtStart = slideIndex === 0;
        const isAtEnd = slideIndex === slidesCount - 1;

        // Use nullish chaining and direct class manipulation
        section.arrowLeft?.classList.toggle("sr-arrow-hidden", isAtStart);
        section.arrowRight?.classList.toggle("sr-arrow-hidden", isAtEnd);

        // 3. Update Slide Pagination Dots
        section.slidePagination
          ?.querySelectorAll(".sr-slide-dot")
          ?.forEach((dotLink, i) =>
            dotLink.classList.toggle("sr-slide-dot-active", i === slideIndex)
          );
      }

      // 4. Update URL Hash
      this._updateURLHash();
    }
  }

  /**
   * Automatically initializes SnapRoll instances on all elements in the DOM
   * that have the 'data-snaproll' attribute defined.
   * @private
   */
  function autoInit() {
    document.querySelectorAll("[data-snaproll]").forEach((el) => {
      // 1. Skip if the instance is already attached (prevents re-initialization)
      if (el.__snaproll_instance) return;

      try {
        const opts = { container: el };

        // 2. Iterate through all data attributes on the element
        for (const key in el.dataset) {
          // Convert data-attribute-key to JavaScript option key (e.g., 'data-sr-loop' to 'srLoop')
          const camelCaseKey = key.replace(/-(\w)/g, (_, c) => c.toUpperCase());

          // 3. Process only valid options, excluding 'slideHashes' (too complex for data attributes)
          if (camelCaseKey in DEFAULTS && camelCaseKey !== "slideHashes") {
            let val = el.dataset[key];

            // --- Type Conversion Logic ---

            // Convert string "true" / "false" to Boolean
            if (val === "true") {
              val = true;
            } else if (val === "false") {
              val = false;
            }
            // Convert comma-separated string to Array
            else if (camelCaseKey === "sectionTitles") {
              val = val.split(",").map((s) => s.trim());
            }
            // Convert strings that represent valid numbers
            else if (!isNaN(Number(val)) && val.trim() !== "") {
              val = Number(val);
            }

            // 4. Assign the processed value to the options object
            opts[camelCaseKey] = val;
          }
        }

        // 5. Create and store the new instance
        el.__snaproll_instance = new SnapRoll(opts);
      } catch (err) {
        // Log errors gracefully without interrupting other initializations
        console.warn(`[SnapRoll] Auto-init failed on element: ${err.message}`);
      }
    });
  }

  // Expose the SnapRoll class to the global scope (e.g., window object)
  global.SnapRoll = SnapRoll;

  // Auto-initialization on load: Check if the DOM is already ready.
  document.readyState === "loading"
    ? // If still loading, wait for the DOMContentLoaded event
      document.addEventListener("DOMContentLoaded", autoInit)
    : // If already loaded (or interactive/complete), run autoInit immediately
      autoInit();
})(window);
