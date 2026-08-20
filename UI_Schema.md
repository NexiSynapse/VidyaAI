# VidyaAI UI Schema Specification

> Design System and Component Specifications for Figma Implementation

---

## Overview

This document defines the UI components, layouts, and interactions for VidyaAI across three implementation phases. Each phase builds upon the previous, creating a progressive enhancement pattern.

---

# Phase 0: Foundation (Week 1)

## Design Tokens

### Color System

```yaml
colors:
  primary:
    50: "#EEF2FF"
    100: "#E0E7FF"
    200: "#C7D2FE"
    300: "#A5B4FC"
    400: "#818CF8"
    500: "#6366F1"    # Main primary
    600: "#4F46E5"
    700: "#4338CA"
    800: "#3730A3"
    900: "#312E81"

  secondary:
    50: "#F0FDF4"
    100: "#DCFCE7"
    200: "#BBF7D0"
    300: "#86EFAC"
    400: "#4ADE80"
    500: "#22C55E"    # Main secondary
    600: "#16A34A"
    700: "#15803D"
    800: "#166534"
    900: "#14532D"

  neutral:
    50: "#FAFAFA"
    100: "#F4F4F5"
    200: "#E4E4E7"
    300: "#D4D4D8"
    400: "#A1A1AA"
    500: "#71717A"
    600: "#52525B"
    700: "#3F3F46"
    800: "#27272A"
    900: "#18181B"

  semantic:
    success: "#22C55E"
    warning: "#F59E0B"
    error: "#EF4444"
    info: "#3B82F6"

  background:
    default: "#FFFFFF"
    paper: "#FAFAFA"
    elevated: "#FFFFFF"

  text:
    primary: "#18181B"
    secondary: "#52525B"
    disabled: "#A1A1AA"
    inverse: "#FFFFFF"
```

### Typography

```yaml
typography:
  fontFamily:
    sans: "Inter, system-ui, -apple-system, sans-serif"
    mono: "JetBrains Mono, Consolas, monospace"

  fontSize:
    xs: "0.75rem"      # 12px
    sm: "0.875rem"     # 14px
    base: "1rem"       # 16px
    lg: "1.125rem"     # 18px
    xl: "1.25rem"      # 20px
    2xl: "1.5rem"      # 24px
    3xl: "1.875rem"    # 30px
    4xl: "2.25rem"     # 36px
    5xl: "3rem"        # 48px

  fontWeight:
    light: 300
    normal: 400
    medium: 500
    bold: 700
```

### Spacing

```yaml
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  7: "1.75rem"
  8: "2rem"
  9: "2.25rem"
  10: "2.5rem"
```

### Border Radius

```yaml
borderRadius:
  xs: "0.125rem"
  sm: "0.25rem"
  base: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  2xl: "1.5rem"
  full: "9999px"
```

---

## Core Components

### 1. Button

**Variants:**
- Primary
- Secondary
- Tertiary
- Destructive

**Sizes:**
- Small (sm)
- Medium (md)
- Large (lg)

**States:**
- Default
- Hover
- Active
- Disabled

### 2. Input Field

**Variants:**
- Text
- Password
- Number
- Search

**States:**
- Default
- Focused
- Error
- Disabled

### 3. Card

**Variants:**
- Default
- Elevated
- Outline

**Sizes:**
- Small
- Medium
- Large

---

# Phase 1: Core UI (Week 2-3)

## Layout System

### Grid System
12-column responsive grid with breakpoints:
- xs: 0px
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px
- 2xl: 1536px

## Navigation

### Top App Bar
- Logo
- Course Selector
- Search Bar
- User Profile Menu

### Sidebar
- Collapsible
- Navigation Items:
  - Dashboard
  - Courses
  - AI Teacher
  - Practice
  - Progress
  - Settings

---

# Phase 2: Advanced Components (Week 4+)

## Interactive Elements

### Code Editor
- Syntax highlighting
- Line numbers
- Error markers
- Auto-indentation

### Progress Visualizer
- Radial progress bar
- Topic mastery chart
- Learning history timeline

### AI Chat Interface
- Message bubbles
- Typing indicator
- Context panel
- Action suggestions

---

## Interaction Patterns

1. **Adaptive Learning Feedback**
   - Real-time mastery updates
   - Personalized hints
   - Progress celebrations

2. **Immersive Practice Sessions**
   - Focus mode
   - Time tracking
   - Streak indicators

3. **Context-Aware Guidance**
   - Resource recommendations
   - Prerequisite checks
   - Misconception detection

---

## Design System Assets

- Figma UI Kit (Components + Styles)
- Icon Library (48px grid)
- Motion Design Specs
- Accessibility Guidelines