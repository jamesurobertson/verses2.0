# Test File Restructure - Project Resource Package (PRP)

name: "Test File Organization Restructure"
description: |

## Purpose
Comprehensive PRP to reorganize test files from the centralized `/tests` directory to be adjacent to their corresponding source files for better maintainability and developer experience.

## Core Principles
1. **Colocation**: Tests live next to the code they test
2. **Maintainability**: Easier to keep tests in sync with code changes
3. **Developer Experience**: Improved discoverability and navigation
4. **Consistency**: Follow modern testing organization patterns
5. **Preserve Functionality**: All tests continue to pass after migration

---

## Goal
Move all test files from the centralized `/tests` directory to be located adjacent to their corresponding source files while maintaining all existing functionality and test coverage.

## Why
- **Improved Maintainability**: Tests are easier to find and update when they're next to the code
- **Better Developer Experience**: IDE navigation and file switching becomes more intuitive
- **Modern Best Practice**: Industry standard for React/TypeScript projects
- **Reduced Friction**: Developers are more likely to update tests when they're easily accessible

## What
Systematic migration of all test files to component-adjacent locations with updated Jest configuration and import path corrections.

### Success Criteria
- [ ] All test files moved to appropriate component directories
- [ ] Jest configuration updated to find tests in new locations
- [ ] All import paths in test files updated correctly
- [ ] All tests continue to pass after migration
- [ ] Empty `/tests` directory removed
- [ ] Consistent naming convention applied throughout

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Current test structure and patterns

- file: /projects/verses/jest.config.ts
  why: Current Jest configuration for test discovery and setup
  pattern: testMatch patterns, setupFilesAfterEnv configuration
  critical: Update testMatch patterns to find tests in new locations

- file: /projects/verses/package.json
  why: Test scripts and Jest configuration
  pattern: npm scripts for testing, Jest configuration
  critical: May need to update test scripts for new structure

- url: https://jestjs.io/docs/configuration#testmatch
  why: Jest testMatch configuration for finding tests in multiple locations
  critical: Configure to find tests in both old and new locations during migration

- file: /projects/verses/tests/
  why: Current test files to be migrated
  pattern: Existing test structure and organization
  critical: Analyze all existing tests to plan migration
```

### Current Test Structure
```bash
# CURRENT STRUCTURE (to migrate from)
tests/
├── setup.ts                           # Jest setup file ✅ KEEP
├── infrastructure.test.ts             # Move to src/test-utils/
├── components/
│   ├── Button/
│   │   ├── Button.test.tsx            # → src/components/Button/
│   │   └── Button.styles.test.ts      # → src/components/Button/
│   └── Other component tests...
├── services/
│   ├── dataService.test.ts            # → src/services/
│   └── Other service tests...
├── utils/
│   ├── bibleRefParser.test.ts         # → src/utils/
│   └── Other utility tests...
└── pages/
    └── AddVerse/
        └── AddVerse.test.tsx          # → src/pages/AddVerse/
```

### Desired Test Structure
```bash
# NEW STRUCTURE (target organization)
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx            # ✅ MOVED HERE
│   │   ├── Button.styles.ts
│   │   ├── Button.styles.test.ts      # ✅ MOVED HERE
│   │   └── index.tsx
│   └── Other components...
├── services/
│   ├── dataService.ts
│   ├── dataService.test.ts            # ✅ MOVED HERE
│   └── Other services...
├── utils/
│   ├── bibleRefParser.ts
│   ├── bibleRefParser.test.ts         # ✅ MOVED HERE
│   └── Other utilities...
├── pages/
│   ├── AddVerse/
│   │   ├── AddVerse.tsx
│   │   ├── AddVerse.test.tsx          # ✅ MOVED HERE
│   │   └── Other AddVerse files...
│   └── Other pages...
└── test-utils/
    ├── setup.ts                       # ✅ MOVED from tests/
    └── infrastructure.test.ts         # ✅ MOVED from tests/
```

### Known Gotchas & Implementation Details
```typescript
// CRITICAL: Jest configuration update
// Update jest.config.ts testMatch patterns
export default {
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  // ... existing config
};

