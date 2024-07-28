import {math} from "../../viewer/scene/math/math.js";
import {utils} from "../../viewer/scene/utils.js";
import {core} from "../../viewer/scene/core.js";
import {sRGBEncoding} from "../../viewer/scene/constants/constants.js";
import {worldToRTCPositions} from "../../viewer/scene/math/rtcCoords.js";
import {parse} from '@loaders.gl/core';
import {GLTFLoader} from '@loaders.gl/gltf/dist/esm/gltf-loader.js';
import {
    ClampToEdgeWrapping,
    LinearFilter,
    LinearMipMapLinearFilter,
    LinearMipMapNearestFilter,
    MirroredRepeatWrapping,
    NearestFilter,
    NearestMipMapLinearFilter,
    NearestMipMapNearestFilter,
    RepeatWrapping
} from "../../viewer/scene/constants/constants.js";

/**
 * @private
 */
class GLTFSceneModelLoader {

    constructor(cfg) {
        cfg = cfg || {};
    }

    load(plugin, src, metaModelJSON, options, sceneModel, ok, error) {
        options = options || {};
        loadGLTF(plugin, src, metaModelJSON, options, sceneModel, function () {
                core.scheduleTask(function () {
                    sceneModel.scene.fire("modelLoaded", sceneModel.id); // FIXME: Assumes listeners know order of these two events
                    sceneModel.fire("loaded", true, false);
                });
                if (ok) {
                    ok();
                }
            },
            function (msg) {
                plugin.error(msg);
                if (error) {
                    error(msg);
                }
                sceneModel.fire("error", msg);
            });
    }

    parse(plugin, gltf, metaModelJSON, options, sceneModel, ok, error) {
        options = options || {};
        parseGLTF(plugin, "", gltf, metaModelJSON, options, sceneModel, function () {
                sceneModel.scene.fire("modelLoaded", sceneModel.id); // FIXME: Assumes listeners know order of these two events
                sceneModel.fire("loaded", true, false);
                if (ok) {
                    ok();
                }
            },
            function (msg) {
                sceneModel.error(msg);
                sceneModel.fire("error", msg);
                if (error) {
                    error(msg);
                }
            });
    }
}

function loadGLTF(plugin, src, metaModelJSON, options, sceneModel, ok, error) {
    const spinner = plugin.viewer.scene.canvas.spinner;
    spinner.processes++;
    const isGLB = (src.split('.').pop() === "glb");
    if (isGLB) {
        plugin.dataSource.getGLB(src, (arrayBuffer) => { // OK
                options.basePath = getBasePath(src);
                parseGLTF(plugin, src, arrayBuffer, metaModelJSON, options, sceneModel, ok, error);
                spinner.processes--;
            },
            (err) => {
                spinner.processes--;
                error(err);
            });
    } else {
        plugin.dataSource.getGLTF(src, (gltf) => { // OK
                options.basePath = getBasePath(src);
                parseGLTF(plugin, src, gltf, metaModelJSON, options, sceneModel, ok, error);
                spinner.processes--;
            },
            (err) => {
                spinner.processes--;
                error(err);
            });
    }
}

function getBasePath(src) {
    const i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}

function parseGLTF(plugin, src, gltf, metaModelJSON, options, sceneModel, ok) {
    const spinner = plugin.viewer.scene.canvas.spinner;
    spinner.processes++;
    parse(gltf, GLTFLoader, {
        baseUri: options.basePath
    }).then((gltfData) => {
        const ctx = {
            src: src,
            entityId: options.entityId,
            metaModelJSON,
            autoMetaModel: options.autoMetaModel,
            metaObjects: [],
            loadBuffer: options.loadBuffer,
            basePath: options.basePath,
            handlenode: options.handlenode,
            backfaces: !!options.backfaces,
            gltfData: gltfData,
            scene: sceneModel.scene,
            plugin: plugin,
            sceneModel: sceneModel,
            //geometryCreated: {},
            numObjects: 0,
            nodes: [],
            nextId: 0,
            log: (msg) => {
                plugin.log(msg);
            }
        };
        loadTextures(ctx);
        loadMaterials(ctx);
        if (options.autoMetaModel) {
          ctx.metaObjects.push({
              id: sceneModel.id,
              type: "Default",
              name: sceneModel.id
          });
        }
        loadDefaultScene(ctx);
        sceneModel.finalize();
        if (options.autoMetaModel) {
            plugin.viewer.metaScene.createMetaModel(sceneModel.id, {
                metaObjects: ctx.metaObjects
            });
        }
        spinner.processes--;
        ok();
    });
}

