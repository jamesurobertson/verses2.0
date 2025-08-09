# PRD: Test File Organization Restructure

## Problem Statement
Current test files are centralized in `/tests` directory, making it harder to maintain tests alongside their corresponding components.

## Requirements
### New Organization Structure
- Move test files adjacent to source files
- Each component directory contains its test file
- Maintain consistent naming conventions
- Update Jest configuration for new structure

### Example Structure
```
src/
├── pages/
│   ├── AddVerse/
│   │   ├── AddVerse.tsx
│   │   ├── AddVerse.test.tsx
│   │   └── components/
│   └── Review/
│       ├── Review.tsx
│       ├── Review.test.tsx
│       └── hooks/
│           ├── useReview.ts
│           └── useReview.test.ts
```

## Technical Approach
### Migration Steps
1. Update Jest configuration to find tests in new locations
2. Move existing test files to component directories
3. Update import paths in test files
4. Remove empty `/tests` directory
5. Update npm scripts if needed

### Naming Convention
- Component tests: `ComponentName.test.tsx`
- Hook tests: `hookName.test.ts`
- Service tests: `serviceName.test.ts`

## Acceptance Criteria
- All tests moved to appropriate component directories
- Jest configuration updated to find tests in new locations
- All tests continue to pass after migration
- Import paths updated correctly
- Consistent naming convention applied

## Priority
Low

## Related Files
- `jest.config.ts`
- `package.json`
- All files in `/tests` directory
- Various component directories in `/src`