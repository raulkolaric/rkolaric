export const SNAKE_LENGTH = 24;

const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const key = ({ x, y }) => `${x}:${y}`;

export function createSnake(width, height) {
  const y = Math.floor(height / 2);
  const x = Math.floor(width / 2);
  return Array.from({ length: SNAKE_LENGTH }, (_, index) => ({
    x: (x - index + width) % width,
    y,
  }));
}

export function spawnApple(width, height, occupied, random = Math.random) {
  for (let attempt = 0; attempt < width * height; attempt++) {
    const apple = { x: Math.floor(random() * width), y: Math.floor(random() * height) };
    if (!occupied.has(key(apple))) return apple;
  }
  return null;
}

export function stepSnake(state, width, height, random = Math.random) {
  const [head] = state.snake;
  const target = state.apples.reduce((closest, apple) => {
    const distance = Math.abs(apple.x - head.x) + Math.abs(apple.y - head.y);
    return !closest || distance < closest.distance ? { apple, distance } : closest;
  }, null)?.apple;
  const blocked = new Set(state.snake.slice(0, -1).map(key));
  const choices = directions
    .filter(([dx, dy]) => dx !== -state.direction[0] || dy !== -state.direction[1])
    .map((direction) => ({
      direction,
      point: {
        x: (head.x + direction[0] + width) % width,
        y: (head.y + direction[1] + height) % height,
      },
    }))
    .filter(({ point }) => !blocked.has(key(point)));

  if (!choices.length) return { ...state, snake: createSnake(width, height), direction: [1, 0] };
  choices.sort((a, b) => {
    if (!target) return 0;
    const distance = ({ x, y }) => Math.abs(target.x - x) + Math.abs(target.y - y);
    return distance(a.point) - distance(b.point);
  });

  const { point, direction } = choices[0];
  const snake = [point, ...state.snake.slice(0, SNAKE_LENGTH - 1)];
  const apples = state.apples.filter((apple) => key(apple) !== key(point));
  const occupied = new Set([...snake, ...apples].map(key));
  while (apples.length < 2) {
    const apple = spawnApple(width, height, occupied, random);
    if (!apple) break;
    apples.push(apple);
    occupied.add(key(apple));
  }
  return { snake, apples, direction };
}
