import { fork, guard, keys, opt } from "js-tools";

type TSide = "left" | "right" | "top" | "bottom";
const defaultConfig = {
  resize: true,
  move: true,
  inParent: true,
  accelerate: 1,
  onMove: (x: number, y: number) => {},
  onResize: (side: TSide, dis: number) => {},
  mouse: { x: 0, y: 0 },
};
type TConfig = typeof defaultConfig;
type PConfig = Partial<TConfig>;
type THandle = typeof moveElement;

const translateRGX = /translate\((-?\d+).*,\s*(-?\d+).+\)/i;
const edgeRadius = 20;

export function interact(elm: HTMLElement, config: PConfig = defaultConfig) {
  config = { ...defaultConfig, ...config };
  let handlers: ((e: MouseEvent) => void)[] = [changeCursor];
  elm.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    config.mouse = { x: e.clientX, y: e.clientY };
    elm.setPointerCapture(e.pointerId);
    handlers = [];
    fork(
      guard((e: MouseEvent) => {
        handlers.push((e) => moveElement(e, config as TConfig));
      }, isInside),
      guard((e: MouseEvent) => {
        handlers.push((e) => resizeLeft(e, config as TConfig));
      }, isOnLeft),
      guard((e: MouseEvent) => {
        handlers.push((e) => resizeRight(e, config as TConfig));
      }, isOnRight),
      guard((e: MouseEvent) => {
        handlers.push((e) => resizeTop(e, config as TConfig));
      }, isOnTop),
      guard((e: MouseEvent) => {
        handlers.push((e) => resizeBottom(e, config as TConfig));
      }, isOnBottom)
    )(e);
  });
  elm.addEventListener("pointermove", (e) => {
    e.preventDefault();
    handlers.forEach((f) => f(e));
  });
  elm.addEventListener("pointerup", (e) => {
    e.preventDefault();
    elm.releasePointerCapture(e.pointerId);
    handlers = [changeCursor];
  });
}
function moveElement(e: MouseEvent, config: typeof defaultConfig) {
  let elm = e.target as HTMLElement;
  elm.style.cursor = "grabbing";
  let disX = calcDis(e, config, "x");
  let disY = calcDis(e, config, "y");
  let [x, y] = translateElm(disX, disY, elm);
  config.onMove?.(x, y);
}
function resizeLeft(e: MouseEvent, c: TConfig) {
  let dis = calcDis(e, c, "x", "left");
  let elm = e.target as HTMLElement;
  let width = elm.offsetWidth;
  elm.style.width = width - dis + "px";
  translateElm(dis, 0, elm);
  c.onResize?.("left", dis);
}
function resizeRight(e: MouseEvent, c: TConfig) {
  let dis = calcDis(e, c, "x", "right");
  let elm = e.target as HTMLElement;
  let width = elm.offsetWidth;
  elm.style.width = width + dis + "px";
  c.onResize?.("right", dis);
}
function resizeTop(e: MouseEvent, c: TConfig) {
  let dis = calcDis(e, c, "y", "top");
  let elm = e.target as HTMLElement;
  let height = elm.offsetHeight;
  elm.style.height = height - dis + "px";
  translateElm(0, dis, elm);
  c.onResize?.("top", dis);
}
function resizeBottom(e: MouseEvent, c: TConfig) {
  let dis = calcDis(e, c, "y", "bottom");
  let elm = e.target as HTMLElement;
  let height = elm.offsetHeight;
  elm.style.height = height + dis + "px";
  c.onResize?.("bottom", dis);
}

