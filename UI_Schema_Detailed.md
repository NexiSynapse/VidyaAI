# VidyaAI UI Schema Specification

> Design System and Component Specifications for Figma Implementation

---

## Overview

This document defines the UI components, layouts, and interactions for VidyaAI across three implementation phases, aligned with the MVP plan. Each phase builds progressively, focusing on core functionality first.

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

### Spacing & Sizing

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

borderRadius:
  xs: "0.125rem"
  sm: "0.25rem"
  base: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  2xl: "1.5rem"
  full: "9999px"

breakpoint:
  xs: "0px"
  sm: "640px"
  md: "768px"
  lg: "1024px"
  xl: "1280px"
  2xl: "1536px"
```

---

## Core Components

### 1. Document Upload Card
- **State:** Idle, Uploading, Success, Error
- **Controls:** Drag-and-drop zone, File input button
- **Feedback:** Progress bar, Checkmark/Error icon

### 2. Chat Interface
- **Layout:** Message bubbles (User/AI), Typing indicator
- **Features:** Document picker, Context toggle
- **Message Types:** Text, Code blocks (syntax highlighting), Citations

### 3. Quiz Generator
- **Controls:** Topic selector, Question count slider
- **Output:** Multiple-choice questions with explanations
- **State:** Generating, Ready, Error

### 4. Progress Dashboard
- **Visuals:** Mastery score meter (0-100), Topic breakdown chart
- **Data:** Recent quiz attempts, Weak area highlights

---

# Phase 1: Core UI (Week 2-3)

## Layout System

### Responsive Grid
12-column grid with breakpoints matching design tokens.

### Navigation

#### Top App Bar
- Logo
- Quick Actions: Upload, New Chat, Generate Quiz
- User Profile Menu

#### Collapsible Sidebar
- Sections:
  - My Documents
  - AI Teacher
  - Practice Quizzes
  - Progress Tracker
  - Settings

---

## Interaction Patterns

### Document Workflow
1. Upload → 2. Select → 3. Chat/Quiz
- **State Management:** Document status (Processing, Ready, Error)

### Quiz Workflow
1. Generate → 2. Answer → 3. Review
- **Feedback:** Real-time score updates, Correct/Incorrect indicators

---

# Phase 2: Advanced Components (Week 4+)

## Interactive Elements

### Code Editor
- **Features:** Syntax highlighting, Line numbers, Error markers
- **Modes:** Read-only (display), Editable (practice)

### Flashcard Review
- **Controls:** Flip, Difficulty rating (Again/Hard/Good/Easy)
- **Queue:** Upcoming reviews counter

### Algorithm Visualizer
- **Types:** Sorting, Graph traversal, Data structures
- **Controls:** Step-through, Speed control

---

## Accessibility & States

- **Keyboard Navigation:** Full operability
- **Screen Reader Support:** ARIA labels
- **Error Handling:** Clear recovery paths
- **Loading States:** Skeleton screens, Spinners

---

## Design System Assets

1. **Figma UI Kit:** All components with variants and auto-layout
2. **Icon Library:** 48px grid, 3 styles (outline, filled, glyph)
3. **Motion Specs:** Animations for key interactions
4. **Accessibility Guidelines:** Contrast ratios, focus states

---

## Implementation Notes

- **Phase 0 Priority:** Document Upload, Chat Interface, Basic Quiz
- **Phase 1 Focus:** Layout system, Navigation, Progress Dashboard
- **Phase 2 Stretch:** Code Editor, Flashcards, Visualizer

> Aligns with MVP Plan priorities (P0: Upload/Chat/Quiz, P1: Progress/Topics, P2: Flashcards/Code)
