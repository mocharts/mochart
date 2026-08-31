import merge from 'lodash.merge';

export const rotationData = [
  { "c": 1, "cd": "A text Label", "v": 123 },
  { "c": 2, "cd": "Some Long Text", "v": 24 },
  { "c": 3, "cd": "Cool", "v": 823 },
  { "c": 4, "cd": "Some Long Text", "v": 894 },
  { "c": 5, "cd": "Word", "v": 731 },
  { "c": 6, "cd": "Some Long Text", "v": 178 },
  { "c": 7, "cd": "Cool", "v": 420 },
  { "c": 8, "cd": "Some Long Text", "v": 295 },
  { "c": 9, "cd": "Oh", "v": 736 },
  { "c": 10, "cd": "Some Long Text", "v": 638 },
  { "c": 11, "cd": "Some Long Text", "v": 204 },
  { "c": 12, "cd": "Some Long Text", "v": 375 }
];

const baseConfig = {
  "version": "1.0.0",
  "chart": {
    "margin": { "top": 10, "right": 10, "bottom": 10, "left": 10 }
  },
  "plot": {
    "inverted": false
  },
  "title": {
    "text": "The Title"
  },
  "categoryAxis": {
    "valueLabel": "Category",
    "property": "cd",
    "keyProperty": "c",
    "type": "string",
    "scale": "ordinal",
    "title": {
      "text": "Category Axis Title",
      "truncation": {
        "enabled": true,
        "text": "..."
      }
    },
    "tickLabel": {
      "truncation": {
        "enabled": true,
        "text": "...",
        "maxFraction": 0.20
      },
      "anchor": "auto",
      "rotation": 0
    },
    "side": "start",
    "collapsed": false
  },
  "valueAxes": [
    {
      "id": "VA1",
      "base": 0,
      "min": 0
    }
  ],
  "series": [
    {
      "axis": "VA1",
      "property": "v",
      "title": "Series 1"
    }
  ]
};

export const rotationConfigs: Record<string, any>[] = [];

function addConfig(title: string, inverted: boolean, start: boolean, collapsed: boolean, rotation: number, anchor = "auto"): void {
  const configOverride = {
    "title": {
      "text": title
    },
    "plot": {
      "inverted": inverted
    },
    "categoryAxis": {
      "side": start ? "start" : "end",
      "collapsed": collapsed,
      "tickLabel": {
        "rotation": rotation,
        "anchor": anchor
      }
    }
  };
  rotationConfigs.push(merge({}, baseConfig, configOverride));
}

addConfig("A1", false, false, false, 0);
addConfig("B1", false, false, true, 0);
addConfig("C1", false, true, false, 0);
addConfig("D1", false, true, true, 0);
addConfig("E1", true, false, false, 0);
addConfig("F1", true, false, true, 0);
addConfig("G1", true, true, false, 0);
addConfig("H1", true, true, true, 0);

addConfig("A2", false, false, false, -40);
addConfig("B2", false, false, true, -40);
addConfig("C2", false, true, false, -40);
addConfig("D2", false, true, true, -40);
addConfig("E2", true, false, false, -40);
addConfig("F2", true, false, true, -40);
addConfig("G2", true, true, false, -40);
addConfig("H2", true, true, true, -40);

addConfig("A3", false, false, false, 40);
addConfig("B3", false, false, true, 40);
addConfig("C3", false, true, false, 40);
addConfig("D3", false, true, true, 40);
addConfig("E3", true, false, false, 40);
addConfig("F3", true, false, true, 40);
addConfig("G3", true, true, false, 40);
addConfig("H3", true, true, true, 40);

addConfig("A4", false, false, false, -90);
addConfig("B4", false, false, true, -90);
addConfig("C4", false, true, false, -90);
addConfig("D4", false, true, true, -90);
addConfig("E4", true, false, false, -90);
addConfig("F4", true, false, true, -90);
addConfig("G4", true, true, false, -90);
addConfig("H4", true, true, true, -90);

addConfig("A5", false, false, false, 90);
addConfig("B5", false, false, true, 90);
addConfig("C5", false, true, false, 90);
addConfig("D5", false, true, true, 90);
addConfig("E5", true, false, false, 90);
addConfig("F5", true, false, true, 90);
addConfig("G5", true, true, false, 90);
addConfig("H5", true, true, true, 90);

addConfig("A6", false, true, false, 0, "middle");
addConfig("B6", false, true, false, -40, "middle");
addConfig("C6", false, true, false, 40, "middle");
addConfig("D6", false, true, false, -90, "middle");
addConfig("E6", false, true, false, 90, "middle");

addConfig("A7", false, true, false, 0, "start");
addConfig("B7", false, true, false, -40, "start");
addConfig("C7", false, true, false, 40, "start");
addConfig("D7", false, true, false, -90, "start");
addConfig("E7", false, true, false, 90, "start");

addConfig("A8", false, true, false, 0, "end");
addConfig("B8", false, true, false, -40, "end");
addConfig("C8", false, true, false, 40, "end");
addConfig("D8", false, true, false, -90, "end");
addConfig("E8", false, true, false, 90, "end");

/**
 * Narrowest column the rotation grid will lay out. Below it the grid drops to a
 * single column rather than shrinking the cells further, since the point of the
 * page is legible axis labels.
 */
const rotationMinColumnWidth = 400;

export interface RotationGrid {
  cols: number;
  /** Cells are square, so this is their height too. */
  colWidth: number;
}

/**
 * The rotation grid's column count and cell size for a measured container width.
 * Always at least one column, so a container narrower than a cell still renders
 * (`colWidth` is 0 for a container that has not been measured yet, which the
 * ports read as "nothing to lay out").
 */
export function getRotationGrid(containerWidth: number): RotationGrid {
  const cols = Math.max(1, Math.floor(containerWidth / rotationMinColumnWidth));
  return { cols, colWidth: Math.floor(containerWidth / cols) };
}