// CRITICAL: Import path updates needed
// Example changes in test files:
// OLD: import { Button } from '../../src/components/Button'
// NEW: import { Button } from './Button' (or '../Button' depending on structure)

// CRITICAL: Test setup file reference
// Update setupFilesAfterEnv in Jest config:
setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts']

// CRITICAL: Coverage collection patterns
// Update collectCoverageFrom patterns:
collectCoverageFrom: [
  'src/**/*.{ts,tsx}',
  '!src/**/*.d.ts',
  '!src/**/*.test.{ts,tsx}',
  '!src/**/*.stories.{ts,tsx}'
]
```

## Implementation Blueprint

### File Migration Plan

```yaml
# Systematic migration by category

Category 1 - Component Tests:
SOURCE: tests/components/Button/Button.test.tsx
TARGET: src/components/Button/Button.test.tsx
IMPORT_UPDATES: Update relative imports from '../../../' to './'

Category 2 - Service Tests:
SOURCE: tests/services/dataService.test.ts  
TARGET: src/services/dataService.test.ts
IMPORT_UPDATES: Update imports to use relative paths

Category 3 - Utility Tests:
SOURCE: tests/utils/bibleRefParser.test.ts
TARGET: src/utils/bibleRefParser.test.ts
IMPORT_UPDATES: Update imports to use relative paths

Category 4 - Page Tests:
SOURCE: tests/pages/AddVerse/AddVerse.test.tsx
TARGET: src/pages/AddVerse/AddVerse.test.tsx  
IMPORT_UPDATES: Update imports for components and services

Category 5 - Infrastructure Tests:
SOURCE: tests/setup.ts, tests/infrastructure.test.ts
TARGET: src/test-utils/setup.ts, src/test-utils/infrastructure.test.ts
UPDATES: Update Jest config to reference new setup location
```

### Task List (Implementation Order)

```yaml
Task 1 - Analyze Current Test Structure:
SCAN tests/ directory recursively:
  - CATALOG all test files and their dependencies
  - IDENTIFY import patterns that need updating
  - CREATE migration mapping for each file
  - NOTE any custom test utilities or mocks

Task 2 - Update Jest Configuration:
MODIFY jest.config.ts:
  - UPDATE testMatch patterns to find tests in src/
  - PRESERVE existing test discovery during migration
  - UPDATE setupFilesAfterEnv path
  - UPDATE collectCoverageFrom patterns

Task 3 - Create Target Directories:
CREATE src/test-utils/ directory:
  - MOVE tests/setup.ts → src/test-utils/setup.ts
  - MOVE tests/infrastructure.test.ts → src/test-utils/infrastructure.test.ts
  - UPDATE Jest config setupFilesAfterEnv reference

Task 4 - Migrate Component Tests:
FOR EACH component in tests/components/:
  - MOVE test file to corresponding src/components/ directory
  - UPDATE import statements for relative paths
  - VERIFY test can find the component under test

Task 5 - Migrate Service Tests:
FOR EACH service in tests/services/:
  - MOVE test file to corresponding src/services/ directory
  - UPDATE import statements for services and utilities
  - VERIFY all dependencies can be resolved

Task 6 - Migrate Utility Tests:
FOR EACH utility in tests/utils/:
  - MOVE test file to corresponding src/utils/ directory  
  - UPDATE import statements to use relative paths
  - VERIFY utility functions can be imported correctly

Task 7 - Migrate Page Tests:
FOR EACH page in tests/pages/:
  - MOVE test file to corresponding src/pages/ directory
  - UPDATE imports for components, hooks, and services
  - VERIFY all page dependencies resolve correctly

Task 8 - Validate and Cleanup:
RUN comprehensive test suite:
  - VERIFY all tests still pass
  - CHECK test coverage is maintained
  - REMOVE empty tests/ directory
  - UPDATE any documentation referencing old structure
```

### Per-Task Implementation Details

```bash
# Task 1: Analysis Script
find tests/ -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" | \
  while read file; do
    echo "File: $file"
    echo "Imports:" 
    grep -E "^import.*from" "$file" | head -5
    echo "---"
  done

