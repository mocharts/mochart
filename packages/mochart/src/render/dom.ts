export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// SVG attributes that are genuinely camelCase; everything else camelCase gets kebab-cased (strokeWidth -> stroke-width)
const SVG_CAMEL_ATTRIBUTES = new Set([
  'attributeName', 'attributeType', 'baseFrequency', 'baseProfile', 'calcMode', 'clipPathUnits',
  'diffuseConstant', 'edgeMode', 'filterUnits', 'gradientTransform', 'gradientUnits', 'kernelMatrix',
  'kernelUnitLength', 'keyPoints', 'keySplines', 'keyTimes', 'lengthAdjust', 'limitingConeAngle',
  'markerHeight', 'markerUnits', 'markerWidth', 'maskContentUnits', 'maskUnits', 'numOctaves',
  'pathLength', 'patternContentUnits', 'patternTransform', 'patternUnits', 'pointsAtX', 'pointsAtY',
  'pointsAtZ', 'preserveAlpha', 'preserveAspectRatio', 'primitiveUnits', 'refX', 'refY', 'repeatCount',
  'repeatDur', 'requiredExtensions', 'requiredFeatures', 'specularConstant', 'specularExponent',
  'spreadMethod', 'startOffset', 'stdDeviation', 'stitchTiles', 'surfaceScale', 'systemLanguage',
  'tableValues', 'targetX', 'targetY', 'textLength', 'viewBox', 'xChannelSelector', 'yChannelSelector',
  'zoomAndPan'
]);

// style properties whose numeric values must not get a px suffix
const UNITLESS_STYLES = new Set([
  'animationIterationCount', 'columnCount', 'fillOpacity', 'flex', 'flexGrow', 'flexShrink',
  'fontWeight', 'gridColumn', 'gridRow', 'lineClamp', 'lineHeight', 'opacity', 'order', 'orphans',
  'strokeDashoffset', 'strokeOpacity', 'strokeWidth', 'tabSize', 'widows', 'zIndex', 'zoom'
]);

type PropertyMap = Record<string, unknown>;
type ElementWithListeners = Element & { _listeners?: Record<string, EventListener | null | undefined> };

function isPropertyMap(value: unknown): value is PropertyMap {
  return typeof value === 'object' && value !== null;
}

function setStyleValue(style: CSSStyleDeclaration, name: string, value: unknown): void {
  const properties = style as unknown as PropertyMap;
  if (value == null || value === false) {
    properties[name] = '';
  }
  else if (typeof value === 'number' && !UNITLESS_STYLES.has(name)) {
    properties[name] = value + 'px';
  }
  else {
    properties[name] = value;
  }
}

function setStyle(style: CSSStyleDeclaration, oldValue: unknown, newValue: unknown): void {
  if (typeof newValue === 'string') {
    style.cssText = newValue;
    return;
  }
  if (typeof oldValue === 'string') {
    style.cssText = '';
    oldValue = null;
  }
  if (isPropertyMap(oldValue)) {
    for (const name in oldValue) {
      if (!isPropertyMap(newValue) || !(name in newValue)) {
        setStyleValue(style, name, '');
      }
    }
  }
  if (isPropertyMap(newValue)) {
    for (const name in newValue) {
      if (!isPropertyMap(oldValue) || oldValue[name] !== newValue[name]) {
        setStyleValue(style, name, newValue[name]);
      }
    }
  }
}

function eventProxy(this: ElementWithListeners, event: Event): void {
  const handler = this._listeners && this._listeners[event.type];
  if (handler) {
    handler(event);
  }
}

/**
 * Write a single prop to a DOM element, diffing against the previously set
 * value. Handles style objects, className, onXxx event listeners, boolean
 * attributes, and SVG camelCase -> kebab-case conversion.
 */
export function setProperty(dom: Element, name: string, oldValue: unknown, newValue: unknown, isSvg: boolean): void {
  if (name === 'children' || name === 'key' || name === 'ref') {
    return;
  }
  if (name === 'style') {
    setStyle((dom as HTMLElement).style, oldValue, newValue);
    // clearing a style empties the declaration but leaves the attribute, so style=""
    // would linger forever on anything ever styled (a hidden axis tick mid-tween)
    if (!newValue && (dom as HTMLElement).style.length === 0 && dom.hasAttribute('style')) {
      dom.removeAttribute('style');
    }
    return;
  }
  if (name[0] === 'o' && name[1] === 'n' && name.length > 2 && name[2] === name[2].toUpperCase()) {
    const eventType = name.slice(2).toLowerCase();
    const listenerDom = dom as ElementWithListeners;
    const listeners = listenerDom._listeners || (listenerDom._listeners = {});
    if (newValue && !listeners[eventType]) {
      dom.addEventListener(eventType, eventProxy);
    }
    else if (!newValue && listeners[eventType]) {
      dom.removeEventListener(eventType, eventProxy);
    }
    listeners[eventType] = newValue as EventListener | null | undefined;
    return;
  }
  if (oldValue === newValue) {
    return;
  }
  if (name === 'className') {
    name = 'class';
  }
  if (isSvg) {
    if (!SVG_CAMEL_ATTRIBUTES.has(name) && /[A-Z]/.test(name)) {
      name = name.replace(/([A-Z])/g, '-$1').toLowerCase();
    }
  }
  else if (name === 'value' || name === 'checked' || name === 'selected') {
    (dom as unknown as PropertyMap)[name] = newValue == null ? '' : newValue;
    return;
  }
  if (newValue == null || newValue === false) {
    dom.removeAttribute(name);
  }
  else {
    dom.setAttribute(name, newValue === true ? '' : String(newValue));
  }
}
