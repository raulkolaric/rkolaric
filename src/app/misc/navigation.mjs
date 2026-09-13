/**
 * @param {number[]} lengths
 * @param {{ collection: number, photo: number }} current
 * @param {"ArrowLeft" | "ArrowRight"} key
 */
export function photoForArrow(lengths, current, key) {
  const last = lengths[current.collection] - 1;
  const forward = key === "ArrowRight" || (key === "ArrowLeft" && current.photo === last);
  if (forward) {
    if (current.photo < last) return { collection: current.collection, photo: current.photo + 1 };
    return current.collection < lengths.length - 1
      ? { collection: current.collection + 1, photo: 0 }
      : current;
  }
  if (current.photo > 0) return { collection: current.collection, photo: current.photo - 1 };
  return current.collection > 0
    ? { collection: current.collection - 1, photo: lengths[current.collection - 1] - 1 }
    : current;
}
