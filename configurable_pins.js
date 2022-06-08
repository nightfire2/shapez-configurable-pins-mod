// @ts-nocheck
const METADATA = {
    website: "https://github.com/nightfire2/shapez-configurable-pins-mod",
    author: "nightfire",
    name: "Configurable Pins",
    version: "0.1.2",
    id: "configurable-pins",
    description: "Allows rotating pins",
    minimumGameVersion: ">=1.5.0",

    // You can specify this parameter if savegames will still work
    // after your mod has been uninstalled
    doesNotAffectSavegame: false,
};

class PinConfigurator extends shapez.BaseHUDPart {

    initialize() {
        const keyActionMapper = this.root.keyMapper;
        keyActionMapper.getBinding(shapez.KEYMAPPINGS.placement.rotateWhilePlacing).add(this.tryRotate, this);

        this.placementBlueprint = this.root.hud.parts.blueprintPlacer.currentBlueprint
        this.placementBuilding = this.root.hud.parts.buildingPlacer.currentMetaBuilding
    }

    canRotate() {
        return this.root.currentLayer === "wires"
            && !this.root.camera.getIsMapOverlayActive()
            && !this.placementBlueprint.get()
            && !this.placementBuilding.get();
    }

    getBuildingWithPins(tile) {
        const building = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");

        if (building
            && building.components.WiredPins
            && building.components.WiredPins.slots.length > 0
            && this.buildingCanRenderPins(building)
        ) {
            return building;
        }
    }
    buildingCanRenderPins(building) {
        const metaBuilding = building.components.StaticMapEntity.getMetaBuilding();
        const code = building.components.StaticMapEntity.code;
        const variant = isNaN(code) ? code.replace(metaBuilding.id + "-", "") : null;
        return building.components.StaticMapEntity.getMetaBuilding().getRenderPins(variant);
    }

    getTilePins(building, localTile) {
        return building.components.WiredPins.slots.filter(pin => pin.pos.x == localTile.x && pin.pos.y == localTile.y);
    }
    getValidPinRotations(pins, tilePins, rotateCC) {
        if (tilePins.some(pin => pin.canRotate === false)) {
            return []
        };
        for (let i = 1; i < 4; i++) {
            const rotations = tilePins.map(pin => {
                const angle = (rotateCC ? 4 - i : i) * 90;
                const direction = shapez.Vector.transformDirectionFromMultipleOf90(pin.direction, angle);
                const point = shapez.enumDirectionToVector[direction].add(pin.pos);
                const collision = pins.some(p => p.pos.x == point.x && p.pos.y == point.y);
                return {
                    pin,
                    collision,
                    direction
                }
            });
            if (!rotations.some(attempt => attempt.collision)) {
                return rotations;
            }
        }
        return [];
    }

    tryRotate() {
        if (this.canRotate()) {

            const mousePosition = this.root.app.mousePosition;
            if (!mousePosition) {
                // Not on screen
                return;
            }
            const worldPos = this.root.camera.screenToWorld(mousePosition);
            const tile = worldPos.toTileSpace();
            const building = this.getBuildingWithPins(tile);
            if (building) {
                const localTile = building.components.StaticMapEntity.worldToLocalTile(tile);
                const tilePins = this.getTilePins(building, localTile);
                const pins = building.components.WiredPins.slots;
                const rotateCC = this.root.keyMapper.getBinding(shapez.KEYMAPPINGS.placement.rotateInverseModifier).pressed;
                const rotations = this.getValidPinRotations(pins, tilePins, rotateCC);
                rotations.forEach(rotation => rotation.pin.direction = rotation.direction);
                if (rotations.length > 0) {
                    this.root.systemMgr.systems.wire.needsRecompute = true;
                }
            }
        }
    }
}

class Mod extends shapez.Mod {
    init() {
        this.modInterface.registerHudElement("pin_configurator", PinConfigurator);
        this.modInterface.extendObject(shapez.WiredPinsComponent, ({ $super, $old }) => ({
            getSchema() {
                const schema = $old.getSchema();
                schema.slots.innerType.descriptor["direction"] = shapez.types.nullable(shapez.types.string);
                return schema;
            }
        }));

        const WiredPinsExtension = ({ $super, $old }) => ({
            copyAdditionalStateTo(otherComponent) {
                for (let i = 0; i < otherComponent.slots.length; ++i) {
                    otherComponent.slots[i].direction = this.slots[i].direction;
                }
            }
        });
        this.modInterface.extendClass(shapez.WiredPinsComponent, WiredPinsExtension);
        this.modInterface.runAfterMethod(shapez.WiredPinsComponent, "setSlots", function ([slots]) {
            if (slots) {
                for (let i = 0; i < slots.length; ++i) {
                    this.slots[i].canRotate = slots[i].canRotate ?? true;
                }
            }
        });
    }
}