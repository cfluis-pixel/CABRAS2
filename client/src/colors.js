// Color de identidad por jugador: hue estable derivado de su posición de
// entrada (ángulo áureo → máxima separación visual con cualquier nº de jugadores)
export function playerHue(index) {
  return Math.round((210 + index * 137.508) % 360);
}

export function playerColor(index, sat = 72, light = 62) {
  return `hsl(${playerHue(index)} ${sat}% ${light}%)`;
}

export function playerGradient(index) {
  const h = playerHue(index);
  return `linear-gradient(135deg, hsl(${h} 75% 56%), hsl(${(h + 40) % 360} 70% 42%))`;
}
