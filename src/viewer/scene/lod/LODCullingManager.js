import {LODState} from "./LODState.js";

/**
 * @private
 */
export class LODCullingManager {

    constructor(scene, sceneModel, lodLevels, targetFps) {
        this.id = sceneModel.id;
        this.scene = scene;
        this.sceneModel = sceneModel;
        this.lodState = new LODState(lodLevels, targetFps);
        this.lodState.initializeLodState(sceneModel);
        this.isCameraMoving = false;
        // Enagle LodCulling only on camera move
        this.timeoutDuration = 800; // Milliseconds
        this.timer = this.timeoutDuration;

        scene.camera.on("matrix", () => {
          this.timer = this.timeoutDuration;
          this.isCameraMoving = true;
        });
        scene.on ("tick", tickEvent => {
            // Only apply Lod Culling if camera is moving
            // Triggering the effect during coloring/selection/etc doesn't feel good.
            this.timer -= tickEvent.deltaTime;
            if (this.timer <= 0) {
                this.isCameraMoving = false;
            }
        });

    }

    /**
     * Cull any objects belonging to the current `LOD` level, and increase the `LOD` level.
     */
    _increaseLODLevelIndex() {
        const lodState = this.lodState;
        if (lodState.lodLevelIndex === lodState.primLODLevels.length) {
            return false;
        }
        const entitiesInLOD = lodState.entitiesInLOD [lodState.primLODLevels[lodState.lodLevelIndex]] || [];
        for (let i = 0, len = entitiesInLOD.length; i < len; i++) {

            entitiesInLOD[i].culledLOD = true;
        }
        lodState.lodLevelIndex++;
        return true;
    }

    /**
     * Un-cull any objects belonging to the current `LOD` level, and decrease the `LOD` level.
     */
    _decreaseLODLevelIndex() {
        const lodState = this.lodState;
        if (lodState.lodLevelIndex === 0) {
            return false;
        }
        const entitiesInLOD = lodState.entitiesInLOD [lodState.primLODLevels[lodState.lodLevelIndex - 1]] || [];
        for (let i = 0, len = entitiesInLOD.length; i < len; i++) {
            entitiesInLOD[i].culledLOD = false;
        }
        lodState.lodLevelIndex--;
        return true;
    }

    /**
     * Apply LOD culling.
     *
     * Will update LOD level, if needed, based on current FPS and target FPS,
     * and then will cull/uncull the needed objects according to the LOD level.
     *
     * @param {number} currentFPS The current FPS (frames per second)
     * @returns {boolean} Whether the LOD level was changed. This is, if some object was culled/unculled.
     */
    applyLodCulling(currentFPS) {
        let lodState = this.lodState;
        let retVal = false;
        if (this.isCameraMoving && currentFPS < lodState.targetFps) {
            retVal = this._increaseLODLevelIndex();
        } else if (!this.isCameraMoving) {
            while(this._decreaseLODLevelIndex() === true) {
                retVal = true;
            };
        }
        return retVal;
    }

    resetLodCulling() {
        let retVal = false;
        let decreasedLevel = false;
        do {
            retVal |= (decreasedLevel = this._decreaseLODLevelIndex());
        } while (decreasedLevel);
        return retVal;
    }
}
