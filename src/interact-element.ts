import { aim, fork, guard, keys, opt } from "js-tools";

type TSide = "left" | "right" | "top" | "bottom";
type TDirection = "x" | "y";
const defaultConfig = {
  resize: true,
  move: true,
  inParent: true,
  accelerate: 1,
  edgeRadius: 20,
  onMove: (x: number, y: number) => {},
  onResize: (side: TSide, dis: number) => {},
  mouse: { x: 0, y: 0 },
};
type TConfig = typeof defaultConfig;
type PConfig = Partial<TConfig>;
type THandle = typeof moveElement;

const translateRGX = /translate\((-?\d+).*,\s*(-?\d+).+\)/i;

export function interact(elm: HTMLElement, config?: PConfig) {
  let c: TConfig = { ...defaultConfig, ...config };
  elm.style.position = "absolute";
  elm.style.boxSizing = "border-box";
  !c.resize && (c.edgeRadius = 0);
  let changeCursorListener = (e: MouseEvent) => changeCursor(e, c as TConfig);
  let handlers: ((e: MouseEvent) => void)[] = [changeCursorListener];
  elm.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    c.mouse = { x: e.clientX, y: e.clientY };
    elm.setPointerCapture(e.pointerId);
    handlers = [];
    fork(
      guard((e: MouseEvent, c: TConfig) => {
        handlers.push((e) => moveElement(e, c));
      }, isInside),
      guard(
        fork(
          guard((e: MouseEvent, c) => {
            handlers.push((e) => resize(e, c, "left"));
          }, isOnLeft),
          guard((e: MouseEvent, c) => {
            handlers.push((e) => resize(e, c, "right"));
          }, isOnRight),
          guard((e: MouseEvent, c) => {
            handlers.push((e) => resize(e, c, "top"));
          }, isOnTop),
          guard((e: MouseEvent, c) => {
            handlers.push((e) => resize(e, c, "bottom"));
          }, isOnBottom)
        ),
        () => (c as TConfig).resize
      )
    )(e, c as TConfig);
  });
  elm.addEventListener("pointermove", (e) => {
    e.preventDefault();
    handlers.forEach((f) => f(e));
  });
  elm.addEventListener("pointerup", (e) => {
    e.preventDefault();
    elm.releasePointerCapture(e.pointerId);
    handlers = [changeCursorListener];
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
function resize(e: MouseEvent, c: TConfig, side: TSide) {
  let direction: TDirection = side === "right" || side === "left" ? "x" : "y";
  let dis = calcDis(e, c, direction, side);
  let elm = e.target as HTMLElement;
  resizeElmSide(side, dis, elm);
  c.onResize?.(side, dis);
}
export function resizeElmSide(side: TSide, dis: number, elm: HTMLElement) {
  let direction: TDirection = side === "right" || side === "left" ? "x" : "y";
  if (direction === "x") {
    let width = elm.offsetWidth;
    if (side === "right") elm.style.width = width + dis + "px";
    else {
      elm.style.width = width - dis + "px";
      translateElm(dis, 0, elm);
    }
  } else {
    let height = elm.offsetHeight;
    if (side === "bottom") elm.style.height = height + dis + "px";
    else {
      elm.style.height = height - dis + "px";
      translateElm(0, dis, elm);
    }
  }
}
function isInside(e: MouseEvent, { edgeRadius }: TConfig) {
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
function isOnLeft(e: MouseEvent, { edgeRadius }: TConfig) {
  return (
    Math.abs(
      e.clientX - (e.target as HTMLElement).getBoundingClientRect().left
    ) < edgeRadius
  );
}
function isOnRight(e: MouseEvent, { edgeRadius }: TConfig) {
  return (
    Math.abs(
      e.clientX - (e.target as HTMLElement).getBoundingClientRect().right
    ) < edgeRadius
  );
}
function isOnTop(e: MouseEvent, { edgeRadius }: TConfig) {
  return (
    Math.abs(
      e.clientY - (e.target as HTMLElement).getBoundingClientRect().top
    ) < edgeRadius
  );
}
function isOnBottom(e: MouseEvent, { edgeRadius }: TConfig) {
  return (
    Math.abs(
      e.clientY - (e.target as HTMLElement).getBoundingClientRect().bottom
    ) < edgeRadius
  );
}

function changeCursor(e: MouseEvent, c: TConfig) {
  fork(
    guard((e: MouseEvent, c: TConfig) => setCursorStyle(e, "grab"), isInside),
    guard(
      fork(
        guard(
          (e: MouseEvent, c: TConfig) => setCursorStyle(e, "w-resize"),
          isOnLeft
        ),
        guard(
          (e: MouseEvent, c: TConfig) => setCursorStyle(e, "e-resize"),
          isOnRight
        ),
        guard(
          (e: MouseEvent, c: TConfig) => setCursorStyle(e, "n-resize"),
          isOnTop
        ),
        guard(
          (e: MouseEvent, c: TConfig) => setCursorStyle(e, "s-resize"),
          isOnBottom
        ),
        guard(
          (e: MouseEvent, c: TConfig) => setCursorStyle(e, "nw-resize"),
          isOnTop,
          isOnLeft
        ),
        guard(
          (e: MouseEvent, c: TConfig) => setCursorStyle(e, "ne-resize"),
          isOnTop,
          isOnRight
        ),
        guard(
          (e: MouseEvent, c: TConfig) => setCursorStyle(e, "sw-resize"),
          isOnBottom,
          isOnLeft
        ),
        guard(
          (e: MouseEvent, c: TConfig) => setCursorStyle(e, "se-resize"),
          isOnBottom,
          isOnRight
        )
      ),
      () => c.resize
    )
  )(e, c);
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
  direction: TDirection,
  side?: TSide
) {
  let elm = e.target as HTMLElement;
  let mkey = ("client" + direction.toUpperCase()) as `client${Uppercase<
    typeof direction
  >}`;
  let dis = e[mkey] - config.mouse[direction];
  !side && (side = dis < 0 ? sides[direction][0] : sides[direction][1]);
  dis *= config.accelerate;
  let length: "width" | "height" = direction === "x" ? "width" : "height";
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
    } else dis = 0;
  }
  config.mouse[direction] = e[mkey];
  return dis;
}
