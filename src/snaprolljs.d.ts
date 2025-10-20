export interface SnapRollOptions {
  container?: string | HTMLElement;
  sectionSelector?: string;
  activeClass?: string;
  prevClass?: string;
  sectionAnimation?: "slide" | "fade" | "zoom" | "flip" | "skew" | "rotate";
  keyboard?: boolean;
  loop?: boolean;
  scrollTimeout?: number;
  slideScrollTimeout?: number;
  touchThreshold?: number;
  wheelDeltaThreshold?: number;
  wheelGestureEndDelay?: number;
  pageTitle?: string;
  sectionTitles?: string[];
  slideHashes?: Record<number, string[]>;
  pagination?: boolean;
  paginationPosition?: "right" | "left" | "top" | "bottom";
  hashSeparator?: string;
  slideSelector?: string;
  slideAnimation?: "slide" | "fade" | "zoom" | "flip" | "skew" | "rotate";
  slideActiveClass?: string;
  slidePrevClass?: string;
  slideArrows?: boolean;
  slidePagination?: boolean;
  slidePaginationPosition?: "bottom" | "top";
  debug?: boolean;
}

export default class SnapRoll {
  constructor(options?: SnapRollOptions);

  /** Initializes or restarts the instance by scanning the DOM */
  init(): void;

  /** Rescans the DOM (for dynamic changes) */
  refresh(): void;

  /** Destroys the instance (cleans up listeners and UI) */
  destroy(): void;

  /** Navigates to the next section or slide */
  next(): void;

  /** Navigates to the previous section or slide */
  prev(): void;

  /** Navigates to a specific section */
  goToSection(index: number, landOnLastSlide?: boolean): void;

  /** Navigates to a specific slide within the current section */
  goToSlide(index: number): void;

  /** Alias for goToSection */
  scrollTo(index: number): void;

  /** Navigates to the next section */
  nextSection(): void;

  /** Navigates to the previous section */
  prevSection(): void;

  /** Navigates to the next slide */
  nextSlide(): void;

  /** Navigates to the previous slide */
  prevSlide(): void;
}

declare global {
  interface Window {
    SnapRoll: typeof SnapRoll;
  }
}
