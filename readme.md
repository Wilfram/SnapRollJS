# SnapRollJS.js

![Version](https://img.shields.io/badge/version-2.0.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Dependencies](https://img.shields.io/badge/dependencies-none-lightgrey)

**SnapRollJS.js** is a lightweight, dependency-free micro-library for creating full-screen presentations with "snap-scrolling". It allows you to configure animations for both vertical sections and horizontal slides.

[View Live Demo (Coming Soon)](#)

## Features

- **Dependency-Free**: Written in pure JavaScript (ES6).
- **Full Navigation**: Supports keyboard, mouse wheel, and touch gestures (swipe).
- **Sections and Slides**: Nested structure with vertical sections and horizontal slides.
- **CSS Animations**: Multiple predefined animations (`slide`, `fade`, `zoom`, `flip`, `skew`, `rotate`) and easily customizable.
- **Hash Routing**: Updates the URL (`#section--slide`) to share direct links to any view.
- **Highly Configurable**: Customize everything through JavaScript options or `data-*` attributes in your HTML.
- **Automatic UI**: Automatically generates pagination (dots) and navigation arrows.
- **Auto-initialization**: Automatically initializes on elements with the `data-snaproll` attribute.

## Quick Install (CDN)

The easiest way to get started is by using the CDN links. Simply add the CSS to your `<head>` and the JavaScript before the closing `</body>` tag.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Presentation with SnapRoll</title>

    <!-- 1. Add SnapRoll -->
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/snaprolljs/dist/snaprolljs.min.css"
    />
    <script src="https://cdn.jsdelivr.net/npm/snaprolljs/dist/snaprolljs.min.js"></script>
  </head>
  <body>
    <!-- 2. Structure your content -->
    <div class="sr-cont" data-snaproll>
      <div class="sr-sec" data-sr-hash="home">
        <h1>Section 1</h1>
      </div>
      <div
        class="sr-sec"
        data-sr-hash="projects"
        data-sr-section-animation="fade"
      >
        <div class="sr-slide"><h2>Projects - Slide 1</h2></div>
        <div class="sr-slide"><h2>Projects - Slide 2</h2></div>
        <div class="sr-slide"><h2>Projects - Slide 3</h2></div>
      </div>
      <div class="sr-sec" data-sr-hash="contact">
        <h1>Section 3</h1>
      </div>
    </div>
  </body>
</html>
```

## Usage

SnapRoll can be initialized in two ways:

### 1. Automatic Initialization (Recommended)

Add the `data-snaproll` attribute to your main container. You can configure options directly in the HTML using `data-*` attributes.

**Example:**

```html
<div
  class="sr-cont"
  data-snaproll
  data-loop="true"
  data-section-animation="zoom"
  data-pagination-position="left"
>
  <!-- .sr-sec and .sr-slide here -->
</div>
```

Option names in `camelCase` are converted to `kebab-case`. For example, `scrollTimeout` becomes `data-scroll-timeout`.

### 2. Manual Initialization (JavaScript)

If you prefer more control, you can initialize SnapRoll manually.

```html
<div id="my-presentation">
  <section class="my-section">...</section>
  <section class="my-section">...</section>
</div>
```

```javascript
document.addEventListener("DOMContentLoaded", () => {
  const myPresentation = new SnapRoll({
    container: "#my-presentation",
    sectionSelector: ".my-section",
    loop: true,
    sectionAnimation: "fade",
    // ...other options
  });
});
```

## HTML Structure

The basic structure SnapRoll expects is a container with multiple sections. Optionally, each section can contain multiple slides.

```html
<!-- Main container -->
<div class="sr-cont">
  <!-- Vertical Section 1 -->
  <div class="sr-sec">...</div>

  <!-- Vertical Section 2 (with horizontal slides) -->
  <div class="sr-sec sr-has-slides">
    <!-- Horizontal Slide 1 -->
    <div class="sr-slide">...</div>

    <!-- Horizontal Slide 2 -->
    <div class="sr-slide">...</div>
  </div>

  <!-- Vertical Section 3 -->
  <div class="sr-sec">...</div>
</div>
```

## Configuration Options

You can pass an options object to the `new SnapRoll(options)` constructor or use `data-*` attributes.

| Option               | `data-*` Attribute         | Default             | Description                                                                         |
| -------------------- | -------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `container`          | -                          | `'.sr-cont'`        | Selector or element of the main container.                                          |
| `sectionSelector`    | `data-section-selector`    | `'.sr-sec'`         | Selector for the sections.                                                          |
| `activeClass`        | `data-active-class`        | `'sr-active'`       | Class for the active section.                                                       |
| `sectionAnimation`   | `data-section-animation`   | `'slide'`           | Default animation for sections (`slide`, `fade`, `zoom`, `flip`, `skew`, `rotate`). |
| `keyboard`           | `data-keyboard`            | `true`              | Enables keyboard navigation.                                                        |
| `loop`               | `data-loop`                | `false`             | Allows looping from the end to the beginning and vice versa.                        |
| `scrollTimeout`      | `data-scroll-timeout`      | `800`               | Time (ms) to wait between section transitions.                                      |
| `pagination`         | `data-pagination`          | `true`              | Shows pagination for sections.                                                      |
| `paginationPosition` | `data-pagination-position` | `'right'`           | Position of the pagination (`right`, `left`, `top`, `bottom`).                      |
| `slideSelector`      | `data-slide-selector`      | `'.sr-slide'`       | Selector for the slides.                                                            |
| `slideAnimation`     | `data-slide-animation`     | `'slide'`           | Default animation for slides.                                                       |
| `slideActiveClass`   | `data-slide-active-class`  | `'sr-slide-active'` | Class for the active slide.                                                         |
| `slideArrows`        | `data-slide-arrows`        | `true`              | Shows navigation arrows for slides.                                                 |
| `slidePagination`    | `data-slide-pagination`    | `true`              | Shows pagination for slides.                                                        |
| `debug`              | `data-debug`               | `false`             | Shows internal logs in the console.                                                 |

## API Methods

Once you have a SnapRoll instance, you can use its public methods.

```javascript
const mySnapRoll = new SnapRoll({ container: ".sr-cont" });

// Navigate to the next section/slide
mySnapRoll.next();

// Navigate to the previous section/slide
mySnapRoll.prev();

// Go to a specific section (0-based index)
mySnapRoll.goToSection(2);

// Go to a specific slide within the current section
mySnapRoll.goToSlide(1);

// Reload the instance after DOM changes
mySnapRoll.refresh();

// Destroy the instance and clean up events and elements
mySnapRoll.destroy();
```

## Custom CSS

The `snaproll.css` file provides the basic styles and animations. You can override them or create your own animations.

**Example of a new "spin" animation:**

```css
/* 1. Add the animation class to the section/slide */
.sr-sec.sr-anim-spin {
  transition: transform 0.8s ease-in-out, opacity 0.8s ease-in-out;
  transform: rotate(0) scale(1);
  opacity: 1;
}

/* 2. Define the previous state (when it has been passed) */
.sr-sec.sr-anim-spin.sr-prev {
  transform: rotate(-90deg) scale(0.5);
  opacity: 0;
}

/* 3. Define the future state (before it becomes active) */
.sr-cont > .sr-sec.sr-anim-spin {
  transform: rotate(90deg) scale(0.5);
  opacity: 0;
}

/* 4. Define the active state */
.sr-cont > .sr-sec.sr-anim-spin.sr-active {
  transform: rotate(0) scale(1);
  opacity: 1;
}
```

Then, use it in your HTML:
`<div class="sr-sec" data-sr-section-animation="spin">...</div>`

## Contributions

Contributions are welcome! If you have ideas to improve SnapRoll.js, have found a bug, or want to propose a new feature, please open an issue or submit a pull request in the project repository.

## Author and License

Developed by **Wil**.

This project is under the MIT License. You are free to use, modify, and distribute this software as you see fit.
