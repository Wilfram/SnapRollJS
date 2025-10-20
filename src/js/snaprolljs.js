/**
 * @file snaproll.js
 * @author [Wil]
 * @version 2.0.0
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
     * Initializes a new SnapRoll instance.
     * @param {SnapRollOptions} [options={}] - Configuration options to override the defaults.
     */
    constructor(options = {}) {
      this.opts = { ...DEFAULTS, ...options };
      this.container =
        typeof this.opts.container === "string"
          ? document.querySelector(this.opts.container)
          : this.opts.container;
      if (!this.container)
        throw new Error(
          `SnapRoll: Container not found (${this.opts.container})`
        );

      this._validateOptions(this.opts);

      this.sectionData = [];
      this.sections = [];
      this.currentIndex = 0;
      this.currentSlideIndices = {};
      this._isAnimating = false;
      this._touchStart = { x: null, y: null };
      this._wheelGestureTimeout = null;
      this.paginationContainer = null;

      this.listeners = [
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
      this.init();
    }

    log(...args) {
      if (this.opts.debug) console.log("[SnapRoll]", ...args);
    }

    _validateOptions(opts) {
      if (opts.sectionTitles && !Array.isArray(opts.sectionTitles))
        console.warn(
          `[SnapRoll] Config warning: 'sectionTitles' should be an array.`
        );
      if (
        opts.slideHashes &&
        (typeof opts.slideHashes !== "object" ||
          Array.isArray(opts.slideHashes))
      )
        console.warn(
          `[SnapRoll] Config warning: 'slideHashes' should be an object (e.g., { 1: ['hash1'] }).`
        );
    }

    /**
     * Initializes the instance, builds the internal data structure, and attaches event listeners.
     * @public
     */
    init() {
      this.refresh();
      if (this.sectionData.length === 0) return;
      this._parseInitialHash(true);
      this._toggleEventListeners(true);
    }

    /**
     * Re-scans the DOM and re-initializes the instance. Useful after dynamic DOM changes.
     * @public
     */
    refresh() {
      this.sectionData = Array.from(
        this.container.querySelectorAll(this.opts.sectionSelector)
      ).map((el, index) => {
        // Determine section animation. Priority: data-attr > JS option > default
        const sectionAnim =
          el.dataset.srSectionAnimation || this.opts.sectionAnimation;
        if (sectionAnim !== "slide") el.classList.add(`sr-anim-${sectionAnim}`);

        const slides = Array.from(
          el.querySelectorAll(this.opts.slideSelector)
        ).map((slideEl, slideIndex) => {
          // Determine slide animation. Priority: slide data-attr > section data-attr > JS option > default
          const slideAnim =
            slideEl.dataset.srSlideAnimation ||
            el.dataset.srSlideAnimation ||
            this.opts.slideAnimation;
          if (slideAnim !== "slide")
            slideEl.classList.add(`sr-slide-anim-${slideAnim}`);
          return {
            el: slideEl,
            index: slideIndex,
            hash:
              this.opts.slideHashes[index]?.[slideIndex] ||
              slideEl.dataset.srHash ||
              slideEl.id ||
              (slideIndex + 1).toString(),
          };
        });

        if (slides.length > 0) el.classList.add("sr-has-slides");

        const data = {
          el,
          index,
          slides,
          hash: el.dataset.srHash || el.id || null,
          title: this.opts.sectionTitles[index] || el.dataset.srTitle || null,
          slidePagination: null,
          arrowLeft: null,
          arrowRight: null,
        };
        this.currentSlideIndices[index] = 0;
        this._setupSlides(data);
        return data;
      });
      this.sections = this.sectionData.map((data) => data.el);
      this._createPagination();
    }

    /**
     * Destroys the instance, removing all event listeners and UI elements.
     * @public
     */
    destroy() {
      this._toggleEventListeners(false);
      this.container.innerHTML = this.container.innerHTML;
      this.paginationContainer?.remove();
      this.log("SnapRoll instance destroyed.");
    }

    /**
     * Adds or removes all core event listeners.
     * @param {boolean} add - If true, adds listeners; otherwise, removes them.
     * @private
     */
    _toggleEventListeners(add) {
      const action = add ? "addEventListener" : "removeEventListener";
      this.listeners.forEach(({ target, event, handler, options }) => {
        if (event === "keydown" && !this.opts.keyboard) return;
        target[action](event, handler, options);
      });
    }

    /**
     * Utility to create a DOM element.
     * @returns {HTMLElement} The created element.
     * @private
     */
    _createEl(
      tag,
      { className, ariaLabel, "data-index": dataIndex } = {},
      children = []
    ) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (ariaLabel) el.setAttribute("aria-label", ariaLabel);
      if (dataIndex !== undefined) el.dataset.index = dataIndex;
      children.forEach((child) => el.appendChild(child));
      return el;
    }

    /**
     * Creates and attaches navigation controls for slides.
     * @param {object} sectionData - The internal data object for the section.
     * @private
     */
    _setupSlides(sectionData) {
      if (sectionData.slides.length < 2) return;
      if (this.opts.slideArrows) {
        sectionData.arrowLeft = this._createEl("button", {
          className: "sr-arrow sr-arrow-left",
          ariaLabel: "Previous slide",
        });
        sectionData.arrowRight = this._createEl("button", {
          className: "sr-arrow sr-arrow-right",
          ariaLabel: "Next slide",
        });
        sectionData.el.addEventListener("click", (e) => {
          if (e.target === sectionData.arrowLeft) this.prevSlide();
          if (e.target === sectionData.arrowRight) this.nextSlide();
        });
        sectionData.el.append(sectionData.arrowLeft, sectionData.arrowRight);
      }
      if (this.opts.slidePagination) {
        const dots = sectionData.slides.map((_, index) =>
          this._createEl("li", {}, [
            this._createEl("a", {
              className: "sr-slide-dot",
              "data-index": index,
            }),
          ])
        );
        sectionData.slidePagination = this._createEl(
          "ul",
          {
            className: `sr-slide-dots sr-slide-dots-${this.opts.slidePaginationPosition}`,
          },
          dots
        );
        sectionData.slidePagination.addEventListener("click", (e) => {
          const index = e.target.dataset.index;
          if (index) this.goToSlide(parseInt(index, 10));
        });
        sectionData.el.appendChild(sectionData.slidePagination);
      }
    }

    /**
     * Creates the main pagination dots for sections.
     * @private
     */
    _createPagination() {
      if (!this.opts.pagination || this.sections.length < 2) {
        this.paginationContainer?.remove();
        this.paginationContainer = null;
        return;
      }
      if (!this.paginationContainer) {
        this.paginationContainer = this._createEl("ul", {
          className: `sr-dots sr-dots-${this.opts.paginationPosition}`,
        });
        this.paginationContainer.addEventListener("click", (e) => {
          e.preventDefault();
          const index = e.target.dataset.index;
          if (index) this.goToSection(parseInt(index, 10));
        });
        this.container.appendChild(this.paginationContainer);
      }
      const dots = this.sectionData.map((data, index) => {
        const link = this._createEl("a", {
          className: "sr-dot",
          "data-index": index,
          ariaLabel: `Go to ${data.title || `section ${index + 1}`}`,
        });
        if (data.hash) link.href = `#${data.hash}`;
        return this._createEl("li", {}, [link]);
      });
      this.paginationContainer.replaceChildren(...dots);
    }

    /**
     * Parses the URL hash to determine the initial section and slide.
     * @private
     */
    _parseInitialHash(isInitialLoad = false) {
      const hash = window.location.hash.substring(1);
      let targetSectionIndex = 0,
        targetSlideIndex = 0;

      if (hash) {
        const [sectionHash, slideHash] = hash.split(this.opts.hashSeparator);
        const foundSectionIndex = this.sectionData.findIndex(
          (data) => data.hash === sectionHash
        );
        if (foundSectionIndex !== -1) {
          targetSectionIndex = foundSectionIndex;
          if (slideHash) {
            const section = this.sectionData[targetSectionIndex];
            let foundSlideIndex = section.slides.findIndex(
              (s) => s.hash === slideHash
            );
            if (foundSlideIndex === -1) {
              const slideNum = parseInt(slideHash, 10);
              if (
                !isNaN(slideNum) &&
                slideNum > 0 &&
                slideNum <= section.slides.length
              )
                foundSlideIndex = slideNum - 1;
            }
            targetSlideIndex = foundSlideIndex !== -1 ? foundSlideIndex : 0;
          }
        }
      }

      if (
        isInitialLoad ||
        this.currentIndex !== targetSectionIndex ||
        this.currentSlideIndices[targetSectionIndex] !== targetSlideIndex
      ) {
        this.currentIndex = targetSectionIndex;
        this.currentSlideIndices[targetSectionIndex] = targetSlideIndex;
        this._updateActiveElements();
      }
    }

    _handleHashChange() {
      this._parseInitialHash();
    }
    _isEditableTarget(target) {
      return (
        target &&
        (target.isContentEditable || EDITABLE_TAGS.has(target.tagName))
      );
    }
    _hasScrollableAncestor(target, deltaY) {
      let el = target;
      while (el && el !== this.container) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          const isAtTop = el.scrollTop < 1;
          const isAtBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 1;
          if ((deltaY > 0 && !isAtBottom) || (deltaY < 0 && !isAtTop))
            return true;
        }
        el = el.parentElement;
      }
      return false;
    }

    _onKeyDown(e) {
      if (this._isAnimating || this._isEditableTarget(e.target)) return;
      const keyMap = {
        ArrowDown: () => this.next(),
        PageDown: () => this.next(),
        " ": () => this.next(),
        ArrowUp: () => this.prev(),
        PageUp: () => this.prev(),
        Home: () => this.goToSection(0),
        End: () => this.goToSection(this.sections.length - 1),
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        keyMap[e.key]();
      }
    }

    _onWheel(e) {
      if (
        this._isAnimating ||
        Math.abs(e.deltaY) < this.opts.wheelDeltaThreshold ||
        this._hasScrollableAncestor(e.target, e.deltaY)
      )
        return;
      e.preventDefault();
      clearTimeout(this._wheelGestureTimeout);
      if (!this._wheelGestureTimeout) e.deltaY > 0 ? this.next() : this.prev();
      this._wheelGestureTimeout = setTimeout(() => {
        this._wheelGestureTimeout = null;
      }, this.opts.wheelGestureEndDelay);
    }

    _onTouchStart(e) {
      if (!this._isAnimating)
        this._touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    _onTouchEnd(e) {
      if (this._isAnimating || this._touchStart.x === null) return;
      const delta = {
        x: this._touchStart.x - e.changedTouches[0].clientX,
        y: this._touchStart.y - e.changedTouches[0].clientY,
      };
      this._touchStart = { x: null, y: null };

      if (Math.abs(delta.y) > Math.abs(delta.x)) {
        if (
          Math.abs(delta.y) > this.opts.touchThreshold &&
          !this._hasScrollableAncestor(e.target, delta.y)
        )
          delta.y > 0 ? this.next() : this.prev();
      } else {
        if (
          Math.abs(delta.x) > this.opts.touchThreshold &&
          this.sectionData[this.currentIndex]?.slides.length > 1
        )
          delta.x > 0 ? this.nextSlide() : this.prevSlide();
      }
    }

    /**
     * Navigates to the next slide or section.
     * @public
     */
    next() {
      const section = this.sectionData[this.currentIndex];
      const slideIndex = this.currentSlideIndices[this.currentIndex];
      const slidesSize = section?.slides.length || 0;

      if (this.opts.debug)
        console.log(section, slideIndex, section?.slides.length);

      slidesSize > 1 && slideIndex < slidesSize - 1
        ? this.nextSlide(slidesSize)
        : this.nextSection();
    }

    /**
     * Navigates to the previous slide or section.
     * @public
     */
    prev() {
      const section = this.sectionData[this.currentIndex];
      const slideIndex = this.currentSlideIndices[this.currentIndex];

      if (this.opts.debug)
        console.log(section, slideIndex, section?.slides.length);

      section?.slides.length > 1 && slideIndex > 0
        ? this.prevSlide()
        : this.prevSection();
    }

    nextSection() {
      this.goToSection(
        this.sections.length > this.currentIndex + 1
          ? this.currentIndex + 1
          : this.opts.loop
          ? 0
          : this.currentIndex
      );
    }

    prevSection() {
      this.goToSection(
        this.currentIndex - 1 >= 0
          ? this.currentIndex - 1
          : this.opts.loop
          ? this.sections.length - 1
          : 0,
        true
      );
    }
    nextSlide(slidesSize) {
      this.goToSlide(
        slidesSize > this.currentSlideIndices[this.currentIndex] + 1
          ? this.currentSlideIndices[this.currentIndex] + 1
          : this.currentSlideIndices[this.currentIndex]
      );
    }
    prevSlide() {
      this.goToSlide(
        this.currentSlideIndices[this.currentIndex] - 1 >= 0
          ? this.currentSlideIndices[this.currentIndex] - 1
          : 0
      );
    }

    /** @param {number} index - The zero-based index of the section. */
    scrollTo(index) {
      this.goToSection(index);
    }

    /**
     * Navigates to a specific section.
     * @param {number} index - The zero-based index of the section.
     * @param {boolean} [landOnLastSlide=false] - If true, activates the last slide of the target section.
     * @public
     */
    goToSection(index, landOnLastSlide = false) {
      if (this._isAnimating) return;
      this._isAnimating = true;
      this.currentIndex = index;
      const section = this.sectionData[index];
      this.currentSlideIndices[index] =
        landOnLastSlide && section?.slides.length > 0
          ? section.slides.length - 1
          : 0;
      this._updateActiveElements();
      setTimeout(() => {
        this._isAnimating = false;
      }, this.opts.scrollTimeout);
    }

    /**
     * Navigates to a specific slide within the current section.
     * @param {number} index - The zero-based index of the slide.
     * @public
     */
    goToSlide(index) {
      const section = this.sectionData[this.currentIndex];
      if (this._isAnimating || !section) return;
      this._isAnimating = true;
      this.currentSlideIndices[this.currentIndex] = index;
      this._updateActiveSlide();
      setTimeout(() => {
        this._isAnimating = false;
      }, this.opts.slideScrollTimeout);
    }

    /**
     * Updates the URL hash based on the current active section and slide.
     * @private
     */
    _updateURLHash() {
      const section = this.sectionData[this.currentIndex];
      if (!section?.hash) return;
      let newHash = "#" + section.hash;
      if (section.slides.length > 1) {
        const slide =
          section.slides[this.currentSlideIndices[this.currentIndex] || 0];
        if (slide) newHash += this.opts.hashSeparator + slide.hash;
      }
      if (window.location.hash !== newHash)
        history.replaceState(null, "", newHash);
    }

    /**
     * Updates all active state classes and UI elements for the current section.
     * @private
     */
    _updateActiveElements() {
      this.sections.forEach((section, i) => {
        section.classList.remove(this.opts.activeClass, this.opts.prevClass);
        if (i < this.currentIndex) section.classList.add(this.opts.prevClass);
        else if (i === this.currentIndex)
          section.classList.add(this.opts.activeClass);
      });
      this._updateActiveSlide();

      const sectionData = this.sectionData[this.currentIndex];
      if (sectionData?.title)
        document.title = this.opts.pageTitle
          ? `${sectionData.title} - ${this.opts.pageTitle}`
          : sectionData.title;

      this.paginationContainer?.childNodes.forEach((dot, i) =>
        dot.firstChild.classList.toggle(
          "sr-dot-active",
          i === this.currentIndex
        )
      );
    }

    /**
     * Updates active state classes for slides within the current section.
     * @private
     */
    _updateActiveSlide() {
      const section = this.sectionData[this.currentIndex];
      const slideIndex = this.currentSlideIndices[this.currentIndex] || 0;

      if (section?.slides.length > 0) {
        section.slides.forEach((slide, i) => {
          slide.el.classList.remove(
            this.opts.slideActiveClass,
            this.opts.slidePrevClass
          );
          if (i < slideIndex) slide.el.classList.add(this.opts.slidePrevClass);
          else if (i === slideIndex)
            slide.el.classList.add(this.opts.slideActiveClass);
        });
        section.arrowLeft?.classList.toggle(
          "sr-arrow-hidden",
          slideIndex === 0
        );
        section.arrowRight?.classList.toggle(
          "sr-arrow-hidden",
          slideIndex === section.slides.length - 1
        );
        section.slidePagination?.childNodes.forEach((dot, i) =>
          dot.firstChild.classList.toggle(
            "sr-slide-dot-active",
            i === slideIndex
          )
        );
      }

      this._updateURLHash();
    }
  }

  /**
   * Automatically initializes SnapRoll on elements with the `data-snaproll` attribute.
   * @private
   */
  function autoInit() {
    document.querySelectorAll("[data-snaproll]").forEach((el) => {
      if (el.__snaproll_instance) return;
      try {
        const opts = { container: el };
        for (const key in el.dataset) {
          const camelCaseKey = key.replace(/-(\w)/g, (_, c) => c.toUpperCase());
          if (camelCaseKey in DEFAULTS && camelCaseKey !== "slideHashes") {
            let val = el.dataset[key];
            if (val === "true") val = true;
            else if (val === "false") val = false;
            else if (camelCaseKey === "sectionTitles")
              val = val.split(",").map((s) => s.trim());
            else if (!isNaN(Number(val)) && val.trim() !== "")
              val = Number(val);
            opts[camelCaseKey] = val;
          }
        }
        el.__snaproll_instance = new SnapRoll(opts);
      } catch (err) {
        console.warn(`SnapRoll auto-init failed: ${err.message}`);
      }
    });
  }

  global.SnapRoll = SnapRoll;
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", autoInit)
    : autoInit();
})(window);
