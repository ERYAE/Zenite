# Zenite OS TODO

## Critical 
- [x] Fix Netlink join validation and campaign code parsing; ensure router passes sanitized code and show clear error states.
- [x] Implement Friends UI + invite flow: list friends/pending, invite to campaign (status pending), realtime notification or pending member insert.

## Auth & Routing 
- [x] Upgrade auth UI: show password toggle, generator, strength meter, email domain suggestions; mobile-safe modal layout.
- [x] Improve username availability feedback (spinner, shake on taken, animated check on available).
- [x] Ensure router history safety: login replaceState, clean hashes when exiting sheet/netlink.

## Character Safety & Saving 
- [x] Add beforeunload warning when char is dirty.
- [x] Debounced autosave (localStorage + Supabase) with visual "Saving…/Saved" indicator.

## UI/UX Polish 
- [x] Redesign Profile modal as holographic RPG stats screen (glass, neon, micro-interactions).
- [ ] Fix ID card age text contrast (add darker text/backdrop). *(Pending - ID card generation module)*
- [x] Align Settings/Netlink/+ buttons on mobile with 44px touch targets.

## Audio & Performance 
- [x] Verify audio preloading/cache and singleton usage; ensure crackle-free playback.

## Engagement 
- [x] Dice result animation (CSS/Canvas) with try/catch fallback.
- [x] Thematic loaders (d20 spinner/skeletons) for blank states.
- [x] Achievements toast for first character and Nat 20.

## Testing/Verification
- [ ] Regression pass: signup flow, profile creation, Netlink join, back-button behavior, autosave/unsaved warning, audio playback.

---

## Implementation Summary (Session)

### Completed Features:
1. **Auth UI Enhancements**: Show password toggle, generate strong password button, password strength meter, email domain autocomplete datalist, mobile-safe scrolling container
2. **Username Feedback**: Spinner animation during check, shake animation on taken, bounce-in checkmark on available
3. **Profile Modal Redesign**: Holographic RPG Character Stats screen with dark glassmorphism, neon accents, scanlines, corner decorations, animated stat cards, experience bar, achievement grid
4. **Character Sheet Safety**: beforeunload warning for unsaved changes, debounced autosave to localStorage with visual status indicator (pending/saving/local/synced)
5. **Netlink Improvements**: sanitizeInviteCode function for URL parsing and code normalization, case-insensitive search, better error messages, friend invite to campaign functionality
6. **Dice Animations**: Enhanced dice result display with roll animation, critical/fumble effects, particle animations
7. **Thematic Loaders**: D20 spinner with orbiting particles, gradient progress bar, flavor text
8. **Achievement Toasts**: Beautiful animated toast component for achievement unlocks with glow effects and star decorations
9. **Mobile Responsiveness**: 44px minimum touch targets, proper flex centering, badge for pending campaign invites

### CSS Animations Added:
- `animate-shake` - Error shake effect
- `animate-bounce-in` - Success checkmark bounce
- `animate-glow-pulse` - Pulsing glow
- `animate-dice-roll` - Dice rolling animation
- `animate-critical` - Critical hit effect
- `animate-fumble` - Fumble effect
- `skeleton-loader` - Shimmer loading effect
- `animate-d20-spin` - D20 spinning
- `animate-achievement` - Achievement unlock
- `animate-save-pulse` - Save indicator
- `holographic-shimmer` - RPG profile holographic effect
- `scanlines` - Cyber aesthetic scanlines
