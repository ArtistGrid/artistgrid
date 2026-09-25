import type { IconNode } from "morphicons/react";
export const PLAY_ICON_NODE: IconNode = [["polygon", { points: "6 3 20 12 6 21 6 3" }]];
export const PAUSE_ICON_NODE: IconNode = [
  ["line", { x1: "10", x2: "10", y1: "4", y2: "20" }],
  ["line", { x1: "14", x2: "14", y1: "4", y2: "20" }],
];
export const VOLUME_2_ICON_NODE: IconNode = [
  ["polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }],
  ["path", { d: "M15.54 8.46a5 5 0 0 1 0 7.07" }],
  ["path", { d: "M19.07 4.93a10 10 0 0 1 0 14.14" }],
];
export const VOLUME_X_ICON_NODE: IconNode = [
  ["polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }],
  ["line", { x1: "22", x2: "16", y1: "9", y2: "15" }],
  ["line", { x1: "16", x2: "22", y1: "9", y2: "15" }],
];
export const MAXIMIZE_ICON_NODE: IconNode = [
  ["polyline", { points: "15 3 21 3 21 9" }],
  ["polyline", { points: "9 21 3 21 3 15" }],
  ["line", { x1: "21", x2: "14", y1: "3", y2: "10" }],
  ["line", { x1: "3", x2: "10", y1: "21", y2: "14" }],
];
export const MINIMIZE_ICON_NODE: IconNode = [
  ["polyline", { points: "4 14 10 14 10 20" }],
  ["polyline", { points: "20 10 14 10 14 4" }],
  ["line", { x1: "14", x2: "21", y1: "10", y2: "3" }],
  ["line", { x1: "3", x2: "10", y1: "21", y2: "14" }],
];
