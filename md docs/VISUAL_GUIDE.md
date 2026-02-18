# Visual Guide to Enhanced Features

## File List Enhancement

### Before: Standard List (All files rendered)
```
File 1.pdf       [🔒] [🗑]
File 2.pdf       [🔒] [🗑]
File 3.pdf            [🗑]
...
File 50.pdf           [🗑]
```

### After: Enhanced List with Order Numbers
```
 [1] File 1.pdf       [🔒] [🗑]
 [2] File 2.pdf       [🔒] [🗑]
 [3] File 3.pdf            [🗑]
 [4] File 4.pdf            [🗑]
 ...
 [10] File 10.pdf          [🗑]

Showing 10 of 50 files ↓ Scroll to load more
```

### Click to Edit Order Number
```
Before clicking:               After clicking:
[5] File 5.pdf               [_____]  (editable input)
                              Type new position: 15
                              Press Enter to save
```

### Order Reordering in Action
```
Original:                 Edit #5 to position #15:
[1] A                    [1] A
[2] B                    [2] B
[3] C                    [3] C
[4] D        ────→       [4] D
[5] E                    [5] F
[6] F                    [6] G
...                      ...
[15] N                   [15] E (moved here!)
```

---

## Password Modal Enhancement

### Before: Basic Password Modal
```
┌─────────────────────────────┐
│ 🔒 Password Required        │
│ This PDF is password...     │
├─────────────────────────────┤
│ Enter password:             │
│ [••••••••••••]              │
│                             │
│ [Cancel]  [Confirm]         │
└─────────────────────────────┘
```

### After: Enhanced Password Modal
```
┌─────────────────────────────┐
│ 🔒 Password Required        │
│ This PDF is password...     │
├─────────────────────────────┤
│ Enter password:             │
│ [••••••••••••] 👁️           │  ← Eye icon to toggle
│                             │
│ Password entered            │  ← Strength indicator
│ [Cancel]  [Confirm]         │
└─────────────────────────────┘
```

### Show Password Feature
```
Hidden:              Shown:               Hidden Again:
[••••••••] 👁️      [MyPassword] 👁️‍🗨️    [••••••••] 👁️
Click eye        Click eye again       Back to dots
```

### Validation States

#### Idle (Waiting)
```
┌─────────────────────────────┐
│ 🔒 Password Required        │
│ This PDF is protected       │
├─────────────────────────────┤
│ [••••••••••••] 👁️           │
│ Password entered            │
│ [Cancel]  [Confirm]         │
└─────────────────────────────┘
```

#### Validating (Processing)
```
┌─────────────────────────────┐
│ 🔒 Password Required        │  (slight blue tint)
│ This PDF is protected       │
├─────────────────────────────┤
│ [••••••••••••] 👁️ (blue)    │
│ ⏳ Validating password...    │
│ [Cancel]  [⏳ Validating...]  │
└─────────────────────────────┘
```

#### Success (Validated!)
```
┌─────────────────────────────┐
│ ✅ Password Unlocked!       │ (green, with pulse)
│ File is ready to merge      │
├─────────────────────────────┤
│ [MyPassword] 👁️ (green bg)   │
│ ✅ Password accepted!       │
│ [Cancel]  [✅ Unlocked]      │
│                             │
│ → Auto-closes in 0.6 sec    │
└─────────────────────────────┘
```

#### Error (Wrong Password)
```
┌─────────────────────────────┐
│ ❌ [shake shake shake]      │ (red icon, shaking)
│ This PDF is password...     │
├─────────────────────────────┤
│ [••••••••••••] 👁️ (red bg)   │
│ ❌ Incorrect password.      │
│    Please try again.        │
│ [Cancel]  [Confirm]         │
│                             │
│ (Ready to retry)            │
└─────────────────────────────┘
```

---

## Interaction Flows

### Flow 1: Edit File Order
```
User sees:           User clicks:        User sees:           User types:      User saves:
[5] File.pdf    →    [5] (number)   →    [____] (input)  →    "15"        →    Press Enter

Result:
[1] A
[2] B
[3] C
[4] D
[5] F (was 6)
...
[15] E (moved here from position 5!)
```

### Flow 2: Scroll to Load More Files
```
Viewing:             User scrolls:       System detects:      New files load:     User sees:
Files 1-10     →     to bottom      →    intersection    →     (instantly)   →    Files 1-20
"Showing 10
 of 50"              "Loading..."         "Showing 20
                                          of 50"
```

### Flow 3: Submit Password (Success)
```
Modal opens     User types      Eye icon click      User confirms       Modal validates    Success!
   ↓                ↓                ↓                   ↓                  ↓              ↓
[????]  →    [MyPassword]  ←→  [MyPassword]  →   Click Confirm  →   ✅ validating  →  ✅ Success!
             (shows as •••)  (shows as text)      (button spins)    (0.1-0.5 sec)   (auto-closes)
```

### Flow 4: Submit Password (Failure)
```
Modal opens     User types      User confirms       Validation fails    Error shake      User retries
   ↓                ↓                ↓                   ↓                 ↓                ↓
[????]  →    [WrongPwd]  →   Click Confirm  →   ❌ Error occurs  →  [shake]  →    [WrongPwd2]
             (shows as •••)  (button spins)      "Incorrect..."      (red bg)    (field editable)
```

---

## Animation Sequences

### Lock Icon Transformation

**Idle → Validating**
```
Start:  🔒 (amber)
During: 🔒 (amber, still)
End:    🔒 (amber, still)
```

