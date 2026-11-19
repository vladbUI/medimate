---
name: MediMate
description: A calm notebook workspace for private MedTech study.
colors:
  primary: "#62475e"
  primary-hover: "#51394e"
  background: "#faf8f5"
  paper: "#fffdfb"
  ink: "#302d31"
  muted: "#6f686e"
  divider: "#e5e0dc"
  sidebar: "#f3efeb"
  verified-surface: "#e9f1e6"
  verified-text: "#476343"
typography:
  heading:
    fontFamily: "Lora, Georgia, serif"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 500
rounded:
  field: "8px"
  control: "9px"
  panel: "14px"
  study: "16px"
spacing:
  compact: "8px"
  standard: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Design System: MediMate

## Overview

The approved visual direction is a calm notebook workspace: warm paper, plum actions, and an encouraging but restrained voice. Screens support focused study, with quiet dividers and generous separation between tasks. Document coverage and verification remain explicit.

## Colors

Muted plum identifies primary actions and selected navigation. Warm paper separates working surfaces from the page background. Neutral ink carries questions and answers; muted text carries supporting information. Green denotes verified or extracted states, while amber denotes items requiring attention. Status also has a text label, so color is not its only meaning.

## Typography

Lora gives page titles and study questions a calm editorial voice. DM Sans carries navigation, forms, source excerpts, and supporting copy. Page titles are 36px on laptop and 29px on phone; section headings are generally 26px, with smaller mobile variants. Questions are larger than labels and use comfortable line spacing. Text blocks generally stop at 75 characters per line. Timers use tabular numerals.

## Layout

Laptop layout uses a fixed 248px sidebar and a main container capped at 1260px, with 48px horizontal padding. At 1100px the sidebar contracts to 210px and main padding to 28px. At 760px and below, navigation becomes a horizontal scrolling row, the sidebar becomes a normal top region, and main padding becomes 20px. Forms and subject lists change from two columns to one. The mobile source-review callout places its action beneath the text instead of squeezing the text beside it.

## Elevation & Depth

Working surfaces use a single subtle border or a change of tone. Most elements are flat. The dashboard's small paper note is the isolated decorative exception: it has a slight rotation and soft shadow on laptop, both removed on phone. Do not copy that treatment to every panel.

## Shapes

Controls have compact curved corners; larger study surfaces use more generous rounding. Document and subject lists use horizontal dividers instead of separate raised cards. Small status badges remain compact rectangles; the offline indicator uses a pill.

## Components

**Buttons:** plum-filled primary actions, paper secondary actions, and quiet text actions. Disabled controls lower opacity and use an unavailable cursor. Hover changes the background over 150ms. Keyboard focus uses a visible plum outline with an offset.

**Fields:** labels sit above full-width paper inputs. Inputs have a 44px minimum height; text areas resize vertically. Explicit label associations preserve keyboard and assistive-technology access.

**Navigation:** icon plus text, with a muted plum selected background. Review can display a separate pending count. On phones all destinations remain available by horizontal scrolling.

**Source review:** page status buttons, separate attempted/extracted/flagged counts, a scrollable source excerpt, and an original-PDF link. Verification badges and warning text clearly distinguish extraction from human review.

**Study surfaces:** one prominent question, then reveal/answer controls. Flashcard source excerpts sit behind disclosure. Moving exams keep station progress and the countdown visible above the prompt.

## Do's and Don'ts

- Do preserve the calm paper/plum palette and serif/sans role split.
- Do provide explicit text for verification, incomplete extraction, and errors.
- Do collapse task layouts to one column on phones and keep actions reachable.
- Don't use decorative elevation across lists or working panels.
- Don't make an extraction-success state imply medical correctness.
- Don't remove focus indicators; respect the reduced-motion preference.

## November 8 interface refinement
Mobile navigation now uses the sticky header section selector; the redundant horizontal row is hidden below 760px. Review filters share a quiet surface with full-width search and paired mobile selectors. Primary edit actions use soft plum; Delete is separated and uses muted red. Draft guidance uses a disclosure. Supporting text is generally 14px and mobile inputs remain 16px; interactive controls use a minimum 44px target.

## November 16 design pass
Review gives each row one job: tabs with Add item, then filters (including Needs context only), then bulk actions. Readiness, guidance, and bulk actions step aside while an item is open. The editor shows the item's source and type as a single summary line with Change, and uses one filled action (Verify & next); Verify & save is soft plum, Skip and Cancel are plain. List rows preview the answer. On phones the original page renders at a readable size inside a pannable frame. Minimum text size is 12px. Extracted pages use the green badge; each panel has one filled primary action. Callouts use a tinted surface without a side stripe.