# Task 2: Jest Config Update
# MODIFY jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'], // UPDATED PATH
  testMatch: [
    '<rootDir>/src/**/*.(test|spec).(ts|tsx|js)',              // NEW PATTERN
    '<rootDir>/tests/**/*.(test|spec).(ts|tsx|js)'             // TEMPORARY - remove after migration
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',                                       // UPDATED PATTERN
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}'
  ],
  // ... rest of existing config
};

# Task 3-7: Migration Script Example
#!/bin/bash
# Example migration for component tests
SOURCE_DIR="tests/components"
TARGET_DIR="src/components"

find "$SOURCE_DIR" -name "*.test.*" | while read test_file; do
  # Extract component name and path
  rel_path=${test_file#$SOURCE_DIR/}
  target_path="$TARGET_DIR/$rel_path"
  target_dir=$(dirname "$target_path")
  
  # Create target directory if needed
  mkdir -p "$target_dir"
  
  # Move file
  mv "$test_file" "$target_path"
  
  # Update imports in the moved file
  sed -i 's|from ["'"'"']\.\./\.\./\.\./src/|from ["'"'"']\.\./|g' "$target_path"
  sed -i 's|from ["'"'"']\.\./\.\./src/|from ["'"'"']\.\./\.\./|g' "$target_path"
  
  echo "Migrated: $test_file → $target_path"
done
```

### Integration Points
```yaml
BUILD_SYSTEM:
  - preserve: "All existing npm test scripts"
  - update: "Jest configuration for new test locations"
  - maintain: "Test coverage collection and reporting"

DEVELOPMENT:
  - improve: "IDE test discovery and navigation"
  - maintain: "Test runner functionality (watch mode, etc.)"
  - preserve: "Debugging and test isolation"

CI/CD:
  - ensure: "All tests continue to run in CI pipeline"
  - maintain: "Coverage reporting accuracy"
  - preserve: "Test result reporting and artifacts"
```

## Validation Loop

### Level 1: Configuration Validation
```bash
# Verify Jest can find tests in new locations
npm test -- --listTests

# Expected: Should list tests from both old and new locations during migration
```

### Level 2: Import Resolution
```bash
# Test a few migrated files individually
npm test src/components/Button/Button.test.tsx
npm test src/services/dataService.test.ts

# Expected: Tests should run successfully with updated imports
```

### Level 3: Full Test Suite
```bash
# Run complete test suite
npm test

# Expected: All tests pass, coverage maintained
# If failures: Fix import paths and retry
```

### Level 4: Test Watch Mode
```bash
# Verify watch mode works with new structure
npm test -- --watch

# Make a change to a component
# Expected: Only related tests should re-run
```

## Final Validation Checklist
- [ ] Jest configuration updated for new test locations
- [ ] All test files moved to component-adjacent locations
- [ ] Import paths updated in all test files
- [ ] All tests pass: `npm test`
- [ ] Test coverage maintained at same level
- [ ] Watch mode works correctly
- [ ] IDE can discover and run tests
- [ ] No broken import statements
- [ ] Empty `/tests` directory removed
- [ ] Consistent naming convention applied

---

## Anti-Patterns to Avoid
- ❌ Don't move all files at once - migrate incrementally to catch issues
- ❌ Don't forget to update setupFilesAfterEnv path in Jest config
- ❌ Don't break relative import paths - update them systematically
- ❌ Don't remove original testMatch patterns until migration complete
- ❌ Don't ignore test utilities and mocks - migrate them too
- ❌ Don't skip validation of individual test files during migration

## Migration Strategy
- ✅ Update Jest config first to support both old and new locations
- ✅ Migrate files category by category (components, services, utils, pages)
- ✅ Update imports systematically using find/replace patterns
- ✅ Validate each category after migration
- ✅ Remove old testMatch patterns only after all files migrated
- ✅ Clean up empty directories last

**Confidence Score: 9/10** - Very high confidence due to straightforward file operations, systematic approach, and comprehensive validation steps that ensure no test functionality is lost during migration.