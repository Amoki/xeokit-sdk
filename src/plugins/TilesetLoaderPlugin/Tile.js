import { math } from "../../viewer/scene/math/math.js";
import { Mesh, buildBoxLinesGeometry, ReadableGeometry, PhongMaterial } from "../../viewer/scene/index.js";

export default class Tile {
  /**
   * @constructor
   *
   * @param { TSL.Tileset } tileset
   * @param { TSL.TileData } tileData
   * @param { TSL.Tile } [parent=null]
   * @returns { TSL.Tile }
   */
  constructor(tileset, tileData, parent = null) {
    this.tileset = tileset;

    this.computePriority =
      tileset.plugin.cfg.computePriority;

    this.distanceFactorToFreeData =
      tileset.plugin.cfg.distanceFactorToFreeData;

    this.src = tileData.content.uri;

    const path = new URL(this.src).pathname;
    this.name = `${tileset.name}_${path.substring(path.lastIndexOf("/") + 1)}`;

    this.parent = parent;

    this.refine = tileData.refine;

    this.data = null;

    this.fetching = null;

    this.depth = parent ? parent.depth + 1 : 1;

    this.model = null;

    this.loadProcess = null;

    this.loading = false;

    this.currentDistanceFromCamera = null;

    this._visible = !parent; // root is visible

    this.priority = 1;

    this.geometricError = tileData.geometricError;

    const [x, y, z, a, b, c, d, e, f, g, h, i] = tileData.boundingVolume.box;

    const center = [x, z, -y];

    if (tileset.rootTransform) {
      center[0] += tileset.rootTransform[12];
      center[1] += tileset.rootTransform[14];
      center[2] += tileset.rootTransform[13];
    }

    this.center = Object.freeze(center);

    const halfXVector = [a, b, c];
    const halfYVector = [-d, -e, -f];
    const halfZVector = [g, h, i];

    this.diagonal = math.lenVec3(math.addVec3(math.addVec3(halfXVector, halfYVector), halfZVector)) * 2;

    this.xSize = math.lenVec3(halfXVector);
    this.ySize = math.lenVec3(halfZVector);
    this.zSize = math.lenVec3(halfYVector);

    this.volume =
      this.xSize *
      2 *
      this.ySize *
      2 *
      this.zSize *
      2;

    this.children = tileData.children?.map(
      child => new Tile(tileset, child, this)
    ) ?? [];

    tileset.tiles.add(this);
  }

  get visible() {
    return this._visible;
  }

  set visible(value) {
    if (this._visible === value) return;

    this._visible = value;

    if (value) {
      this.tileset.visibleTiles.add(this);
    } else {
      this.tileset.visibleTiles.delete(this);
    }
  }

  get loaded() {
    return Boolean(this.model);
  }

  get viewDistance() {
    return this.tileset.sensitivity * this.geometricError;
  }

  get isWithinCameraVisibleRange() {
    return this.currentDistanceFromCamera <= this.viewDistance;
  }

  updateVisibility(cameraEye) {
    this.currentDistanceFromCamera = math.distVec3(this.center, cameraEye);

    const isNotRoot = !!this.parent;
    if (isNotRoot) {
      this.visible = this.isWithinCameraVisibleRange;

      if (
        this.currentDistanceFromCamera >
        this.viewDistance * this.distanceFactorToFreeData
      ) {
        this.data = null;
      }
    }

    if (this.visible) {
      this.children.forEach(tile => tile.updateVisibility(cameraEye));
    }

    this.priority = this.computePriority(this);
  }

  fetchData() {
    if (this.data) return this.data;

    if (!this.fetching) {
      this.fetching = new Promise((resolve, reject) => {
        fetch(this.src).then(response => {
          if (response.ok) {
            response.arrayBuffer().then(arrayBuffer => {
              this.data = arrayBuffer;
              this.fetching = null;
              resolve(this.data);
            });
          } else {
            reject(response);
          }
        });
      });
    }

    return this.fetching;
  }

  showBoundingBox() {
    const { viewer } = this.tileset.plugin;

    const {
      xSize,
      ySize,
      zSize,
      center,
    } = this;

    const colorFactor = 1 / this.depth;

    this.boxLines = new Mesh(viewer.scene, {
      geometry: new ReadableGeometry(viewer.scene, buildBoxLinesGeometry({
         center,
         xSize,
         ySize,
         zSize
      })),
      material: new PhongMaterial(viewer.scene, {
         emissive: [1 - colorFactor ,colorFactor, (1 - colorFactor) / 2]
      })
    });
  }

  async load() {
    if (this.loading) {
      return this.loadProcess;
    }
    if (this.loaded) {
      return this.model;
    }

    this.loading = true;

    if (!this.data) {
      try {
        await this.fetchData();
      } catch (err) {
        console.warn(
          `[Xeokit - TilesetLoaderPlugin] Impossible to fetch data of tile "${this.name}".`,
          err
        );

        this.loading = false;
        return null;
      }
    }

    // visible may have been set to false while fetching data.
    if (!this.visible) {
      this.loading = false;
      return null;
    }

    if (this.tileset.plugin.cfg.dev) {
      this.showBoundingBox();
    }

    try {
      const loadingPromise = new Promise(res => {
        const model = this.tileset.plugin.loader.load({
          id: this.name,
          xkt: this.data,
          // To silent xeokit error
          metaModelData: {
            metaObjects: [
              {
                id: "metaModelRoot",
              },
            ],
          },
        });

        model.once("loaded", () => {
          this.loading = false;

          this.loadProcess = null;

          this.model = model;

          if (this.tileset.destroyed || !this.visible) {
            this.unload();
            res(null);
          } else {
            this.tileset.loadedTiles.add(this);
            res(model);
          }
        });

        model.once("destroyed", () => {
          this.loading = false;

          this.loadProcess = null;

          res(null);
        });
      });

      this.loadProcess = loadingPromise;

      return this.loadProcess;
    } catch (err) {
      console.warn(
        `[Xeokit - TilesetLoaderPlugin] Impossible to load tile "${this.name}".`,
        err
      );

      return null;
    }
  }

  unload() {
    if (this.boxLines) {
      this.boxLines.destroy();
      this.boxLines = null;
    }

    if (this.model) {
      this.model.destroy();
      this.model = null;
    }

    this.tileset.loadedTiles.delete(this);

    this.children.forEach(tile => {
      if (tile.loaded) {
        tile.unload();
      }
    });
  }
}
