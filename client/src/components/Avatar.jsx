import { playerGradient } from '../colors.js';

export default function Avatar({ name, index, size = 32 }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: playerGradient(index),
      }}
    >
      {initials}
    </span>
  );
}