**Validating → Success**
```
Start:  🔒 (amber)
Mid:    ✅ (green, appearing)
Peak:   ✅ (green, pulsing, scaled up 110%)
End:    ✅ (green, settling)
```

**Validating → Error**
```
Start:  🔒 (amber)
Mid:    ❌ (red, appearing)
Peak:   ❌ (red, shaking left/right)
End:    ❌ (red, still)
```

### Shake Animation (Error)
```
Time 0.0s:  ❌  (center)
Time 0.1s:  ❌  (left, -5px)
Time 0.2s:  ❌  (center)
Time 0.3s:  ❌  (right, +5px)
Time 0.4s:  ❌  (center)
```

### Pulse Animation (Success)
```
Opacity cycles:
0%:  1.0 (full)
50%: 0.5 (fade)
100%: 1.0 (full)
Duration: 2s, infinite
```

---

## Keyboard Navigation

### File Order Editing
```
1. User clicks order number
   ↓
2. Input appears with focus
   ↓
3. User types number
   ↓
4. Three options:
   
   Option A: Press ENTER
   ↓
   Order applied, list updates
   
   Option B: Press ESCAPE
   ↓
   Canceled, back to number display
   
   Option C: Click away
   ↓
   Blur event triggers, order applied
```

### Password Modal Navigation
```
1. Modal opens, focus on password field
   ↓
2. User tabs between elements:
   Password field → Eye icon → Cancel → Confirm
   ↓
3. User can press:
   - ENTER to submit password
   - ESCAPE to close modal
   - SPACE on eye icon to toggle
```

---

## Performance Indicators

### Infinite Scroll Stages
```
Stage 1: Initial Load (0-100ms)
[1-10 visible] "Showing 10 of 100 files"

Stage 2: User Scrolls (0-50ms)
[11-20 visible] "Showing 20 of 100 files"

Stage 3: Continue (0-50ms)
[21-30 visible] "Showing 30 of 100 files"
...
Stage 10: Complete (0-50ms)
[91-100 visible] "Showing 100 of 100 files"
```

### Password Validation Speed
```
Wrong password (instant):    ~50-100ms
Correct password (validate): ~100-500ms
Success animation:           600ms
Auto-close:                  Immediate after 600ms
```

---

## Accessibility Features

### For Keyboard Users
```
File Order:
Tab → Order number → Space/Enter to edit → Type → Enter to save

Password Modal:
Tab → Password field → Tab → Eye icon → Tab → Cancel/Confirm
```

### For Screen Readers
```
"Order number 5, button, clickable"
"Password field, type your password"
"Show password toggle, eye icon, button"
"Validating password, loading"
"Password accepted, modal will close automatically"
"Incorrect password, please try again"
```

### For Color-Blind Users
```
Success: ✅ + Green + Message text
Error:   ❌ + Red   + Message text + Shake animation
```

---

## Size Reference

### Modal Dimensions
```
Width:  384px (sm:max-w-md)
Height: 280-380px (varies by content)
Position: Center of screen
Overflow: Auto scroll if needed
```

### File List Row
```
Height: 60-70px per file
Width: Full container width
Gap between rows: 12px
Order number field: 48px width
```

### Icon Sizes
```
Header icon: 20px (h-5 w-5)
Input icon: 16px (h-4 w-4)
Small icons: 16px
Large icons: 20px
```

---

## Color Scheme

### File List
```
Order button (idle):     Border gray-300, text gray-600
Order button (hover):    Bg gray-50, border blue-400
Order input (active):    Border blue-500, bg blue-50
Order text:              Font medium, text-sm
```

### Password Modal
```
Icon (idle):      Amber background, amber text
Icon (success):   Green background, green text with pulse
Icon (error):     Red background, red text with shake
Input (idle):     Border gray-300
Input (success):  Border green-200, bg green-50
Input (error):    Border red-400, bg red-50
Button (idle):    Blue-600
Button (success): Green-600
Button (disabled): Gray-400, opacity 50%
```

---

## Message Examples

### Order Number Input
```
Valid:           "5" → Accepted, file moves
Invalid:         "101" (out of range 1-50) → Rejected silently
Invalid:         "abc" → Rejected (not a number)
Edge case:       "0" → Rejected (minimum is 1)
```

### Password Validation
```
Success:  "Password accepted!"
Error:    "Incorrect password. Please try again."
System:   "Error validating password. Please try again."
Loading:  "Validating password..."
```

### File List
```
Empty:     "No files uploaded yet"
Single:    "Showing 1 of 1 files" (no scroll message)
Small:     "Showing 10 of 25 files"
Large:     "Showing 10 of 150 files"
           "↓ Scroll to load more"
Complete:  "Showing 150 of 150 files"
```

---

## Responsive Design

### Mobile (< 640px)
```
Order number field: 40px (smaller)
Icon: 16px (smaller)
Modal width: 90vw (full minus margins)
Input: Full width minus padding
```

### Tablet (640px - 1024px)
```
Order number field: 48px
Modal width: 384px (sm:max-w-md)
Two-column layout when applicable
```

### Desktop (> 1024px)
```
Order number field: 48px
Modal width: 384px (sm:max-w-md)
Larger icons and spacing
Optimized for large files lists
```

---

## Animation Timing

```
Shake animation:      0.3s ease-in-out
Fade in animation:    0.3s ease-in-out
Slide up animation:   0.3s ease-out
Pulse animation:      2s infinite (success icon)
Scale animation:      100ms (icon growth to 110%)
Auto-close delay:     600ms (success modal)
```