function loadTextures(ctx) {
    const gltfData = ctx.gltfData;
    const textures = gltfData.textures;
    if (textures) {
        for (let i = 0, len = textures.length; i < len; i++) {
            loadTexture(ctx, textures[i]);
        }
    }
}

function loadTexture(ctx, texture) {
    if (!texture.source || !texture.source.image) {
        return;
    }
    const textureId = `texture-${ctx.nextId++}`;

    let minFilter = NearestMipMapLinearFilter;
    switch (texture.sampler.minFilter) {
        case 9728:
            minFilter = NearestFilter;
            break;
        case 9729:
            minFilter = LinearFilter;
            break;
        case 9984:
            minFilter = NearestMipMapNearestFilter;
            break;
        case 9985:
            minFilter = LinearMipMapNearestFilter;
            break;
        case 9986:
            minFilter = NearestMipMapLinearFilter;
            break;
        case 9987:
            minFilter = LinearMipMapLinearFilter;
            break;
    }

    let magFilter = LinearFilter;
    switch (texture.sampler.magFilter) {
        case 9728:
            magFilter = NearestFilter;
            break;
        case 9729:
            magFilter = LinearFilter;
            break;
    }

    let wrapS = RepeatWrapping;
    switch (texture.sampler.wrapS) {
        case 33071:
            wrapS = ClampToEdgeWrapping;
            break;
        case 33648:
            wrapS = MirroredRepeatWrapping;
            break;
        case 10497:
            wrapS = RepeatWrapping;
            break;
    }

    let wrapT = RepeatWrapping;
    switch (texture.sampler.wrapT) {
        case 33071:
            wrapT = ClampToEdgeWrapping;
            break;
        case 33648:
            wrapT = MirroredRepeatWrapping;
            break;
        case 10497:
            wrapT = RepeatWrapping;
            break;
    }

    let wrapR = RepeatWrapping;
    switch (texture.sampler.wrapR) {
        case 33071:
            wrapR = ClampToEdgeWrapping;
            break;
        case 33648:
            wrapR = MirroredRepeatWrapping;
            break;
        case 10497:
            wrapR = RepeatWrapping;
            break;
    }
    ctx.sceneModel.createTexture({
        id: textureId,
        image: texture.source.image,
        flipY: !!texture.flipY,
        minFilter,
        magFilter,
        wrapS,
        wrapT,
        wrapR,
        encoding: sRGBEncoding
    });
    texture._textureId = textureId;
}

function loadMaterials(ctx) {
    const gltfData = ctx.gltfData;
    const materials = gltfData.materials;
    if (materials) {
        for (let i = 0, len = materials.length; i < len; i++) {
            const material = materials[i];
            material._textureSetId = loadTextureSet(ctx, material);
            material._attributes = loadMaterialAttributes(ctx, material);
        }
    }
}

function loadTextureSet(ctx, material) {
    const textureSetCfg = {};
    if (material.normalTexture) {
        textureSetCfg.normalTextureId = material.normalTexture.texture._textureId;
    }
    if (material.occlusionTexture) {
        textureSetCfg.occlusionTextureId = material.occlusionTexture.texture._textureId;
    }
    if (material.emissiveTexture) {
        textureSetCfg.emissiveTextureId = material.emissiveTexture.texture._textureId;
    }
    // const alphaMode = material.alphaMode;
    // switch (alphaMode) {
    //     case "NORMAL_OPAQUE":
    //         materialCfg.alphaMode = "opaque";
    //         break;
    //     case "MASK":
    //         materialCfg.alphaMode = "mask";
    //         break;
    //     case "BLEND":
    //         materialCfg.alphaMode = "blend";
    //         break;
    //     default:
    // }
    // const alphaCutoff = material.alphaCutoff;
    // if (alphaCutoff !== undefined) {
    //     materialCfg.alphaCutoff = alphaCutoff;
    // }
    const metallicPBR = material.pbrMetallicRoughness;
    if (material.pbrMetallicRoughness) {
        const pbrMetallicRoughness = material.pbrMetallicRoughness;
        const baseColorTexture = pbrMetallicRoughness.baseColorTexture || pbrMetallicRoughness.colorTexture;
        if (baseColorTexture) {
            if (baseColorTexture.texture) {
                textureSetCfg.colorTextureId = baseColorTexture.texture._textureId;
            } else {
                textureSetCfg.colorTextureId = ctx.gltfData.textures[baseColorTexture.index]._textureId;
            }
        }
        if (metallicPBR.metallicRoughnessTexture) {
            textureSetCfg.metallicRoughnessTextureId = metallicPBR.metallicRoughnessTexture.texture._textureId;
        }
    }
    const extensions = material.extensions;
    if (extensions) {
        const specularPBR = extensions["KHR_materials_pbrSpecularGlossiness"];
        if (specularPBR) {
            const specularTexture = specularPBR.specularTexture;
            if (specularTexture !== null && specularTexture !== undefined) {
                //  textureSetCfg.colorTextureId = ctx.gltfData.textures[specularColorTexture.index]._textureId;
            }
            const specularColorTexture = specularPBR.specularColorTexture;
            if (specularColorTexture !== null && specularColorTexture !== undefined) {
                textureSetCfg.colorTextureId = ctx.gltfData.textures[specularColorTexture.index]._textureId;
            }
        }
    }
    if (textureSetCfg.normalTextureId !== undefined ||
        textureSetCfg.occlusionTextureId !== undefined ||
        textureSetCfg.emissiveTextureId !== undefined ||
        textureSetCfg.colorTextureId !== undefined ||
        textureSetCfg.metallicRoughnessTextureId !== undefined) {
        textureSetCfg.id = `textureSet-${ctx.nextId++};`
        ctx.sceneModel.createTextureSet(textureSetCfg);
        return textureSetCfg.id;
    }
    return null;
}

