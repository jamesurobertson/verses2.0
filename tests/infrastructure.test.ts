// TDD Step 1: RED - Write a failing test to verify test infrastructure
describe('Test Infrastructure Verification', () => {
  test('should pass to verify test infrastructure is working correctly', () => {
    // This test should now pass to confirm Jest infrastructure is working
    expect(true).toBe(true);
  });

  test('Math should work correctly', () => {
    expect(2 + 2).toBe(4);
  });
});