function isInside(e: MouseEvent) {
  let rect = (e.target as HTMLElement).getBoundingClientRect() as any;
  return keys(sides).every((d) =>
    (sides[d] as any).every(
      (s: any) =>
        Math.abs(rect[s] - (e as any)["client" + d.toUpperCase()]) >= edgeRadius
    )
  );
}
export function translateElm(x: number, y: number, elm: HTMLElement) {
  let coord = [x, y];
  let m = elm.style.transform.match(translateRGX);

  coord.forEach((v, i) => {
    m && (coord[i] += parseInt(m[i + 1]));
  });
  let transString = `translate(${coord.map((v) => v + "px").join(",")})`;
  if (m) {
    elm.style.transform = elm.style.transform.replace(
      translateRGX,
      () => transString
    );
  } else {
    elm.style.transform += `translate(${coord.map((v) => v + "px").join(",")})`;
  }
  return coord;
}
function isOnLeft(e: MouseEvent) {
  return (
    Math.abs(
      e.clientX - (e.target as HTMLElement).getBoundingClientRect().left
    ) < edgeRadius
  );
}
function isOnRight(e: MouseEvent) {
  return (
    Math.abs(
      e.clientX - (e.target as HTMLElement).getBoundingClientRect().right
    ) < edgeRadius
  );
}
function isOnTop(e: MouseEvent) {
  return (
    Math.abs(
      e.clientY - (e.target as HTMLElement).getBoundingClientRect().top
    ) < edgeRadius
  );
}
function isOnBottom(e: MouseEvent) {
  return (
    Math.abs(
      e.clientY - (e.target as HTMLElement).getBoundingClientRect().bottom
    ) < edgeRadius
  );
}

function changeCursor(e: MouseEvent) {
  fork(
    guard((e: MouseEvent) => setCursorStyle(e, "grab"), isInside),
    guard((e: MouseEvent) => setCursorStyle(e, "w-resize"), isOnLeft),
    guard((e: MouseEvent) => setCursorStyle(e, "e-resize"), isOnRight),
    guard((e: MouseEvent) => setCursorStyle(e, "n-resize"), isOnTop),
    guard((e: MouseEvent) => setCursorStyle(e, "s-resize"), isOnBottom),
    guard((e: MouseEvent) => setCursorStyle(e, "nw-resize"), isOnTop, isOnLeft),
    guard(
      (e: MouseEvent) => setCursorStyle(e, "ne-resize"),
      isOnTop,
      isOnRight
    ),
    guard(
      (e: MouseEvent) => setCursorStyle(e, "sw-resize"),
      isOnBottom,
      isOnLeft
    ),
    guard(
      (e: MouseEvent) => setCursorStyle(e, "se-resize"),
      isOnBottom,
      isOnRight
    )
  )(e);
}
function setCursorStyle(e: MouseEvent, cursor: string) {
  (e.target as HTMLElement).style.cursor = cursor;
}

const sides = {
  x: ["left", "right"] as const,
  y: ["top", "bottom"] as const,
};
function calcDis(
  e: MouseEvent,
  config: TConfig,
  direction: "x" | "y",
  side?: TSide
) {
  let elm = e.target as HTMLElement;
  let mkey = ("client" + direction.toUpperCase()) as `client${Uppercase<
    typeof direction
  >}`;
  let dis = e[mkey] - config.mouse[direction];
  !side && (side = dis < 0 ? sides[direction][0] : sides[direction][1]);
  dis *= config.accelerate;
  let length: 'width' | 'height' = direction === 'x'?'width':'height';
  if (config.inParent) {
    let rect = elm.getBoundingClientRect();
    let parentRect = elm.parentElement?.getBoundingClientRect() as DOMRect;
    if (rect[length] <= parentRect[length]) {
      let s = sides[direction][0];
      opt({
        "left,top": (side: TSide) => {
          if (parentRect[side] > rect[side] + dis)
            dis = parentRect[side] - rect[side];
        },
        "right,bottom": (side: TSide) => {
          if (parentRect[side] < rect[side] + dis)
            dis = parentRect[side] - rect[side];
        },
        _: (side: TSide) => side,
      })(side);
    }else dis =0;
  }
  config.mouse[direction] = e[mkey];
  return dis;
}