function loadMaterialAttributes(ctx, material) { // Substitute RGBA for material, to use fast flat shading instead
    const extensions = material.extensions;
    const materialAttributes = {
        color: new Float32Array([1, 1, 1, 1]),
        opacity: 1,
        metallic: 0,
        roughness: 1,
        doubleSided: true
    };
    if (extensions) {
        const specularPBR = extensions["KHR_materials_pbrSpecularGlossiness"];
        if (specularPBR) {
            const diffuseFactor = specularPBR.diffuseFactor;
            if (diffuseFactor !== null && diffuseFactor !== undefined) {
                materialAttributes.color.set(diffuseFactor);
            }
        }
        const common = extensions["KHR_materials_common"];
        if (common) {
            const technique = common.technique;
            const values = common.values || {};
            const blinn = technique === "BLINN";
            const phong = technique === "PHONG";
            const lambert = technique === "LAMBERT";
            const diffuse = values.diffuse;
            if (diffuse && (blinn || phong || lambert)) {
                if (!utils.isString(diffuse)) {
                    materialAttributes.color.set(diffuse);
                }
            }
            const transparency = values.transparency;
            if (transparency !== null && transparency !== undefined) {
                materialAttributes.opacity = transparency;
            }
            const transparent = values.transparent;
            if (transparent !== null && transparent !== undefined) {
                materialAttributes.opacity = transparent;
            }
        }
    }
    const metallicPBR = material.pbrMetallicRoughness;
    if (metallicPBR) {
        const baseColorFactor = metallicPBR.baseColorFactor;
        if (baseColorFactor) {
            materialAttributes.color[0] = baseColorFactor[0];
            materialAttributes.color[1] = baseColorFactor[1];
            materialAttributes.color[2] = baseColorFactor[2];
            materialAttributes.opacity = baseColorFactor[3];
        }
        const metallicFactor = metallicPBR.metallicFactor;
        if (metallicFactor !== null && metallicFactor !== undefined) {
            materialAttributes.metallic = metallicFactor;
        }
        const roughnessFactor = metallicPBR.roughnessFactor;
        if (roughnessFactor !== null && roughnessFactor !== undefined) {
            materialAttributes.roughness = roughnessFactor;
        }
    }
    materialAttributes.doubleSided = (material.doubleSided !== false);
    return materialAttributes;
}

function loadDefaultScene(ctx) {
    const gltfData = ctx.gltfData;
    const scene = gltfData.scene || gltfData.scenes[0];
    if (!scene) {
        error(ctx, "glTF has no default scene");
        return;
    }
    loadScene(ctx, scene);
}

