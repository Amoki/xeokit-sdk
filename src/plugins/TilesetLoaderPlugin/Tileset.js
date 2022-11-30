import Tile from "./Tile.js";

import { eachLimit, makeQueue } from "./utils.js";

import { math } from "../../viewer/scene/math/math.js";

let tilesetIndex = 0;

export default class Tileset {
  /**
   * @param { TSL.TilesetLoaderPlugin } tilesetPlugin 
   * @param { TSL.TilesetData } tilesetData 
   * @returns { TSL.Tileset }
   */
  constructor(tilesetPlugin, tilesetData) {
    this.plugin = tilesetPlugin;

    this.name = tilesetData.name || `tileset-${tilesetIndex++}`;

    this.tiles = new Set();
    this.visibleTiles = new Set();
    this.loadedTiles = new Set();

    this.queue = null;

    this.renderNeeded = true;

    this.destroyed = false;

    this._viewDistance = tilesetPlugin.cfg.viewDistance;

    if (tilesetData.root.transform) {
      this.rootTransform = tilesetData.root.transform
    }

    const [x, y, z, a, b, c, d, e, f, g, h, i] = tilesetData.root.boundingVolume.box;
    this.diagonal = math.lenVec3(math.addVec3(math.addVec3([a, b, c], [d, e, f]), [g, h, i])) * 2;

    this.root = new Tile(this, tilesetData.root);

    this.root.load().then(model => tilesetPlugin.viewer.cameraFlight.flyTo(model));
  }

  get viewDistance() {
    return this._viewDistance;
  }

  set viewDistance(value) {
    this._viewDistance = value;

    this.updateVisibility();
  }

  updateVisibility() {
    this.tiles.forEach(tile => {
      if (tile !== this.root) {
        tile.visible = false;
      }
    });

    this.root.updateVisibility(this.plugin.viewer.camera.eye);
    this.renderNeeded = true;
  }

  render() {
    if (!this.renderNeeded) return;

    if (this.queue) {
      this.queue.cancel();
    }

    this.loadedTiles.forEach(loadedTile => {
      if (!loadedTile.visible) {
        loadedTile.unload();
      }
    });

    const sortedVisibleTiles = Array.from(this.visibleTiles)
      .filter(tile => !tile.loaded)
      .sort((a, b) => a.priority - b.priority);

    eachLimit(sortedVisibleTiles, 40, t => t.fetchData());

    this.queue = makeQueue(sortedVisibleTiles);

    this.queue.run(tile => tile.load());

    this.renderNeeded = false;
  }

  destroy() {
    if (this.queue) {
      this.queue.cancel();
    }

    this.loadedTiles.forEach(tile => tile.unload());

    this.destroyed = true;
  }
}
