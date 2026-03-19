export function isSharedProject(projectLike) {
  if (projectLike == null) {
    return false;
  }

  const value = typeof projectLike === "object" ? projectLike.is_shared : projectLike;
  return value === 1 || value === true;
}