function loadScene(ctx, scene) {
    const nodes = scene.nodes;
    if (!nodes) {
        return;
    }
    for (let i = 0, len = nodes.length; i < len; i++) {
        const node = nodes[i];
        countMeshUsage(ctx, node);
    }
    for (let i = 0, len = nodes.length; i < len && !ctx.nodesHaveNames; i++) {
        const node = nodes[i];
        if (testIfNodesHaveNames(node)) {
            ctx.nodesHaveNames = true;
        }
    }
    if (!ctx.nodesHaveNames) {
        for (let i = 0, len = nodes.length; i < len; i++) {
            const node = nodes[i];
            parseNodesWithoutNames(ctx, node, 0, null);
        }
    } else {
        for (let i = 0, len = nodes.length; i < len; i++) {
            const node = nodes[i];
            parseNodesWithNames(ctx, node, 0, null);
        }
    }
}

function countMeshUsage(ctx, node) {
    const mesh = node.mesh;
    if (mesh) {
        mesh.instances = mesh.instances ? mesh.instances + 1 : 1;
    }
    if (node.children) {
        const children = node.children;
        for (let i = 0, len = children.length; i < len; i++) {
            const childNode = children[i];
            if (!childNode) {
                error(ctx, "Node not found: " + i);
                continue;
            }
            countMeshUsage(ctx, childNode);
        }
    }
}

