// Placeholder handlers for modules scheduled for later phases.
// Replace each stub with a real controller function when implementing the module.
export const createStubs = (resource, names) =>
  Object.fromEntries(
    names.map((name) => [
      name,
      (req, res) => res.status(501).json({ success: false, message: `${resource}.${name} is not implemented yet` }),
    ])
  );