function testIfNodesHaveNames(node) {
    if (node.name) {
        return true;
    }
    if (node.children) {
        const children = node.children;
        for (let i = 0, len = children.length; i < len; i++) {
            const childNode = children[i];
            if (testIfNodesHaveNames(childNode)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Parses a glTF node hierarchy that is known to NOT contain "name" attributes on the nodes.
 * Create a SceneMesh for each mesh primitive, and a single SceneObject.
 */
const parseNodesWithoutNames = (function () {
    const meshIds = [];
    return function (ctx, node, depth, matrix, parentNode) {
        matrix = parseNodeMatrix(node, matrix);
        if (node.mesh) {
            parseNodeMesh(node, ctx, matrix, meshIds);
        }
        if (node.children) {
            const children = node.children;
            for (let i = 0, len = children.length; i < len; i++) {
                const childNode = children[i];
                parseNodesWithoutNames(ctx, childNode, depth + 1, matrix, node);
            }
        }
        if (depth === 0) {
            let entityId = "entity-" + ctx.nextId++;
            if (meshIds && meshIds.length > 0) {
                ctx.sceneModel.createEntity({
                    id: entityId,
                    meshIds,
                    isObject: true
                });
                if (ctx.autoMetaModel) {
                    ctx.metaObjects.push({
                        id: entityId,
                        type: "Default",
                        name: entityId,
                        parent: ctx.sceneModel.id
                    });
                }
                meshIds.length = 0;
            }
        }
    }
})();

const parseNodesWithNames = (function () {

    const objectIdStack = [];
    const meshIdsStack = [];
    let meshIds = null;

    return function (ctx, node, depth, matrix) {
        matrix = parseNodeMatrix(node, matrix);
        if (meshIds && node.mesh) {
            parseNodeMesh(node, ctx, matrix, meshIds);
        }

        if (node.name) {
            meshIds = [];
            let entityId = node.name;
            if (!!entityId && ctx.sceneModel.objects[entityId]) {
               // ctx.log(`Warning: Two or more glTF nodes found with same 'name' attribute: '${entityId} - will randomly-generating an object ID in XKT`);
            }
            while (!entityId || ctx.sceneModel.objects[entityId]) {
                entityId = "entity-" + ctx.nextId++;
            }
            objectIdStack.push(entityId);
            meshIdsStack.push(meshIds);
        }

        if (node.children) {
            const children = node.children;
            for (let i = 0, len = children.length; i < len; i++) {
                const childNode = children[i];
                parseNodesWithNames(ctx, childNode, depth + 1, matrix);
            }
        }

        // Post-order visit scene node

        const nodeName = node.name;
        if ((nodeName !== undefined && nodeName !== null) || depth === 0) {
            let entityId = objectIdStack.pop();
            if (!entityId) { // For when there are no nodes with names
                entityId = "entity-" + ctx.nextId++;
            }
            let entityMeshIds = meshIdsStack.pop();
            if (meshIds && meshIds.length > 0) {
                ctx.sceneModel.createEntity({
                    id: entityId,
                    meshIds: entityMeshIds,
                    isObject: true
                });
                if (ctx.autoMetaModel) {
                    ctx.metaObjects.push({
                        id: entityId,
                        type: "Default",
                        name: entityId,
                        parent: ctx.sceneModel.id
                    });
                }
            }
            meshIds = meshIdsStack.length > 0 ? meshIdsStack[meshIdsStack.length - 1] : null;
        }
    };
})();


/**
 * Parses transform at the given glTF node.
 *
 * @param node the glTF node
 * @param matrix Transfor matrix from parent nodes
 * @returns {*} Transform matrix for the node
 */
function parseNodeMatrix(node, matrix) {
    let localMatrix;
    if (node.matrix) {
        localMatrix = node.matrix;
        if (matrix) {
            matrix = math.mulMat4(matrix, localMatrix, math.mat4());
        } else {
            matrix = localMatrix;
        }
    }
    if (node.translation) {
        localMatrix = math.translationMat4v(node.translation);
        if (matrix) {
            matrix = math.mulMat4(matrix, localMatrix, math.mat4());
        } else {
            matrix = localMatrix;
        }
    }
    if (node.rotation) {
        localMatrix = math.quaternionToMat4(node.rotation);
        if (matrix) {
            matrix = math.mulMat4(matrix, localMatrix, math.mat4());
        } else {
            matrix = localMatrix;
        }
    }
    if (node.scale) {
        localMatrix = math.scalingMat4v(node.scale);
        if (matrix) {
            matrix = math.mulMat4(matrix, localMatrix, math.mat4());
        } else {
            matrix = localMatrix;
        }
    }
    return matrix;
}

/**
 * Parses primitives referenced by the mesh belonging to the given node, creating XKTMeshes in the XKTModel.
 *
 * @param node glTF node
 * @param ctx Parsing context
 * @param matrix Matrix for the XKTMeshes
 * @param meshIds returns IDs of the new XKTMeshes
 */
function parseNodeMesh(node, ctx, matrix, meshIds) {
    const mesh = node.mesh;
    if (!mesh) {
        return;
    }
    const numPrimitives = mesh.primitives.length;
    if (numPrimitives > 0) {
        for (let i = 0; i < numPrimitives; i++) {
            const primitive = mesh.primitives[i];
            if (primitive.mode < 4) {
                continue;
            }
            const meshCfg = {
                id: ctx.sceneModel.id + "." + ctx.numObjects++
            };
            const material = primitive.material;
            if (material) {
                meshCfg.textureSetId = material._textureSetId;
                meshCfg.color = material._attributes.color;
                meshCfg.opacity = material._attributes.opacity;
                meshCfg.metallic = material._attributes.metallic;
                meshCfg.roughness = material._attributes.roughness;
            } else {
                meshCfg.color = new Float32Array([1.0, 1.0, 1.0]);
                meshCfg.opacity = 1.0;
            }
            const backfaces = ((ctx.backfaces !== false) || (material && material.doubleSided !== false));
            switch (primitive.mode) {
                case 0: // POINTS
                    meshCfg.primitive = "points";
                    break;
                case 1: // LINES
                    meshCfg.primitive = "lines";
                    break;
                case 2: // LINE_LOOP
                    meshCfg.primitive = "lines";
                    break;
                case 3: // LINE_STRIP
                    meshCfg.primitive = "lines";
                    break;
                case 4: // TRIANGLES
                    meshCfg.primitive = backfaces ? "triangles" : "solid";
                    break;
                case 5: // TRIANGLE_STRIP
                    meshCfg.primitive = backfaces ? "triangles" : "solid";
                    break;
                case 6: // TRIANGLE_FAN
                    meshCfg.primitive = backfaces ? "triangles" : "solid";
                    break;
                default:
                    meshCfg.primitive = backfaces ? "triangles" : "solid";
            }
            const POSITION = primitive.attributes.POSITION;
            if (!POSITION) {
                continue;
            }
            meshCfg.localPositions = POSITION.value;
            meshCfg.positions = new Float64Array(meshCfg.localPositions.length);
            if (primitive.attributes.NORMAL) {
                meshCfg.normals = primitive.attributes.NORMAL.value;
            }
            if (primitive.attributes.TEXCOORD_0) {
                meshCfg.uv = primitive.attributes.TEXCOORD_0.value;
            }
            if (primitive.indices) {
                meshCfg.indices = primitive.indices.value;
            }
            math.transformPositions3(matrix, meshCfg.localPositions, meshCfg.positions);
            const origin = math.vec3();
            const rtcNeeded = worldToRTCPositions(meshCfg.positions, meshCfg.positions, origin); // Small cellsize guarantees better accuracy
            if (rtcNeeded) {
                meshCfg.origin = origin;
            }
            ctx.sceneModel.createMesh(meshCfg);
            meshIds.push(meshCfg.id);
        }
    }
}

function error(ctx, msg) {
    ctx.plugin.error(msg);
}

export {GLTFSceneModelLoader};
